from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Header, UploadFile, File, Form
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
import json
import asyncio
import base64
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'ai2lean-secret-key-2026')
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI(title="AI2Lean API - NETBFRS")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Formations & Categories ───

FORMATIONS = [
    {
        "id": "bts-sio-sisr",
        "name": "BTS SIO SISR",
        "full_name": "BTS Services Informatiques aux Organisations - SISR",
        "level": "Bac+2",
        "description": "Solutions d'Infrastructure, Systemes et Reseaux",
        "color": "#06b6d4",
    },
    {
        "id": "bachelor-ais",
        "name": "Bachelor AIS",
        "full_name": "Administrateur d'Infrastructures Securisees",
        "level": "Bac+3 (RNCP 37680)",
        "description": "Administration, securisation et evolution des infrastructures IT",
        "color": "#8b5cf6",
    },
]

CATEGORIES_BY_FORMATION = {
    "bts-sio-sisr": [
        {"id": "admin-systeme", "name": "Administration Systeme", "icon": "Server"},
        {"id": "reseaux", "name": "Reseaux et Infrastructure", "icon": "Network"},
        {"id": "cybersecurite", "name": "Cybersecurite", "icon": "Shield"},
        {"id": "virtualisation", "name": "Virtualisation", "icon": "Cpu"},
        {"id": "services-infra", "name": "Services d'Infrastructure", "icon": "Database"},
        {"id": "scripting", "name": "Scripting et Automatisation", "icon": "Terminal"},
    ],
    "bachelor-ais": [
        {"id": "admin-securise", "name": "Administrer et Securiser les Infra", "icon": "ShieldCheck"},
        {"id": "conception-infra", "name": "Conception d'Infrastructure", "icon": "LayoutDashboard"},
        {"id": "cyber-gestion", "name": "Gestion de la Cybersecurite", "icon": "ScanEye"},
        {"id": "cloud-virtualisation", "name": "Cloud et Virtualisation", "icon": "Cloud"},
        {"id": "supervision", "name": "Supervision et Monitoring", "icon": "Activity"},
        {"id": "automatisation", "name": "Automatisation (Ansible/Terraform)", "icon": "Cog"},
        {"id": "reseaux-avances", "name": "Reseaux Avances", "icon": "Network"},
        {"id": "gestion-projet", "name": "Gestion de Projet IT", "icon": "ClipboardList"},
    ],
}

# ─── Pydantic Models ───

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "etudiant"
    formation: str = "bts-sio-sisr"

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    role: Optional[str] = None
    formation: Optional[str] = None

class ExerciseQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    question_type: str
    options: List[str] = []
    correct_answer: str = ""
    points: int = 1

class ExerciseCreate(BaseModel):
    title: str
    description: str
    category: str
    formation: str = "bts-sio-sisr"
    questions: List[ExerciseQuestion]
    time_limit: int = 0
    shared: bool = False
    exercise_type: str = "standard"
    lab_instructions: Optional[str] = None
    lab_username: Optional[str] = None
    lab_password: Optional[str] = None
    proxmox_template_id: Optional[int] = None

class SubmissionAnswer(BaseModel):
    question_id: str
    answer: str

class SubmissionCreate(BaseModel):
    exercise_id: str
    answers: List[SubmissionAnswer]

# ─── Course Models ───

class CourseCreate(BaseModel):
    exercise_id: str
    title: str
    content: str = ""
    video_filename: Optional[str] = None
    objectives: List[str] = []
    prerequisites: List[str] = []
    duration_estimate: Optional[str] = None

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    video_filename: Optional[str] = None
    objectives: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None
    duration_estimate: Optional[str] = None

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads" / "videos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── Auth Helpers ───

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    return jwt.encode({"user_id": user_id, "role": role}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def auth_dependency(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Non authentifie")
    try:
        token = authorization[7:] if authorization.startswith("Bearer ") else authorization
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouve")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

def user_response(user):
    return {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": user["role"],
        "formation": user.get("formation", "bts-sio-sisr")
    }

# ─── Auth Routes ───

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"username": data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur deja pris")
    
    valid_formations = [f["id"] for f in FORMATIONS]
    formation = data.formation if data.formation in valid_formations else "bts-sio-sisr"
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "password": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role if data.role in ["admin", "formateur", "etudiant"] else "etudiant",
        "formation": formation,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_doc["role"])
    return {"token": token, "user": user_response(user_doc)}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"username": data.username}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": user_response(user)}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(auth_dependency)):
    return user_response(current_user)

# ─── Formations & Categories ───

@api_router.get("/formations")
async def get_formations():
    return FORMATIONS

@api_router.get("/categories")
async def get_categories(formation: str = None):
    if formation and formation in CATEGORIES_BY_FORMATION:
        return CATEGORIES_BY_FORMATION[formation]
    # Return all
    all_cats = []
    for f_id, cats in CATEGORIES_BY_FORMATION.items():
        for c in cats:
            all_cats.append({**c, "formation": f_id})
    return all_cats

# ─── User Management ───

