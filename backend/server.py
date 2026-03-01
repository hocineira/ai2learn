from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'sisr-io-secret-key-2026')
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ───

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "etudiant"

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    created_at: str

class ExerciseQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    question_type: str  # "qcm" or "open"
    options: List[str] = []
    correct_answer: str = ""
    points: int = 1

class ExerciseCreate(BaseModel):
    title: str
    description: str
    category: str
    questions: List[ExerciseQuestion]
    time_limit: int = 0  # minutes, 0 = no limit

class ExerciseOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    questions: list
    time_limit: int
    created_by: str
    created_by_name: str
    created_at: str
    submission_count: int = 0

class SubmissionAnswer(BaseModel):
    question_id: str
    answer: str

class SubmissionCreate(BaseModel):
    exercise_id: str
    answers: List[SubmissionAnswer]

class SubmissionOut(BaseModel):
    id: str
    exercise_id: str
    exercise_title: str
    student_id: str
    student_name: str
    answers: list
    score: Optional[float] = None
    max_score: float = 0
    ai_feedback: Optional[str] = None
    graded: bool = False
    submitted_at: str

class RoleUpdate(BaseModel):
    role: str

# ─── Auth Helpers ───

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    return jwt.encode({"user_id": user_id, "role": role}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifie")
    try:
        if token.startswith("Bearer "):
            token = token[7:]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur non trouve")
        return user
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

from fastapi import Header

async def auth_dependency(authorization: str = Header(None)):
    return await get_current_user(authorization)

# ─── Auth Routes ───

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"username": data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur deja pris")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": data.username,
        "password": hash_password(data.password),
        "full_name": data.full_name,
        "role": data.role if data.role in ["admin", "formateur", "etudiant"] else "etudiant",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_doc["role"])
    return {"token": token, "user": {"id": user_id, "username": data.username, "full_name": data.full_name, "role": user_doc["role"]}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"username": data.username}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "username": user["username"], "full_name": user["full_name"], "role": user["role"]}}

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(auth_dependency)):
    return {"id": current_user["id"], "username": current_user["username"], "full_name": current_user["full_name"], "role": current_user["role"]}

# ─── User Management (Admin) ───

@api_router.get("/users")
async def get_users(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: RoleUpdate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    if data.role not in ["admin", "formateur", "etudiant"]:
        raise HTTPException(status_code=400, detail="Role invalide")
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": data.role}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    return {"message": "Role mis a jour"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouve")
    return {"message": "Utilisateur supprime"}

# ─── Categories ───

CATEGORIES = [
    {"id": "admin-systeme", "name": "Administration Systeme", "icon": "Server"},
    {"id": "reseaux", "name": "Reseaux et Infrastructure", "icon": "Network"},
    {"id": "cybersecurite", "name": "Cybersecurite", "icon": "Shield"},
    {"id": "virtualisation", "name": "Virtualisation", "icon": "Cpu"},
    {"id": "services-infra", "name": "Services d'Infrastructure", "icon": "Database"},
    {"id": "scripting", "name": "Scripting et Automatisation", "icon": "Terminal"},
]

@api_router.get("/categories")
async def get_categories():
    return CATEGORIES

# ─── Exercise Routes ───