@api_router.get("/users")
async def get_users(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    query = {}
    if formation:
        query["formation"] = formation
    users = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    update = {}
    if data.role and data.role in ["admin", "formateur", "etudiant"]:
        update["role"] = data.role
    if data.formation and data.formation in [f["id"] for f in FORMATIONS]:
        update["formation"] = data.formation
    if not update:
        raise HTTPException(status_code=400, detail="Rien a mettre a jour")
    result = await db.users.update_one({"id": user_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    return {"message": "Utilisateur mis a jour"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    return {"message": "Utilisateur supprime"}

# ─── Exercise Routes ───

@api_router.post("/exercises", status_code=201)
async def create_exercise(data: ExerciseCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Formateur ou admin uniquement")
    
    exercise_id = str(uuid.uuid4())
    exercise_doc = {
        "id": exercise_id,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "formation": data.formation,
        "shared": data.shared,
        "questions": [q.model_dump() for q in data.questions],
        "time_limit": data.time_limit,
        "exercise_type": data.exercise_type,
        "lab_instructions": data.lab_instructions,
        "lab_username": data.lab_username,
        "lab_password": data.lab_password,
        "proxmox_template_id": data.proxmox_template_id,
        "created_by": current_user["id"],
        "created_by_name": current_user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.exercises.insert_one(exercise_doc)
    return {**{k: v for k, v in exercise_doc.items() if k != "_id"}, "submission_count": 0}

@api_router.get("/exercises")
async def get_exercises(category: str = None, formation: str = None, current_user: dict = Depends(auth_dependency)):
    query = {}
    if formation:
        query["$or"] = [{"formation": formation}, {"shared": True}]
    if category:
        query["category"] = category
    exercises = await db.exercises.find(query, {"_id": 0}).to_list(1000)
    
    for ex in exercises:
        count = await db.submissions.count_documents({"exercise_id": ex["id"]})
        ex["submission_count"] = count
        if current_user["role"] == "etudiant":
            for q in ex.get("questions", []):
                q.pop("correct_answer", None)
    return exercises

@api_router.get("/exercises/{exercise_id}")
async def get_exercise(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    exercise = await db.exercises.find_one({"id": exercise_id}, {"_id": 0})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercice non trouve")
    count = await db.submissions.count_documents({"exercise_id": exercise_id})
    exercise["submission_count"] = count
    if current_user["role"] == "etudiant":
        for q in exercise.get("questions", []):
            q.pop("correct_answer", None)
    return exercise

@api_router.put("/exercises/{exercise_id}")
async def update_exercise(exercise_id: str, data: ExerciseCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    update_doc = {
        "title": data.title, "description": data.description,
        "category": data.category, "formation": data.formation,
        "shared": data.shared,
        "questions": [q.model_dump() for q in data.questions],
        "time_limit": data.time_limit,
        "exercise_type": data.exercise_type,
        "lab_instructions": data.lab_instructions,
        "lab_username": data.lab_username,
        "lab_password": data.lab_password,
        "proxmox_template_id": data.proxmox_template_id,
    }
    result = await db.exercises.update_one({"id": exercise_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Exercice non trouve")
    return {"message": "Exercice mis a jour"}

@api_router.delete("/exercises/{exercise_id}")
async def delete_exercise(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    result = await db.exercises.delete_one({"id": exercise_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exercice non trouve")
    return {"message": "Exercice supprime"}

# ─── Submission Routes ───

@api_router.post("/submissions")
async def create_submission(data: SubmissionCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "etudiant":
        raise HTTPException(status_code=403, detail="Etudiants uniquement")
    
    exercise = await db.exercises.find_one({"id": data.exercise_id}, {"_id": 0})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercice non trouve")
    
    existing = await db.submissions.find_one({"exercise_id": data.exercise_id, "student_id": current_user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez deja soumis cet exercice")
    
    score = 0
    max_score = 0
    graded_answers = []
    has_open_questions = False
    
    for answer in data.answers:
        question = next((q for q in exercise["questions"] if q["id"] == answer.question_id), None)
        if question:
            max_score += question.get("points", 1)
            answer_doc = {"question_id": answer.question_id, "answer": answer.answer, "correct": None, "points_earned": 0}
            if question["question_type"] == "qcm":
                is_correct = answer.answer.strip().lower() == question.get("correct_answer", "").strip().lower()
                answer_doc["correct"] = is_correct
                answer_doc["points_earned"] = question.get("points", 1) if is_correct else 0
                score += answer_doc["points_earned"]
            else:
                has_open_questions = True
            graded_answers.append(answer_doc)
    
    submission_id = str(uuid.uuid4())
    score_val = score if not has_open_questions else None
    score_20_val = round((score / max(max_score, 1)) * 20, 1) if not has_open_questions else None
    submission_doc = {
        "id": submission_id,
        "exercise_id": data.exercise_id,
        "exercise_title": exercise["title"],
        "formation": exercise.get("formation", "bts-sio-sisr"),
        "student_id": current_user["id"],
        "student_name": current_user["full_name"],
        "answers": graded_answers,
        "score": score_val,
        "score_20": score_20_val,
        "max_score": max_score,
        "ai_feedback": None,
        "graded": not has_open_questions,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.submissions.insert_one(submission_doc)
    
    if has_open_questions and EMERGENT_LLM_KEY:
        try:
            await grade_submission_with_ai(submission_id)
        except Exception as e:
            logger.error(f"AI grading failed: {e}")
    
    updated = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    return updated

@api_router.get("/submissions")
async def get_submissions(exercise_id: str = None, formation: str = None, current_user: dict = Depends(auth_dependency)):
    query = {}
    if current_user["role"] == "etudiant":
        query["student_id"] = current_user["id"]
    if exercise_id:
        query["exercise_id"] = exercise_id
    if formation:
        query["formation"] = formation
    submissions = await db.submissions.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(1000)
    return submissions

@api_router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, current_user: dict = Depends(auth_dependency)):
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Soumission non trouvee")
    if current_user["role"] == "etudiant" and submission["student_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    return submission

# ─── AI Grading ───

def _get_question_max_pts(exercise, question_id):
    q = next((q for q in exercise["questions"] if q["id"] == question_id), None)
    return q.get("points", 1) if q else 1

async def grade_submission_with_ai(submission_id: str):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        return
    exercise = await db.exercises.find_one({"id": submission["exercise_id"]}, {"_id": 0})
    if not exercise:
        return
    
    formation_name = next((f["full_name"] for f in FORMATIONS if f["id"] == exercise.get("formation")), "Formation IT")
    
    # ─── Lab VM Validation (PowerShell via QEMU Guest Agent) ───
    vm_validation_results = []
    if exercise.get("exercise_type") == "lab" and exercise.get("validation_scripts"):
        lab = await db.labs.find_one({
            "exercise_id": exercise["id"],
            "student_id": submission["student_id"],
            "status": "running"
        }, {"_id": 0})
        
        if lab and lab.get("vmid"):
            try:
                prox = get_proxmox()
                for script in exercise["validation_scripts"]:
                    try:
                        result = await run_powershell_on_vm(prox, lab["vmid"], script["command"])
                        passed = script.get("expected", "").lower() in result.lower() if result else False
                        vm_validation_results.append({
                            "name": script["name"],
                            "command": script["command"],
                            "expected": script.get("expected", ""),
                            "actual": result.strip() if result else "Erreur execution",
                            "passed": passed
                        })
                    except Exception as e:
                        vm_validation_results.append({
                            "name": script["name"],
                            "command": script["command"],
                            "expected": script.get("expected", ""),
                            "actual": f"Erreur: {str(e)[:100]}",
                            "passed": False
                        })
            except Exception as e:
                logger.error(f"VM validation failed: {e}")
    
    # ─── Build grading prompt ───
    prompt_parts = []
    open_question_ids = []
    for answer in submission["answers"]:
        question = next((q for q in exercise["questions"] if q["id"] == answer["question_id"]), None)
        if question and question["question_type"] == "open":
            open_question_ids.append(answer["question_id"])
            prompt_parts.append(
                f"Question ID: {answer['question_id']}\n"
                f"Question ({question.get('points', 1)} pts): {question['question_text']}\n"
                f"Reponse attendue: {question.get('correct_answer', 'Pas de reponse type')}\n"
                f"Reponse etudiant: {answer['answer']}"
            )
    
    if not prompt_parts and not vm_validation_results:
        return
    
    # Add VM validation results to the prompt
    vm_context = ""
    if vm_validation_results:
        vm_context = "\n\n=== RESULTATS DE VALIDATION AUTOMATIQUE SUR LA VM ===\n"
        passed_count = sum(1 for v in vm_validation_results if v["passed"])
        total_checks = len(vm_validation_results)
        vm_context += f"Tests reussis: {passed_count}/{total_checks}\n\n"
        for v in vm_validation_results:
            status = "REUSSI" if v["passed"] else "ECHOUE"
            vm_context += f"[{status}] {v['name']}\n  Commande: {v['command']}\n  Attendu: {v['expected']}\n  Obtenu: {v['actual']}\n\n"
    
    grading_prompt = (
        f"Tu es un correcteur pour la formation '{formation_name}' de l'academie NETBFRS. "
        f"Evalue les reponses suivantes de l'etudiant. "
    )
    
    if vm_validation_results:
        grading_prompt += (
            f"IMPORTANT: Des scripts PowerShell ont ete executes sur la VM de l'etudiant pour verifier son travail pratique. "
            f"Prends en compte ces resultats dans ton evaluation. Un etudiant qui a correctement configure sa VM "
            f"mais mal repondu aux questions doit quand meme avoir des points. "
            f"Inversement, un etudiant qui repond bien mais n'a rien fait sur la VM perd des points. "
        )
    
    grading_prompt += (
        f"Pour chaque question ouverte, attribue un score sur les points disponibles. "
        f"IMPORTANT: Utilise exactement les Question ID fournis dans ta reponse. "
        f"Reponds en JSON avec ce format exact: "
        f'{{"scores": [{{"question_id": "COPIE_LE_QUESTION_ID_ICI", "points_earned": X, "feedback": "..."}}], '
        f'"total_score": X, "general_feedback": "...", '
        f'"vm_validation_summary": "Resume des verifications VM"}}\n\n'
        + "\n\n".join(prompt_parts)
        + vm_context
    )
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"grading-{submission_id}",
        system_message=f"Tu es un correcteur expert de la formation {formation_name} a l'academie NETBFRS. Tu notes avec precision et bienveillance. Reponds uniquement en JSON valide."
    )
    chat.with_model("openai", "gpt-5.2")
    
    response = await chat.send_message(UserMessage(text=grading_prompt))
    
    try:
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        result = json.loads(response_text)
        
        qcm_score = sum(a.get("points_earned", 0) for a in submission["answers"] if a.get("correct") is not None)
        ai_score = 0
        
        ai_scores = result.get("scores", [])
        
        # Try matching by question_id first
        matched_ids = set()
        for ai_item in ai_scores:
            for answer in submission["answers"]:
                if answer["question_id"] == ai_item.get("question_id"):
                    pts = min(ai_item.get("points_earned", 0), _get_question_max_pts(exercise, answer["question_id"]))
                    answer["points_earned"] = pts
                    answer["ai_feedback"] = ai_item.get("feedback", "")
                    ai_score += pts
                    matched_ids.add(answer["question_id"])
        
        # Fallback: if no IDs matched, assign scores to open questions in order
        if not matched_ids and ai_scores:
            idx = 0
            for answer in submission["answers"]:
                if answer["question_id"] in open_question_ids and idx < len(ai_scores):
                    pts = min(ai_scores[idx].get("points_earned", 0), _get_question_max_pts(exercise, answer["question_id"]))
                    answer["points_earned"] = pts
                    answer["ai_feedback"] = ai_scores[idx].get("feedback", "")
                    ai_score += pts
                    idx += 1
        
        # If total_score from AI is provided and seems more reliable, use it
        ai_total = result.get("total_score", ai_score)
        if isinstance(ai_total, (int, float)) and ai_total > 0:
            ai_score = min(ai_total, sum(_get_question_max_pts(exercise, qid) for qid in open_question_ids))
        
        total_score = qcm_score + ai_score
        score_20 = round((total_score / max(submission["max_score"], 1)) * 20, 1)
        
        await db.submissions.update_one(
            {"id": submission_id},
            {"$set": {
                "answers": submission["answers"],
                "score": total_score,
                "score_20": score_20,
                "ai_feedback": result.get("general_feedback", ""),
                "vm_validation": vm_validation_results if vm_validation_results else None,
                "vm_validation_summary": result.get("vm_validation_summary", ""),
                "graded": True
            }}
        )
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse AI response: {e}")
        await db.submissions.update_one(
            {"id": submission_id},
            {"$set": {
                "ai_feedback": "Evaluation IA en cours de traitement.",
                "vm_validation": vm_validation_results if vm_validation_results else None,
                "graded": False
            }}
        )
    
    # ─── Auto-cleanup VM after lab grading ───
    if exercise.get("exercise_type") == "lab":
        try:
            lab = await db.labs.find_one({
                "exercise_id": exercise["id"],
                "student_id": submission["student_id"],
                "status": "running"
            })
            if lab:
                prox = get_proxmox()
                vmid = lab["vmid"]
                # Stop VM
                try:
                    prox.nodes(PROXMOX_NODE).qemu(vmid).status.stop.post()
                    logger.info(f"VM {vmid} stopped after lab submission")
                except Exception:
                    pass
                # Wait a bit then delete
                await asyncio.sleep(5)
                try:
                    prox.nodes(PROXMOX_NODE).qemu(vmid).delete()
                    logger.info(f"VM {vmid} deleted after lab submission")
                except Exception as e:
                    logger.warning(f"Could not delete VM {vmid}: {e}")
                # Delete Guacamole connection
                if lab.get("guac_connection_id"):
                    try:
                        token = guac_auth()
                        requests.delete(
                            f"{GUAC_URL}/guacamole/api/session/data/postgresql/connections/{lab['guac_connection_id']}?token={token}",
                            verify=False
                        )
                    except Exception:
                        pass
                # Update lab status
                await db.labs.update_one(
                    {"id": lab["id"]},
                    {"$set": {"status": "completed", "stopped_at": datetime.now(timezone.utc).isoformat()}}
                )
        except Exception as e:
            logger.error(f"VM cleanup failed: {e}")

@api_router.post("/grade/{submission_id}")
async def trigger_grading(submission_id: str, current_user: dict = Depends(auth_dependency)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Cle API IA non configuree")
    
    # Students can grade their own lab submissions
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Soumission introuvable")
    
    if current_user["role"] == "etudiant" and submission["student_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    await grade_submission_with_ai(submission_id)
    updated = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    return updated

# ─── Stats Routes ───

@api_router.get("/stats/overview")
async def get_overview_stats(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    user_query = {"role": "etudiant"}
    ex_query = {}
    sub_query = {}
    if formation:
        user_query["formation"] = formation
        ex_query["formation"] = formation
        sub_query["formation"] = formation
    
    total_students = await db.users.count_documents(user_query)
    total_formateurs = await db.users.count_documents({"role": "formateur"})
    total_exercises = await db.exercises.count_documents(ex_query)
    total_submissions = await db.submissions.count_documents(sub_query)
    graded_query = {**sub_query, "graded": True}
    graded_submissions = await db.submissions.count_documents(graded_query)
    
    pipeline = [
        {"$match": {**sub_query, "graded": True, "score": {"$ne": None}}},
        {"$group": {"_id": None, "avg_score": {"$avg": {"$multiply": [{"$divide": ["$score", {"$max": ["$max_score", 1]}]}, 100]}}}}
    ]
    avg_result = await db.submissions.aggregate(pipeline).to_list(1)
    avg_score = avg_result[0]["avg_score"] if avg_result else 0
    
    recent = await db.submissions.find(sub_query, {"_id": 0}).sort("submitted_at", -1).to_list(10)
    
    # Stats per formation
    formation_stats = []
    for f in FORMATIONS:
        f_students = await db.users.count_documents({"role": "etudiant", "formation": f["id"]})
        f_exercises = await db.exercises.count_documents({"formation": f["id"]})
        f_subs = await db.submissions.count_documents({"formation": f["id"]})
        formation_stats.append({"id": f["id"], "name": f["name"], "students": f_students, "exercises": f_exercises, "submissions": f_subs})
    
    return {
        "total_students": total_students,
        "total_formateurs": total_formateurs,
        "total_exercises": total_exercises,
        "total_submissions": total_submissions,
        "graded_submissions": graded_submissions,
        "avg_score": round(avg_score, 1),
        "recent_submissions": recent,
        "formation_stats": formation_stats,
    }

@api_router.get("/stats/student")
async def get_student_stats(current_user: dict = Depends(auth_dependency)):
    user_formation = current_user.get("formation", "bts-sio-sisr")
    submissions = await db.submissions.find({"student_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    total_exercises = await db.exercises.count_documents({"$or": [{"formation": user_formation}, {"shared": True}]})
    completed = len(submissions)
    graded = [s for s in submissions if s.get("graded")]
    
    avg_score = 0
    if graded:
        scores = [(s["score"] / max(s["max_score"], 1)) * 100 for s in graded if s.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
    
    category_stats = {}
    for s in submissions:
        exercise = await db.exercises.find_one({"id": s["exercise_id"]}, {"_id": 0})
        if exercise:
            cat = exercise.get("category", "other")
            if cat not in category_stats:
                category_stats[cat] = {"completed": 0, "total_score": 0, "count": 0}
            category_stats[cat]["completed"] += 1
            if s.get("graded") and s.get("score") is not None:
                category_stats[cat]["total_score"] += (s["score"] / max(s["max_score"], 1)) * 100
                category_stats[cat]["count"] += 1
    
    return {
        "total_exercises": total_exercises,
        "completed_exercises": completed,
        "avg_score": round(avg_score, 1),
        "category_stats": category_stats,
        "recent_submissions": submissions[:5]
    }

@api_router.get("/stats/students-tracking")
async def get_students_tracking(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    query = {"role": "etudiant"}
    if formation:
        query["formation"] = formation
    students = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    tracking = []
    
    for student in students:
        submissions = await db.submissions.find({"student_id": student["id"]}, {"_id": 0}).to_list(1000)
        graded = [s for s in submissions if s.get("graded") and s.get("score") is not None]
        avg_score = 0
        if graded:
            scores = [(s["score"] / max(s["max_score"], 1)) * 100 for s in graded]
            avg_score = sum(scores) / len(scores) if scores else 0
        
        last_activity = submissions[0]["submitted_at"] if submissions else student.get("created_at", "")
        tracking.append({
            "id": student["id"],
            "full_name": student["full_name"],
            "username": student["username"],
            "formation": student.get("formation", "bts-sio-sisr"),
            "exercises_completed": len(submissions),
            "avg_score": round(avg_score, 1),
            "last_activity": last_activity
        })
    return tracking

# ─── Charts Data ───

from collections import defaultdict
import csv
import io
from fastapi.responses import StreamingResponse

@api_router.get("/stats/charts")
async def get_chart_data(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    sub_query = {}
    if formation:
        sub_query["formation"] = formation
    
    submissions = await db.submissions.find(sub_query, {"_id": 0}).sort("submitted_at", 1).to_list(5000)
    
    # 1. Submissions over time (by day)
    submissions_by_day = defaultdict(int)
    scores_by_day = defaultdict(list)
    for s in submissions:
        day = s.get("submitted_at", "")[:10]
        if day:
            submissions_by_day[day] += 1
            if s.get("graded") and s.get("score") is not None:
                pct = round((s["score"] / max(s["max_score"], 1)) * 100, 1)
                scores_by_day[day].append(pct)
    
    timeline = []
    for day in sorted(submissions_by_day.keys()):
        avg = round(sum(scores_by_day.get(day, [0])) / max(len(scores_by_day.get(day, [1])), 1), 1) if scores_by_day.get(day) else None
        timeline.append({"date": day, "count": submissions_by_day[day], "avg_score": avg})
    
    # 2. Score distribution (buckets: 0-4, 4-8, 8-12, 12-16, 16-20)
    score_dist = [
        {"range": "0-4", "count": 0},
        {"range": "4-8", "count": 0},
        {"range": "8-12", "count": 0},
        {"range": "12-16", "count": 0},
        {"range": "16-20", "count": 0},
    ]
    for s in submissions:
        if s.get("graded") and s.get("score") is not None:
            score_20 = s.get("score_20") or round((s["score"] / max(s["max_score"], 1)) * 20, 1)
            if score_20 < 4: score_dist[0]["count"] += 1
            elif score_20 < 8: score_dist[1]["count"] += 1
            elif score_20 < 12: score_dist[2]["count"] += 1
            elif score_20 < 16: score_dist[3]["count"] += 1
            else: score_dist[4]["count"] += 1
    
    # 3. Performance by category
    cat_perf = defaultdict(lambda: {"total": 0, "scores": []})
    for s in submissions:
        ex = await db.exercises.find_one({"id": s["exercise_id"]}, {"_id": 0, "category": 1})
        if ex:
            cat = ex.get("category", "autre")
            cat_perf[cat]["total"] += 1
            if s.get("graded") and s.get("score") is not None:
                cat_perf[cat]["scores"].append(round((s["score"] / max(s["max_score"], 1)) * 100, 1))
    
    category_stats = []
    for cat, data in cat_perf.items():
        avg = round(sum(data["scores"]) / max(len(data["scores"]), 1), 1) if data["scores"] else 0
        category_stats.append({"category": cat, "submissions": data["total"], "avg_score": avg})
    
    # 4. Top students
    student_perf = defaultdict(lambda: {"name": "", "scores": [], "count": 0})
    for s in submissions:
        sid = s.get("student_id", "")
        student_perf[sid]["name"] = s.get("student_name", "?")
        student_perf[sid]["count"] += 1
        if s.get("graded") and s.get("score") is not None:
            student_perf[sid]["scores"].append(round((s["score"] / max(s["max_score"], 1)) * 100, 1))
    
    top_students = []
    for sid, data in student_perf.items():
        avg = round(sum(data["scores"]) / max(len(data["scores"]), 1), 1) if data["scores"] else 0
        top_students.append({"id": sid, "name": data["name"], "avg_score": avg, "submissions": data["count"]})
    top_students.sort(key=lambda x: x["avg_score"], reverse=True)
    
    return {
        "timeline": timeline,
        "score_distribution": score_dist,
        "category_stats": category_stats,
        "top_students": top_students[:10],
    }


@api_router.get("/stats/student-charts")
async def get_student_chart_data(current_user: dict = Depends(auth_dependency)):
    submissions = await db.submissions.find({"student_id": current_user["id"]}, {"_id": 0}).sort("submitted_at", 1).to_list(500)
    
    # Progress over time
    progress = []
    for s in submissions:
        if s.get("graded") and s.get("score") is not None:
            score_20 = s.get("score_20") or round((s["score"] / max(s["max_score"], 1)) * 20, 1)
            progress.append({
                "date": s.get("submitted_at", "")[:10],
                "score": score_20,
                "exercise": s.get("exercise_title", "?")
            })
    
    # Performance by category (radar data)
    cat_data = defaultdict(lambda: {"scores": [], "total": 0})
    for s in submissions:
        ex = await db.exercises.find_one({"id": s["exercise_id"]}, {"_id": 0, "category": 1})
        if ex:
            cat = ex.get("category", "autre")
            cat_data[cat]["total"] += 1
            if s.get("graded") and s.get("score") is not None:
                cat_data[cat]["scores"].append(round((s["score"] / max(s["max_score"], 1)) * 100, 1))
    
    radar = []
    for cat, data in cat_data.items():
        avg = round(sum(data["scores"]) / max(len(data["scores"]), 1), 1) if data["scores"] else 0
        radar.append({"category": cat, "score": avg, "count": data["total"]})
    
    return {"progress": progress, "radar": radar}


# ─── Export CSV ───

@api_router.get("/export/submissions-csv")
async def export_submissions_csv(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    query = {}
    if formation:
        query["formation"] = formation
    submissions = await db.submissions.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(5000)
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["Etudiant", "Exercice", "Formation", "Score", "Score /20", "Max Points", "Corrige", "Date soumission", "Feedback IA"])
    
    for s in submissions:
        score_20 = s.get("score_20") or (round((s.get("score", 0) / max(s.get("max_score", 1), 1)) * 20, 1) if s.get("graded") else "")
        writer.writerow([
            s.get("student_name", ""),
            s.get("exercise_title", ""),
            s.get("formation", ""),
            s.get("score", "") if s.get("graded") else "",
            score_20,
            s.get("max_score", ""),
            "Oui" if s.get("graded") else "Non",
            s.get("submitted_at", "")[:19].replace("T", " "),
            (s.get("ai_feedback", "") or "")[:200],
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=soumissions-ai2lean-{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@api_router.get("/export/tracking-csv")
async def export_tracking_csv(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    query = {"role": "etudiant"}
    if formation:
        query["formation"] = formation
    students = await db.users.find(query, {"_id": 0, "password": 0}).to_list(1000)
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["Nom complet", "Username", "Formation", "Exercices completes", "Score moyen (%)", "Derniere activite"])
    
    for student in students:
        subs = await db.submissions.find({"student_id": student["id"]}, {"_id": 0}).to_list(1000)
        graded = [s for s in subs if s.get("graded") and s.get("score") is not None]
        avg = round(sum((s["score"] / max(s["max_score"], 1)) * 100 for s in graded) / max(len(graded), 1), 1) if graded else 0
        last = subs[0]["submitted_at"][:19].replace("T", " ") if subs else ""
        writer.writerow([
            student.get("full_name", ""),
            student.get("username", ""),
            student.get("formation", ""),
            len(subs),
            avg,
            last,
        ])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=suivi-etudiants-{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@api_router.get("/export/result-csv/{submission_id}")
async def export_single_result_csv(submission_id: str, current_user: dict = Depends(auth_dependency)):
    sub = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Soumission introuvable")
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["Exercice", "Etudiant", "Score", "Score /20", "Date"])
    score_20 = sub.get("score_20") or (round((sub.get("score", 0) / max(sub.get("max_score", 1), 1)) * 20, 1) if sub.get("graded") else "")
    writer.writerow([sub.get("exercise_title", ""), sub.get("student_name", ""), f"{sub.get('score', '')}/{sub.get('max_score', '')}", score_20, sub.get("submitted_at", "")[:19]])
    writer.writerow([])
    writer.writerow(["Question #", "Type", "Reponse", "Points", "Feedback IA"])
    for i, a in enumerate(sub.get("answers", []), 1):
        qtype = "QCM" if a.get("correct") is not None else "Ouverte"
        writer.writerow([i, qtype, a.get("answer", ""), a.get("points_earned", ""), a.get("ai_feedback", "")])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=resultat-{submission_id[:8]}.csv"}
    )


# ─── Seed Data ───

@api_router.post("/seed")
async def seed_data():
    admin_exists = await db.users.find_one({"username": "admin"}, {"_id": 0})
    if admin_exists:
        return {"message": "Donnees deja initialisees"}
    
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({"id": admin_id, "username": "admin", "password": hash_password("admin123"), "full_name": "Administrateur NETBFRS", "role": "admin", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    formateur_id = str(uuid.uuid4())
    await db.users.insert_one({"id": formateur_id, "username": "formateur", "password": hash_password("formateur123"), "full_name": "Jean Dupont", "role": "formateur", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    # BTS SIO SISR students
    for uname, fname in [("etudiant1", "Alice Martin"), ("etudiant2", "Bob Durand")]:
        await db.users.insert_one({"id": str(uuid.uuid4()), "username": uname, "password": hash_password("etudiant123"), "full_name": fname, "role": "etudiant", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    # Bachelor AIS students
    for uname, fname in [("ais_student1", "Claire Petit"), ("ais_student2", "David Moreau")]:
        await db.users.insert_one({"id": str(uuid.uuid4()), "username": uname, "password": hash_password("etudiant123"), "full_name": fname, "role": "etudiant", "formation": "bachelor-ais", "created_at": datetime.now(timezone.utc).isoformat()})
    
    # BTS SIO SISR exercises
    await db.exercises.insert_one({
        "id": str(uuid.uuid4()), "title": "Les bases du reseau TCP/IP",
        "description": "Testez vos connaissances sur les fondamentaux du modele TCP/IP.",
        "category": "reseaux", "formation": "bts-sio-sisr", "shared": False,
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Combien de couches comporte le modele TCP/IP ?", "question_type": "qcm", "options": ["3", "4", "5", "7"], "correct_answer": "4", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Quel protocole est utilise pour la resolution de noms ?", "question_type": "qcm", "options": ["HTTP", "DNS", "FTP", "SMTP"], "correct_answer": "DNS", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Expliquez la difference entre TCP et UDP.", "question_type": "open", "options": [], "correct_answer": "TCP oriente connexion, fiable. UDP sans connexion, rapide. TCP: HTTP. UDP: DNS, streaming.", "points": 4},
        ],
        "time_limit": 15, "created_by": formateur_id, "created_by_name": "Jean Dupont", "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.exercises.insert_one({
        "id": str(uuid.uuid4()), "title": "Administration Linux - Commandes de base",
        "description": "Evaluez vos competences sur les commandes essentielles de Linux.",
        "category": "admin-systeme", "formation": "bts-sio-sisr", "shared": False,
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Quelle commande liste les fichiers ?", "question_type": "qcm", "options": ["dir", "ls", "list", "show"], "correct_answer": "ls", "points": 1},
            {"id": str(uuid.uuid4()), "question_text": "Quelle commande change les permissions ?", "question_type": "qcm", "options": ["chmod", "chown", "chperm", "setperm"], "correct_answer": "chmod", "points": 1},
            {"id": str(uuid.uuid4()), "question_text": "Decrivez les permissions rwx et la notation octale 755.", "question_type": "open", "options": [], "correct_answer": "r=4, w=2, x=1. 755=rwxr-xr-x.", "points": 4},
        ],
        "time_limit": 10, "created_by": formateur_id, "created_by_name": "Jean Dupont", "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Bachelor AIS exercises
    await db.exercises.insert_one({
        "id": str(uuid.uuid4()), "title": "Securisation d'une infrastructure reseau",
        "description": "Evaluez vos competences en securisation d'infrastructures (Bloc 1 AIS).",
        "category": "admin-securise", "formation": "bachelor-ais", "shared": False,
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Quel outil permet de scanner les ports ouverts d'un serveur ?", "question_type": "qcm", "options": ["Wireshark", "Nmap", "Ansible", "Nagios"], "correct_answer": "Nmap", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Quel est le role d'un pare-feu (firewall) ?", "question_type": "qcm", "options": ["Sauvegarder les donnees", "Filtrer le trafic reseau", "Compresser les fichiers", "Gerer les utilisateurs"], "correct_answer": "Filtrer le trafic reseau", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Decrivez une politique de durcissement (hardening) pour un serveur Linux en production. Citez au moins 5 mesures.", "question_type": "open", "options": [], "correct_answer": "Desactiver services inutiles, firewall (iptables/nftables), SSH cle uniquement, mises a jour auto, fail2ban, audit logs, permissions minimales, SELinux/AppArmor.", "points": 6},
        ],
        "time_limit": 20, "created_by": formateur_id, "created_by_name": "Jean Dupont", "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.exercises.insert_one({
        "id": str(uuid.uuid4()), "title": "Cloud et Virtualisation avancee",
        "description": "Questions sur Proxmox, Docker et les architectures cloud (Bloc 2 AIS).",
        "category": "cloud-virtualisation", "formation": "bachelor-ais", "shared": False,
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Quelle est la difference entre un hyperviseur de type 1 et type 2 ?", "question_type": "qcm", "options": ["Type 1 tourne sur l'OS, Type 2 bare-metal", "Type 1 bare-metal, Type 2 tourne sur l'OS", "Aucune difference", "Type 1 = conteneurs, Type 2 = VM"], "correct_answer": "Type 1 bare-metal, Type 2 tourne sur l'OS", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Quel fichier definit les services dans Docker Compose ?", "question_type": "qcm", "options": ["Dockerfile", "docker-compose.yml", "config.json", "services.xml"], "correct_answer": "docker-compose.yml", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Concevez une architecture haute disponibilite avec Proxmox pour une PME (3 serveurs). Decrivez le cluster, le stockage et la strategie de sauvegarde.", "question_type": "open", "options": [], "correct_answer": "Cluster 3 noeuds Proxmox, stockage Ceph/ZFS replique, migration live, Proxmox Backup Server, sauvegarde 3-2-1, VLAN separation.", "points": 8},
        ],
        "time_limit": 25, "created_by": formateur_id, "created_by_name": "Jean Dupont", "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Donnees AI2Lean initialisees", "credentials": {
        "admin": {"username": "admin", "password": "admin123"},
        "formateur": {"username": "formateur", "password": "formateur123"},
        "bts_sisr": {"username": "etudiant1/etudiant2", "password": "etudiant123"},
        "bachelor_ais": {"username": "ais_student1/ais_student2", "password": "etudiant123"},
    }}


# ─── Course Routes ───

@api_router.post("/courses", status_code=201)
async def create_course(data: CourseCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Formateur ou admin uniquement")
    
    # Verify exercise exists and is a lab
    exercise = await db.exercises.find_one({"id": data.exercise_id}, {"_id": 0})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercice non trouve")
    
    # Check if course already exists for this exercise
    existing = await db.courses.find_one({"exercise_id": data.exercise_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Un cours existe deja pour cet exercice. Utilisez PUT pour le modifier.")
    
    course_id = str(uuid.uuid4())
    course_doc = {
        "id": course_id,
        "exercise_id": data.exercise_id,
        "title": data.title,
        "content": data.content,
        "video_filename": data.video_filename,
        "objectives": data.objectives,
        "prerequisites": data.prerequisites,
        "duration_estimate": data.duration_estimate,
        "created_by": current_user["id"],
        "created_by_name": current_user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.courses.insert_one(course_doc)
    return {k: v for k, v in course_doc.items() if k != "_id"}

@api_router.get("/courses")
async def get_courses(formation: str = None, current_user: dict = Depends(auth_dependency)):
    if formation:
        # Get exercise IDs for this formation
        exercises = await db.exercises.find({"formation": formation}, {"_id": 0, "id": 1}).to_list(1000)
        ex_ids = [e["id"] for e in exercises]
        courses = await db.courses.find({"exercise_id": {"$in": ex_ids}}, {"_id": 0}).to_list(1000)
    else:
        courses = await db.courses.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with exercise info
    for course in courses:
        exercise = await db.exercises.find_one({"id": course["exercise_id"]}, {"_id": 0, "title": 1, "category": 1, "formation": 1, "exercise_type": 1})
        if exercise:
            course["exercise_title"] = exercise.get("title", "")
            course["exercise_category"] = exercise.get("category", "")
            course["exercise_formation"] = exercise.get("formation", "")
            course["exercise_type"] = exercise.get("exercise_type", "standard")
    return courses

@api_router.get("/courses/by-exercise/{exercise_id}")
async def get_course_by_exercise(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    course = await db.courses.find_one({"exercise_id": exercise_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Aucun cours pour cet exercice")
    return course

@api_router.get("/courses/{course_id}")
async def get_course(course_id: str, current_user: dict = Depends(auth_dependency)):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Cours non trouve")
    return course

@api_router.put("/courses/{course_id}")
async def update_course(course_id: str, data: CourseUpdate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.title is not None:
        update["title"] = data.title
    if data.content is not None:
        update["content"] = data.content
    if data.video_filename is not None:
        update["video_filename"] = data.video_filename
    if data.objectives is not None:
        update["objectives"] = data.objectives
    if data.prerequisites is not None:
        update["prerequisites"] = data.prerequisites
    if data.duration_estimate is not None:
        update["duration_estimate"] = data.duration_estimate
    
    result = await db.courses.update_one({"id": course_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cours non trouve")
    return {"message": "Cours mis a jour"}

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Cours non trouve")
    
    # Delete associated video file
    if course.get("video_filename"):
        video_path = UPLOAD_DIR / course["video_filename"]
        if video_path.exists():
            video_path.unlink()
    
    await db.courses.delete_one({"id": course_id})
    return {"message": "Cours supprime"}

# ─── Video Upload & Serve ───

@api_router.post("/upload/video")
async def upload_video(file: UploadFile = File(...), current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Le fichier doit etre une video (MP4, WebM, etc.)")
    
    # Generate unique filename
    ext = Path(file.filename).suffix if file.filename else ".mp4"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_DIR / filename
    
    # Save file in chunks
    try:
        with open(filepath, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                buffer.write(chunk)
    except Exception as e:
        if filepath.exists():
            filepath.unlink()
        raise HTTPException(status_code=500, detail=f"Erreur upload: {str(e)}")
    
    file_size = filepath.stat().st_size
    return {
        "filename": filename,
        "original_name": file.filename,
        "size": file_size,
        "content_type": file.content_type,
    }

@api_router.get("/videos/{filename}")
async def serve_video(filename: str):
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Video non trouvee")
    
    content_type = "video/mp4"
    if filename.endswith(".webm"):
        content_type = "video/webm"
    elif filename.endswith(".ogg"):
        content_type = "video/ogg"
    
    return FileResponse(
        filepath,
        media_type=content_type,
        filename=filename,
    )

@api_router.get("/videos")
async def list_videos(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    videos = []
    if UPLOAD_DIR.exists():
        for f in UPLOAD_DIR.iterdir():
            if f.is_file() and f.suffix in [".mp4", ".webm", ".ogg", ".avi", ".mkv"]:
                videos.append({
                    "filename": f.name,
                    "size": f.stat().st_size,
                    "modified": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
                })
    return videos


# ─── Proxmox + Guacamole Lab Integration ───

import requests
from proxmoxer import ProxmoxAPI

def get_proxmox():
    host = os.environ.get('PROXMOX_HOST')
    port = int(os.environ.get('PROXMOX_PORT', 8006))
    user = os.environ.get('PROXMOX_USER')
    token_name = os.environ.get('PROXMOX_TOKEN_NAME')
    token_value = os.environ.get('PROXMOX_TOKEN_SECRET')
    if not all([host, user, token_name, token_value]):
        return None
    return ProxmoxAPI(host, port=port, user=user, token_name=token_name, token_value=token_value, verify_ssl=False)

GUAC_URL = os.environ.get('GUACAMOLE_URL', '')
GUAC_USER = os.environ.get('GUACAMOLE_USER', 'guacadmin')
GUAC_PASS = os.environ.get('GUACAMOLE_PASSWORD', 'guacadmin')
PROXMOX_NODE = os.environ.get('PROXMOX_NODE', 'SRVDEPLOY')


async def run_powershell_on_vm(prox, vmid, command, timeout=15):
    """Execute a PowerShell command on a VM via QEMU Guest Agent and return output."""
    import time
    
    # Execute command
    result = prox.nodes(PROXMOX_NODE).qemu(vmid).agent("exec").post(
        command="powershell.exe",
        **{"input-data": command}
    )
    pid = result.get("pid")
    if not pid:
        return "Erreur: pas de PID"
    
    # Wait for result
    for _ in range(timeout):
        await asyncio.sleep(1)
        try:
            status = prox.nodes(PROXMOX_NODE).qemu(vmid).agent("exec-status").get(pid=pid)
            if status.get("exited"):
                out = status.get("out-data", "")
                err = status.get("err-data", "")
                return out.strip() if out else err.strip()
        except Exception:
            pass
    
    return "Timeout"

def guac_auth():
    r = requests.post(f"{GUAC_URL}/guacamole/api/tokens", data={"username": GUAC_USER, "password": GUAC_PASS}, verify=False)
    r.raise_for_status()
    return r.json()["authToken"]

def guac_create_connection(token, name, hostname, protocol="rdp", port="3389", username="Administrateur", password="Lab2026!"):
    payload = {
        "parentIdentifier": "ROOT",
        "name": name,
        "protocol": protocol,
        "parameters": {
            "hostname": hostname,
            "port": port,
            "username": username,
            "password": password,
            "security": "any",
            "ignore-cert": "true",
            "resize-method": "display-update",
            "enable-wallpaper": "false",
            "server-layout": "fr-fr-azerty",
        },
        "attributes": {"max-connections": "2", "max-connections-per-user": "2"}
    }
    # Try postgresql first (detected datasource)
    for ds in ["postgresql", "mysql", "default"]:
        r = requests.post(
            f"{GUAC_URL}/guacamole/api/session/data/{ds}/connections?token={token}",
            json=payload, verify=False
        )
        if r.status_code == 200:
            return r.json()
    r.raise_for_status()
    return r.json()

def guac_delete_connection(token, conn_id):
    for ds in ["mysql", "postgresql", "default"]:
        r = requests.delete(f"{GUAC_URL}/guacamole/api/session/data/{ds}/connections/{conn_id}?token={token}", verify=False)
        if r.status_code == 204 or r.status_code == 200:
            return True
    return False

import base64

class LabStart(BaseModel):
    exercise_id: str

@api_router.post("/labs/start")
async def start_lab(data: LabStart, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "etudiant":
        raise HTTPException(status_code=403, detail="Etudiants uniquement")
    
    exercise = await db.exercises.find_one({"id": data.exercise_id}, {"_id": 0})
    if not exercise or exercise.get("exercise_type") != "lab":
        raise HTTPException(status_code=400, detail="Cet exercice n'est pas un lab")
    
    # Check if lab already running or cloning
    existing = await db.labs.find_one({"student_id": current_user["id"], "exercise_id": data.exercise_id, "status": {"$in": ["running", "cloning", "starting"]}}, {"_id": 0})
    if existing:
        return existing
    
    prox = get_proxmox()
    if not prox:
        raise HTTPException(status_code=500, detail="Proxmox non configure")
    
    template_id = exercise.get("proxmox_template_id", int(os.environ.get('PROXMOX_TEMPLATE_WINSERVER', 9002)))
    
    # Find next available VMID
    try:
        cluster_resources = prox.cluster.resources.get(type="vm")
        used_ids = {int(r['vmid']) for r in cluster_resources}
        new_vmid = 20001
        while new_vmid in used_ids:
            new_vmid += 1
    except Exception:
        import random
        new_vmid = 20000 + random.randint(1, 999)
    
    lab_name = f"lab-{current_user['username']}-{new_vmid}"
    
    try:
        # Clone template (this returns immediately, Proxmox works in background)
        prox.nodes(PROXMOX_NODE).qemu(template_id).clone.post(
            newid=new_vmid,
            name=lab_name,
            full=1
        )
        
        # Save lab immediately with "cloning" status
        lab_doc = {
            "id": str(uuid.uuid4()),
            "exercise_id": data.exercise_id,
            "student_id": current_user["id"],
            "student_name": current_user["full_name"],
            "vmid": new_vmid,
            "vm_name": lab_name,
            "vm_ip": "en-attente",
            "guac_connection_id": None,
            "guac_url": None,
            "status": "cloning",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "stopped_at": None,
        }
        await db.labs.insert_one(lab_doc)
        
        # Launch background task to monitor clone, start VM, get IP, setup Guacamole
        import asyncio
        asyncio.create_task(_provision_lab_background(lab_doc["id"], new_vmid, lab_name, exercise))
        
        return {k: v for k, v in lab_doc.items() if k != "_id"}
    
    except Exception as e:
        logger.error(f"Lab provisioning failed: {e}")
        try:
            prox.nodes(PROXMOX_NODE).qemu(new_vmid).delete()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur de provisionnement: {str(e)}")


async def _provision_lab_background(lab_id: str, vmid: int, lab_name: str, exercise: dict):
    """Background task: wait for clone, start VM, get IP, create Guacamole connection."""
    try:
        prox = get_proxmox()
        node = PROXMOX_NODE
        host = os.environ.get('PROXMOX_HOST')
        port = os.environ.get('PROXMOX_PORT', 8006)
        
        # Phase 1: Wait for clone to finish (check lock, max 4 min)
        logger.info(f"[Lab {lab_id}] Waiting for clone of VM {vmid}...")
        clone_done = False
        for i in range(120):  # 120 * 2s = 4 min max
            await asyncio.sleep(2)
            try:
                vm_status = prox.nodes(node).qemu(vmid).status.current.get()
                if vm_status.get("lock") is None:
                    clone_done = True
                    logger.info(f"[Lab {lab_id}] Clone done after {i*2}s")
                    break
            except Exception:
                pass
        
        if not clone_done:
            logger.error(f"[Lab {lab_id}] Clone timeout for VM {vmid}")
            await db.labs.update_one({"id": lab_id}, {"$set": {"status": "error", "vm_ip": "Clone timeout - reessayez"}})
            return
        
        # Phase 2: Start VM (with retry if still transitioning)
        logger.info(f"[Lab {lab_id}] Starting VM {vmid}...")
        await db.labs.update_one({"id": lab_id}, {"$set": {"status": "starting"}})
        
        started = False
        for attempt in range(5):
            try:
                prox.nodes(node).qemu(vmid).status.start.post()
                started = True
                logger.info(f"[Lab {lab_id}] Start command sent (attempt {attempt+1})")
                break
            except Exception as e:
                logger.warning(f"[Lab {lab_id}] Start attempt {attempt+1} failed: {e}")
                await asyncio.sleep(5)
        
        if not started:
            logger.error(f"[Lab {lab_id}] Could not start VM {vmid}")
            await db.labs.update_one({"id": lab_id}, {"$set": {"status": "error", "vm_ip": "Impossible de demarrer la VM"}})
            return
        
        # Wait for VM to actually be running
        for i in range(15):
            await asyncio.sleep(2)
            try:
                st = prox.nodes(node).qemu(vmid).status.current.get()
                if st.get("status") == "running":
                    break
            except Exception:
                pass
        
        # Phase 3: Try to get IP via QEMU Guest Agent (max 2 min)
        logger.info(f"[Lab {lab_id}] Waiting for IP on VM {vmid}...")
        vm_ip = None
        for i in range(40):  # 40 * 3s = 2 min max
            await asyncio.sleep(3)
            try:
                ifaces = prox.nodes(node).qemu(vmid).agent("network-get-interfaces").get()
                for iface in ifaces.get("result", []):
                    for addr in iface.get("ip-addresses", []):
                        ip = addr.get("ip-address", "")
                        if ip and not ip.startswith("127.") and not ip.startswith("fe80") and ":" not in ip:
                            vm_ip = ip
                            break
                    if vm_ip:
                        break
            except Exception:
                pass
            if vm_ip:
                break
        
        # Phase 4: Setup remote access
        guac_conn_id = None
        guac_url = None
        
        if vm_ip:
            # Guest agent works -> use Guacamole RDP
            logger.info(f"[Lab {lab_id}] Got IP: {vm_ip}, setting up Guacamole RDP")
            try:
                guac_token = guac_auth()
                rdp_user = exercise.get("lab_username", "Administrator")
                rdp_pass = exercise.get("lab_password", "Lab2026!")
                conn = guac_create_connection(guac_token, lab_name, vm_ip, username=rdp_user, password=rdp_pass)
                guac_conn_id = str(conn.get("identifier", ""))
                conn_str = f"{guac_conn_id}\0c\0postgresql"
                encoded = base64.b64encode(conn_str.encode()).decode()
                guac_url = f"{GUAC_URL}/guacamole/#/client/{encoded}"
            except Exception as e:
                logger.error(f"[Lab {lab_id}] Guacamole failed: {e}")
        
        if not guac_url:
            # Fallback: Proxmox noVNC console
            logger.info(f"[Lab {lab_id}] No IP/Guacamole, using Proxmox noVNC fallback")
            guac_url = f"https://{host}:{port}/?console=kvm&novnc=1&vmid={vmid}&vmname={lab_name}&node={node}"
            vm_ip = vm_ip or "no-agent"
        
        # Update lab status
        update = {
            "status": "running",
            "vm_ip": vm_ip,
            "guac_connection_id": guac_conn_id,
            "guac_url": guac_url,
        }
        await db.labs.update_one({"id": lab_id}, {"$set": update})
        logger.info(f"[Lab {lab_id}] VM {vmid} ready! IP: {vm_ip}, URL: {guac_url[:60]}...")
    
    except Exception as e:
        logger.error(f"[Lab {lab_id}] Background provisioning error: {e}")
        await db.labs.update_one({"id": lab_id}, {"$set": {"status": "error", "vm_ip": str(e)}})

@api_router.get("/labs/status/{exercise_id}")
async def get_lab_status(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    query = {"exercise_id": exercise_id, "status": {"$in": ["running", "cloning", "starting"]}}
    if current_user["role"] == "etudiant":
        query["student_id"] = current_user["id"]
    lab = await db.labs.find_one(query, {"_id": 0})
    if not lab:
        # Also check for error state
        err_lab = await db.labs.find_one({"exercise_id": exercise_id, "student_id": current_user.get("id"), "status": "error"}, {"_id": 0})
        if err_lab:
            return err_lab
        return {"status": "not_started"}
    
    # Refresh IP if needed
    if lab.get("vm_ip") in ("en-attente", "no-agent", None):
        try:
            prox = get_proxmox()
            ifaces = prox.nodes(PROXMOX_NODE).qemu(lab["vmid"]).agent("network-get-interfaces").get()
            for iface in ifaces.get("result", []):
                for addr in iface.get("ip-addresses", []):
                    ip = addr.get("ip-address", "")
                    if ip and not ip.startswith("127.") and not ip.startswith("fe80") and ":" not in ip:
                        lab["vm_ip"] = ip
                        # Create guac connection now
                        try:
                            exercise = await db.exercises.find_one({"id": exercise_id}, {"_id": 0})
                            guac_token = guac_auth()
                            rdp_user = exercise.get("lab_username", "Administrator") if exercise else "Administrator"
                            rdp_pass = exercise.get("lab_password", "Lab2026!") if exercise else "Lab2026!"
                            conn = guac_create_connection(guac_token, lab["vm_name"], ip, username=rdp_user, password=rdp_pass)
                            guac_conn_id = str(conn.get("identifier", ""))
                            conn_str = f"{guac_conn_id}\0c\0postgresql"
                            encoded = base64.b64encode(conn_str.encode()).decode()
                            lab["guac_url"] = f"{GUAC_URL}/guacamole/#/client/{encoded}"
                            lab["guac_connection_id"] = guac_conn_id
                        except Exception:
                            lab["guac_url"] = f"{GUAC_URL}/guacamole/"
                        await db.labs.update_one({"id": lab["id"]}, {"$set": {"vm_ip": ip, "guac_url": lab.get("guac_url"), "guac_connection_id": lab.get("guac_connection_id")}})
                        break
        except Exception:
            # Guest agent not available - provide noVNC fallback if no URL yet
            if not lab.get("guac_url"):
                host = os.environ.get('PROXMOX_HOST')
                port = os.environ.get('PROXMOX_PORT', 8006)
                fallback_url = f"https://{host}:{port}/?console=kvm&novnc=1&vmid={lab['vmid']}&vmname={lab['vm_name']}&node={PROXMOX_NODE}"
                lab["guac_url"] = fallback_url
                lab["vm_ip"] = "no-agent"
                await db.labs.update_one({"id": lab["id"]}, {"$set": {"vm_ip": "no-agent", "guac_url": fallback_url}})
    return lab


@api_router.get("/labs/guac-url/{exercise_id}")
async def get_guac_url(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    """Generate a fresh Guacamole URL with a valid auth token."""
    query = {"exercise_id": exercise_id, "status": "running"}
    if current_user["role"] == "etudiant":
        query["student_id"] = current_user["id"]
    lab = await db.labs.find_one(query, {"_id": 0})
    if not lab:
        raise HTTPException(status_code=404, detail="Aucun lab en cours")
    
    if not lab.get("guac_connection_id"):
        # Fallback noVNC
        host = os.environ.get('PROXMOX_HOST')
        port = os.environ.get('PROXMOX_PORT', 8006)
        fallback = f"https://{host}:{port}/?console=kvm&novnc=1&vmid={lab['vmid']}&vmname={lab['vm_name']}&node={PROXMOX_NODE}"
        return {"url": fallback, "fallback": True}
    
    try:
        token = guac_auth()
        conn_id = lab["guac_connection_id"]
        conn_str = f"{conn_id}\0c\0postgresql"
        encoded = base64.b64encode(conn_str.encode()).decode()
        url = f"{GUAC_URL}/guacamole/#/client/{encoded}?token={token}"
        return {"url": url}
    except Exception as e:
        logger.error(f"Guacamole URL generation failed: {e}")
        host = os.environ.get('PROXMOX_HOST')
        port = os.environ.get('PROXMOX_PORT', 8006)
        fallback = f"https://{host}:{port}/?console=kvm&novnc=1&vmid={lab['vmid']}&vmname={lab['vm_name']}&node={PROXMOX_NODE}"
        return {"url": fallback, "fallback": True}



@api_router.post("/labs/stop/{exercise_id}")
async def stop_lab(exercise_id: str, current_user: dict = Depends(auth_dependency)):
    query = {"exercise_id": exercise_id, "status": "running"}
    if current_user["role"] == "etudiant":
        query["student_id"] = current_user["id"]
    lab = await db.labs.find_one(query, {"_id": 0})
    if not lab:
        raise HTTPException(status_code=404, detail="Aucun lab en cours")
    
    try:
        prox = get_proxmox()
        # Stop and destroy VM
        try:
            prox.nodes(PROXMOX_NODE).qemu(lab["vmid"]).status.stop.post()
        except Exception:
            pass
        import asyncio
        await asyncio.sleep(5)
        try:
            prox.nodes(PROXMOX_NODE).qemu(lab["vmid"]).delete()
        except Exception:
            pass
        # Delete Guacamole connection
        if lab.get("guac_connection_id"):
            try:
                guac_token = guac_auth()
                guac_delete_connection(guac_token, lab["guac_connection_id"])
            except Exception:
                pass
    except Exception as e:
        logger.error(f"Lab cleanup error: {e}")
    
    await db.labs.update_one({"id": lab["id"]}, {"$set": {"status": "stopped", "stopped_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Lab arrete et VM supprimee"}

@api_router.get("/labs/active")
async def get_active_labs(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    labs = await db.labs.find({"status": "running"}, {"_id": 0}).to_list(100)
    return labs


# Include router and middleware
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