@api_router.post("/exercises")
async def create_exercise(data: ExerciseCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Formateur ou admin uniquement")
    
    exercise_id = str(uuid.uuid4())
    exercise_doc = {
        "id": exercise_id,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "questions": [q.model_dump() for q in data.questions],
        "time_limit": data.time_limit,
        "created_by": current_user["id"],
        "created_by_name": current_user["full_name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.exercises.insert_one(exercise_doc)
    return {**{k: v for k, v in exercise_doc.items() if k != "_id"}, "submission_count": 0}

@api_router.get("/exercises")
async def get_exercises(category: str = None, current_user: dict = Depends(auth_dependency)):
    query = {}
    if category:
        query["category"] = category
    exercises = await db.exercises.find(query, {"_id": 0}).to_list(1000)
    
    for ex in exercises:
        count = await db.submissions.count_documents({"exercise_id": ex["id"]})
        ex["submission_count"] = count
        # Hide correct answers for students
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
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "questions": [q.model_dump() for q in data.questions],
        "time_limit": data.time_limit,
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
    
    # Check if already submitted
    existing = await db.submissions.find_one({
        "exercise_id": data.exercise_id, 
        "student_id": current_user["id"]
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez deja soumis cet exercice")
    
    # Auto-grade QCM questions
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
    submission_doc = {
        "id": submission_id,
        "exercise_id": data.exercise_id,
        "exercise_title": exercise["title"],
        "student_id": current_user["id"],
        "student_name": current_user["full_name"],
        "answers": graded_answers,
        "score": score if not has_open_questions else None,
        "max_score": max_score,
        "ai_feedback": None,
        "graded": not has_open_questions,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.submissions.insert_one(submission_doc)
    
    # Trigger AI grading for open questions
    if has_open_questions and EMERGENT_LLM_KEY:
        try:
            await grade_submission_with_ai(submission_id)
        except Exception as e:
            logger.error(f"AI grading failed: {e}")
    
    updated = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    return updated

@api_router.get("/submissions")
async def get_submissions(exercise_id: str = None, current_user: dict = Depends(auth_dependency)):
    query = {}
    if current_user["role"] == "etudiant":
        query["student_id"] = current_user["id"]
    if exercise_id:
        query["exercise_id"] = exercise_id
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

async def grade_submission_with_ai(submission_id: str):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        return
    
    exercise = await db.exercises.find_one({"id": submission["exercise_id"]}, {"_id": 0})
    if not exercise:
        return
    
    # Build grading prompt
    prompt_parts = []
    total_open_points = 0
    for answer in submission["answers"]:
        question = next((q for q in exercise["questions"] if q["id"] == answer["question_id"]), None)
        if question and question["question_type"] == "open":
            total_open_points += question.get("points", 1)
            prompt_parts.append(
                f"Question ({question.get('points', 1)} pts): {question['question_text']}\n"
                f"Reponse attendue: {question.get('correct_answer', 'Pas de reponse type')}\n"
                f"Reponse etudiant: {answer['answer']}"
            )
    
    if not prompt_parts:
        return
    
    grading_prompt = (
        f"Tu es un correcteur pour le BTS SIO option SISR. "
        f"Evalue les reponses suivantes de l'etudiant. "
        f"Pour chaque question ouverte, attribue un score sur les points disponibles. "
        f"Reponds en JSON avec ce format exact: "
        f'{{"scores": [{{"question_id": "...", "points_earned": X, "feedback": "..."}}], "total_score": X, "general_feedback": "..."}}\n\n'
        + "\n\n".join(prompt_parts)
    )
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"grading-{submission_id}",
        system_message="Tu es un correcteur expert BTS SIO SISR. Tu notes avec precision et bienveillance. Reponds uniquement en JSON valide."
    )
    chat.with_model("openai", "gpt-5.2")
    
    response = await chat.send_message(UserMessage(text=grading_prompt))
    
    import json
    try:
        # Extract JSON from response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        result = json.loads(response_text)
        
        # Update answers with AI scores
        qcm_score = sum(a.get("points_earned", 0) for a in submission["answers"] if a.get("correct") is not None)
        ai_score = result.get("total_score", 0)
        
        # Update individual answer scores from AI
        for ai_item in result.get("scores", []):
            for answer in submission["answers"]:
                if answer["question_id"] == ai_item.get("question_id"):
                    answer["points_earned"] = ai_item.get("points_earned", 0)
                    answer["ai_feedback"] = ai_item.get("feedback", "")
        
        await db.submissions.update_one(
            {"id": submission_id},
            {"$set": {
                "answers": submission["answers"],
                "score": qcm_score + ai_score,
                "ai_feedback": result.get("general_feedback", ""),
                "graded": True
            }}
        )
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Failed to parse AI response: {e}")
        await db.submissions.update_one(
            {"id": submission_id},
            {"$set": {"ai_feedback": f"Evaluation IA en cours de traitement. Reponse brute: {response[:500]}", "graded": False}}
        )

@api_router.post("/grade/{submission_id}")
async def trigger_grading(submission_id: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="Cle API IA non configuree")
    await grade_submission_with_ai(submission_id)
    updated = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    return updated

# ─── Stats Routes ───

@api_router.get("/stats/overview")
async def get_overview_stats(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    total_students = await db.users.count_documents({"role": "etudiant"})
    total_formateurs = await db.users.count_documents({"role": "formateur"})
    total_exercises = await db.exercises.count_documents({})
    total_submissions = await db.submissions.count_documents({})
    graded_submissions = await db.submissions.count_documents({"graded": True})
    
    # Average score
    pipeline = [
        {"$match": {"graded": True, "score": {"$ne": None}}},
        {"$group": {"_id": None, "avg_score": {"$avg": {"$multiply": [{"$divide": ["$score", {"$max": ["$max_score", 1]}]}, 100]}}}}
    ]
    avg_result = await db.submissions.aggregate(pipeline).to_list(1)
    avg_score = avg_result[0]["avg_score"] if avg_result else 0
    
    # Recent submissions
    recent = await db.submissions.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(10)
    
    return {
        "total_students": total_students,
        "total_formateurs": total_formateurs,
        "total_exercises": total_exercises,
        "total_submissions": total_submissions,
        "graded_submissions": graded_submissions,
        "avg_score": round(avg_score, 1),
        "recent_submissions": recent
    }

@api_router.get("/stats/student")
async def get_student_stats(current_user: dict = Depends(auth_dependency)):
    submissions = await db.submissions.find({"student_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    total_exercises = await db.exercises.count_documents({})
    completed = len(submissions)
    graded = [s for s in submissions if s.get("graded")]
    
    avg_score = 0
    if graded:
        scores = [(s["score"] / max(s["max_score"], 1)) * 100 for s in graded if s.get("score") is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
    
    # Category breakdown
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
async def get_students_tracking(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    students = await db.users.find({"role": "etudiant"}, {"_id": 0, "password": 0}).to_list(1000)
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
            "exercises_completed": len(submissions),
            "avg_score": round(avg_score, 1),
            "last_activity": last_activity
        })
    
    return tracking

# ─── Seed Data ───

@api_router.post("/seed")
async def seed_data():
    admin_exists = await db.users.find_one({"username": "admin"}, {"_id": 0})
    if admin_exists:
        return {"message": "Donnees deja initialisees"}
    
    # Create admin
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": admin_id, "username": "admin", "password": hash_password("admin123"),
        "full_name": "Administrateur", "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create formateur
    formateur_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": formateur_id, "username": "formateur", "password": hash_password("formateur123"),
        "full_name": "Jean Dupont", "role": "formateur",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create students
    student_ids = []
    student_names = [("etudiant1", "Alice Martin"), ("etudiant2", "Bob Durand"), ("etudiant3", "Claire Petit")]
    for uname, fname in student_names:
        sid = str(uuid.uuid4())
        student_ids.append(sid)
        await db.users.insert_one({
            "id": sid, "username": uname, "password": hash_password("etudiant123"),
            "full_name": fname, "role": "etudiant",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Create sample exercises
    ex1_id = str(uuid.uuid4())
    await db.exercises.insert_one({
        "id": ex1_id,
        "title": "Les bases du reseau TCP/IP",
        "description": "Testez vos connaissances sur les fondamentaux du modele TCP/IP et les protocoles reseaux.",
        "category": "reseaux",
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Combien de couches comporte le modele TCP/IP ?", "question_type": "qcm", "options": ["3", "4", "5", "7"], "correct_answer": "4", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Quel protocole est utilise pour la resolution de noms de domaine ?", "question_type": "qcm", "options": ["HTTP", "DNS", "FTP", "SMTP"], "correct_answer": "DNS", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Expliquez la difference entre TCP et UDP. Donnez un exemple d'utilisation pour chacun.", "question_type": "open", "options": [], "correct_answer": "TCP est un protocole oriente connexion avec controle d'erreur. UDP est sans connexion, plus rapide. TCP: HTTP, FTP. UDP: DNS, streaming.", "points": 4},
        ],
        "time_limit": 15,
        "created_by": formateur_id,
        "created_by_name": "Jean Dupont",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    ex2_id = str(uuid.uuid4())
    await db.exercises.insert_one({
        "id": ex2_id,
        "title": "Administration Linux - Commandes de base",
        "description": "Evaluez vos competences sur les commandes essentielles de Linux.",
        "category": "admin-systeme",
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Quelle commande permet de lister les fichiers dans un repertoire ?", "question_type": "qcm", "options": ["dir", "ls", "list", "show"], "correct_answer": "ls", "points": 1},
            {"id": str(uuid.uuid4()), "question_text": "Quelle commande permet de changer les permissions d'un fichier ?", "question_type": "qcm", "options": ["chmod", "chown", "chperm", "setperm"], "correct_answer": "chmod", "points": 1},
            {"id": str(uuid.uuid4()), "question_text": "Decrivez les permissions rwx et expliquez comment fonctionne la notation octale (ex: 755).", "question_type": "open", "options": [], "correct_answer": "r=lecture(4), w=ecriture(2), x=execution(1). 755 = rwxr-xr-x. Proprietaire a tous les droits, groupe et autres ont lecture+execution.", "points": 4},
        ],
        "time_limit": 10,
        "created_by": formateur_id,
        "created_by_name": "Jean Dupont",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    ex3_id = str(uuid.uuid4())
    await db.exercises.insert_one({
        "id": ex3_id,
        "title": "Securite des systemes d'information",
        "description": "Questions sur les concepts fondamentaux de la cybersecurite.",
        "category": "cybersecurite",
        "questions": [
            {"id": str(uuid.uuid4()), "question_text": "Qu'est-ce qu'une attaque par deni de service (DoS) ?", "question_type": "qcm", "options": ["Vol de donnees", "Saturation d'un service", "Usurpation d'identite", "Injection SQL"], "correct_answer": "Saturation d'un service", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Quel protocole assure le chiffrement des communications web ?", "question_type": "qcm", "options": ["HTTP", "FTP", "TLS/SSL", "SNMP"], "correct_answer": "TLS/SSL", "points": 2},
            {"id": str(uuid.uuid4()), "question_text": "Expliquez le principe du chiffrement asymetrique et donnez un exemple d'algorithme utilise.", "question_type": "open", "options": [], "correct_answer": "Le chiffrement asymetrique utilise une paire de cles (publique/privee). La cle publique chiffre, la cle privee dechiffre. Exemple: RSA, ECC.", "points": 4},
        ],
        "time_limit": 15,
        "created_by": formateur_id,
        "created_by_name": "Jean Dupont",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Donnees initialisees", "credentials": {
        "admin": {"username": "admin", "password": "admin123"},
        "formateur": {"username": "formateur", "password": "formateur123"},
        "etudiants": {"username": "etudiant1/etudiant2/etudiant3", "password": "etudiant123"}
    }}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
