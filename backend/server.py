from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Header, UploadFile, File, Form, Request
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
import platform
import subprocess
import re
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

# ─── LLM Provider Detection ───
LLM_PROVIDER = None  # "emergent", "google", or None
LLM_KEY = None
LLM_KEY_DB = None  # Key from DB settings (user-configured via admin panel)
LLM_PROVIDER_DB = None
HAS_EMERGENT_LLM = False
EMERGENT_KEY_ENV = EMERGENT_LLM_KEY  # Keep original .env key for fallback

def detect_llm_provider(key: str):
    """Detect LLM provider from API key format"""
    if not key:
        return None, False
    if key.startswith("AIzaSy"):
        return "google", True
    if key.startswith("sk-emergent") or key.startswith("sk-"):
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            return "emergent", True
        except ImportError:
            logger.warning("emergentintegrations non installe")
            return None, False
    return None, False

def init_llm():
    global LLM_PROVIDER, LLM_KEY, HAS_EMERGENT_LLM, EMERGENT_LLM_KEY
    key = EMERGENT_LLM_KEY
    if key:
        provider, available = detect_llm_provider(key)
        LLM_PROVIDER = provider
        LLM_KEY = key
        HAS_EMERGENT_LLM = available
        logger.info(f"LLM Provider (.env): {provider or 'aucun'} - {'actif' if available else 'inactif'}")
    else:
        logger.info("Aucune cle LLM dans .env - correction IA desactivee (configurable via Parametres)")

init_llm()

async def _load_db_llm_key():
    """Load LLM key from DB settings (set by admin via Settings page)"""
    global LLM_KEY_DB, LLM_PROVIDER_DB
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0})
    if settings and settings.get("llm_key"):
        LLM_KEY_DB = settings["llm_key"]
        provider, _ = detect_llm_provider(LLM_KEY_DB)
        LLM_PROVIDER_DB = provider
        return LLM_KEY_DB, LLM_PROVIDER_DB
    return None, None

async def _call_google(api_key: str, system_message: str, user_message: str) -> str:
    """Call Google Gemini with current model names"""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    
    # Updated model names - July 2025 valid models
    models_to_try = ["gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]
    last_error = None
    
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_message
            )
            response = model.generate_content(user_message)
            logger.info(f"LLM Google repondu avec {model_name}")
            return response.text
        except Exception as e:
            last_error = e
            error_str = str(e)
            if "429" in error_str or "quota" in error_str.lower() or "exhausted" in error_str.lower():
                logger.warning(f"Quota depasse pour {model_name}, essai suivant...")
                continue
            elif "not found" in error_str.lower() or "not supported" in error_str.lower():
                logger.warning(f"Modele {model_name} non disponible, essai suivant...")
                continue
            else:
                logger.warning(f"Erreur Google {model_name}: {error_str[:100]}")
                continue
    
    raise Exception(f"Google Gemini: tous les modeles ont echoue. Derniere erreur: {str(last_error)[:150]}")

async def _call_emergent(api_key: str, system_message: str, user_message: str, session_id: str) -> str:
    """Call Emergent/OpenAI"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    )
    chat.with_model("openai", "gpt-4.1-nano")
    response = await chat.send_message(UserMessage(text=user_message))
    return response

async def call_llm(system_message: str, user_message: str, session_id: str = "grading") -> str:
    """Universal LLM call - tries DB key first, then .env Emergent key as fallback"""
    
    # 1. Try to load user-configured key from DB (admin panel)
    db_key, db_provider = await _load_db_llm_key()
    
    # 2. Determine keys to try in order: DB key first, then .env Emergent key as fallback
    attempts = []
    if db_key and db_provider:
        attempts.append(("db", db_key, db_provider))
    if EMERGENT_KEY_ENV:
        env_provider, env_available = detect_llm_provider(EMERGENT_KEY_ENV)
        if env_available and not (db_key and db_key == EMERGENT_KEY_ENV):
            attempts.append(("env", EMERGENT_KEY_ENV, env_provider))
    
    # Also check current global LLM_KEY if different
    if LLM_KEY and not any(a[1] == LLM_KEY for a in attempts):
        provider, available = detect_llm_provider(LLM_KEY)
        if available:
            attempts.append(("global", LLM_KEY, provider))
    
    if not attempts:
        raise Exception("Aucune cle LLM configuree. Allez dans Parametres pour ajouter une cle API.")
    
    last_error = None
    for source, key, provider in attempts:
        try:
            if provider == "google":
                result = await _call_google(key, system_message, user_message)
                logger.info(f"LLM OK via Google (source: {source})")
                return result
            elif provider == "emergent":
                result = await _call_emergent(key, system_message, user_message, session_id)
                logger.info(f"LLM OK via Emergent (source: {source})")
                return result
        except Exception as e:
            last_error = e
            logger.warning(f"LLM echoue ({source}/{provider}): {str(e)[:120]} - essai suivant...")
            continue
    
    raise Exception(f"Correction IA impossible. {str(last_error)[:200]}")

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
    email: str
    password: str
    full_name: str
    role: str = "etudiant"
    formation: str = "bts-sio-sisr"

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdate(BaseModel):
    role: Optional[str] = None
    formation: Optional[str] = None
    new_password: Optional[str] = None
    email: Optional[str] = None  # Admin can change user email

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
    exam_mode: bool = False  # Fullscreen + anti-copy
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
    exercise_id: Optional[str] = None
    title: str
    content: str = ""
    cover_image: Optional[str] = None  # Cover/thumbnail image filename
    video_filename: Optional[str] = None
    images: List[str] = []  # List of illustration image filenames
    objectives: List[str] = []
    prerequisites: List[str] = []
    duration_estimate: Optional[str] = None
    formation: Optional[str] = None
    category: Optional[str] = None

class CourseUpdate(BaseModel):
    exercise_id: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = None  # Cover/thumbnail image filename
    video_filename: Optional[str] = None
    images: Optional[List[str]] = None  # List of illustration image filenames
    objectives: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None
    duration_estimate: Optional[str] = None
    formation: Optional[str] = None
    category: Optional[str] = None

# Upload directories
UPLOAD_DIR = ROOT_DIR / "uploads" / "videos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_IMAGES_DIR = ROOT_DIR / "uploads" / "images"
UPLOAD_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

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
        "id": user["id"], "email": user.get("email", user.get("username", "")),
        "username": user.get("email", user.get("username", "")),
        "full_name": user["full_name"], "role": user["role"],
        "formation": user.get("formation", "bts-sio-sisr")
    }

# ─── Auth Routes ───

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")
    
    valid_formations = [f["id"] for f in FORMATIONS]
    formation = data.formation if data.formation in valid_formations else "bts-sio-sisr"
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": data.email,
        "username": data.email,
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
async def login(data: UserLogin, request: Request):
    client_ip = request.headers.get("x-forwarded-for", request.headers.get("x-real-ip", request.client.host if request.client else "unknown"))
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Search by email or legacy username
    user = await db.users.find_one({"$or": [{"email": data.email}, {"username": data.email}]}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        # Log failed attempt
        try:
            await db.login_attempts.insert_one({
                "id": str(uuid.uuid4()),
                "email": data.email,
                "ip": client_ip,
                "user_agent": user_agent,
                "success": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    
    token = create_token(user["id"], user["role"])
    
    # Log successful login
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_name": user.get("full_name", ""),
            "user_email": user.get("email", user.get("username", "")),
            "role": user.get("role", ""),
            "ip": client_ip,
            "user_agent": user_agent,
            "logged_at": now_iso,
        })
        await db.login_attempts.insert_one({
            "id": str(uuid.uuid4()),
            "email": data.email,
            "ip": client_ip,
            "user_agent": user_agent,
            "success": True,
            "timestamp": now_iso,
        })
        # Track active session
        await db.active_sessions.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "user_id": user["id"],
                "user_name": user.get("full_name", ""),
                "user_email": user.get("email", ""),
                "role": user.get("role", ""),
                "ip": client_ip,
                "user_agent": user_agent,
                "last_seen": now_iso,
            }},
            upsert=True
        )
    except Exception:
        pass
    
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
    if data.new_password and data.new_password.strip():
        update["password"] = hash_password(data.new_password.strip())
    if data.email and data.email.strip():
        new_email = data.email.strip().lower()
        # Check if email is already taken by another user
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est deja utilise par un autre utilisateur")
        update["email"] = new_email
        update["username"] = new_email  # Keep username in sync
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
        "exam_mode": data.exam_mode,
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
        "exam_mode": data.exam_mode,
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
    
    if has_open_questions:
        # Try AI grading - will use DB key, .env Emergent key, or any available provider
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
    # Check if any LLM is available (DB key, .env key, or global)
    db_key, _ = await _load_db_llm_key()
    if not db_key and not EMERGENT_KEY_ENV and not LLM_KEY:
        logger.warning("Correction IA impossible: aucune cle LLM configuree")
        return
    
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
            "IMPORTANT: Des scripts PowerShell ont ete executes sur la VM de l'etudiant pour verifier son travail pratique. "
            "Prends en compte ces resultats dans ton evaluation. Un etudiant qui a correctement configure sa VM "
            "mais mal repondu aux questions doit quand meme avoir des points. "
            "Inversement, un etudiant qui repond bien mais n'a rien fait sur la VM perd des points. "
        )
    
    grading_prompt += (
        "Pour chaque question ouverte, attribue un score sur les points disponibles. "
        "IMPORTANT: Utilise exactement les Question ID fournis dans ta reponse. "
        "Reponds en JSON avec ce format exact: "
        '{"scores": [{"question_id": "COPIE_LE_QUESTION_ID_ICI", "points_earned": X, "feedback": "..."}], '
        '"total_score": X, "general_feedback": "...", '
        '"vm_validation_summary": "Resume des verifications VM"}\n\n'
        + "\n\n".join(prompt_parts)
        + vm_context
    )
    
    system_msg = f"Tu es un correcteur expert de la formation {formation_name} a l'academie NETBFRS. Tu notes avec precision et bienveillance. Reponds uniquement en JSON valide."
    
    try:
        response = await call_llm(system_msg, grading_prompt, session_id=f"grading-{submission_id}")
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        await db.submissions.update_one(
            {"id": submission_id},
            {"$set": {"ai_feedback": f"Erreur correction IA: {str(e)[:100]}", "graded": False}}
        )
        return
    
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
        
        # Send notification to student
        try:
            score_msg = f"{score_20}/20" if score_20 is not None else "en cours"
            await create_notification(
                user_id=submission["student_id"],
                title="Correction terminee",
                message=f"Votre exercice '{exercise.get('title', '')}' a ete corrige. Note: {score_msg}",
                notif_type="grading",
                link=f"/results/{submission_id}"
            )
        except Exception as notif_err:
            logger.warning(f"Failed to create notification: {notif_err}")
        
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
    # Check if any LLM key is available
    db_key, _ = await _load_db_llm_key()
    if not db_key and not EMERGENT_KEY_ENV and not LLM_KEY:
        raise HTTPException(status_code=500, detail="Correction IA non disponible (aucune cle configuree). Allez dans Parametres pour ajouter une cle.")
    
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


# ─── Settings (Admin) ───

@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(auth_dependency)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0})
    
    result = {"key": "global", "llm_key_set": False, "llm_key_masked": "", "llm_provider": LLM_PROVIDER or "aucun", "llm_active": bool(LLM_KEY)}
    
    if settings:
        key_val = settings.get("llm_key", "")
        if key_val:
            result["llm_key_masked"] = key_val[:8] + "..." + key_val[-4:] if len(key_val) > 12 else "****"
            result["llm_key_set"] = True
            provider, _ = detect_llm_provider(key_val)
            result["llm_provider"] = provider or "inconnu"
    elif LLM_KEY:
        result["llm_key_set"] = True
        result["llm_key_masked"] = LLM_KEY[:8] + "..." + LLM_KEY[-4:] if len(LLM_KEY) > 12 else "****"
        result["llm_provider"] = LLM_PROVIDER or "inconnu"
    return result

class SettingsUpdate(BaseModel):
    llm_key: Optional[str] = None

@api_router.put("/settings")
async def update_settings(data: SettingsUpdate, current_user: dict = Depends(auth_dependency)):
    global EMERGENT_LLM_KEY, HAS_EMERGENT_LLM, LLM_KEY, LLM_PROVIDER
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    update = {"key": "global", "updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.llm_key is not None:
        update["llm_key"] = data.llm_key
        LLM_KEY = data.llm_key if data.llm_key else None
        EMERGENT_LLM_KEY = LLM_KEY
        if LLM_KEY:
            provider, available = detect_llm_provider(LLM_KEY)
            LLM_PROVIDER = provider
            HAS_EMERGENT_LLM = available
            logger.info(f"Cle LLM mise a jour - Provider: {provider}, Actif: {available}")
        else:
            LLM_PROVIDER = None
            HAS_EMERGENT_LLM = False
    
    await db.settings.update_one({"key": "global"}, {"$set": update}, upsert=True)
    return {"message": "Parametres mis a jour", "llm_active": bool(LLM_KEY), "llm_provider": LLM_PROVIDER or "aucun"}

@api_router.put("/profile")
async def update_profile(current_user: dict = Depends(auth_dependency)):
    """Get current user profile data"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return user

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

@api_router.post("/profile/update")
async def update_user_profile(data: ProfileUpdate, current_user: dict = Depends(auth_dependency)):
    update = {}
    if data.full_name and data.full_name.strip():
        update["full_name"] = data.full_name.strip()
    
    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Mot de passe actuel requis")
        user_full = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        if not verify_password(data.current_password, user_full["password"]):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
        update["password"] = hash_password(data.new_password)
    
    if not update:
        raise HTTPException(status_code=400, detail="Rien a mettre a jour")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update})
    return {"message": "Profil mis a jour"}

class PasswordChangeRequest(BaseModel):
    reason: Optional[str] = None

@api_router.post("/password-change-request")
async def request_password_change(data: PasswordChangeRequest, current_user: dict = Depends(auth_dependency)):
    """Student requests a password change - notifies all admins"""
    # Check if there's already a pending request
    existing = await db.password_requests.find_one({
        "user_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez deja une demande en cours")
    
    # Create the request
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "user_email": current_user.get("email", current_user.get("username", "")),
        "reason": data.reason or "Changement de mot de passe demande",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.password_requests.insert_one(request_doc)
    
    # Notify all admins
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for admin in admins:
        await create_notification(
            user_id=admin["id"],
            title="Demande de changement de mot de passe",
            message=f"{current_user['full_name']} ({current_user.get('email', '')}) demande un changement de mot de passe. Raison: {data.reason or 'Non precisee'}",
            notif_type="password_request",
            link=f"/users"
        )
    
    return {"message": "Demande envoyee. L'administrateur sera notifie."}

@api_router.get("/password-requests")
async def get_password_requests(current_user: dict = Depends(auth_dependency)):
    """Admin: get all password change requests"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    requests = await db.password_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.put("/password-requests/{request_id}")
async def handle_password_request(request_id: str, current_user: dict = Depends(auth_dependency)):
    """Admin: mark a password request as handled"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    result = await db.password_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "done", "handled_by": current_user["id"], "handled_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    
    # Notify the student
    req = await db.password_requests.find_one({"id": request_id}, {"_id": 0})
    if req:
        await create_notification(
            user_id=req["user_id"],
            title="Mot de passe modifie",
            message="L'administrateur a modifie votre mot de passe. Contactez-le pour obtenir votre nouveau mot de passe.",
            notif_type="info",
        )
    
    return {"message": "Demande traitee"}


# ─── Email Change Request ───

class EmailChangeRequest(BaseModel):
    new_email: str
    reason: Optional[str] = None

@api_router.post("/email-change-request")
async def request_email_change(data: EmailChangeRequest, current_user: dict = Depends(auth_dependency)):
    """User/Formateur requests an email change - notifies all admins"""
    if current_user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Les admins peuvent changer leur email directement")
    
    new_email = data.new_email.strip().lower()
    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="Email invalide")
    
    # Check if email is already taken
    existing = await db.users.find_one({"email": new_email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est deja utilise")
    
    # Check if there's already a pending request for this user
    existing_req = await db.email_change_requests.find_one({
        "user_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0})
    if existing_req:
        raise HTTPException(status_code=400, detail="Vous avez deja une demande en cours")
    
    request_id = str(uuid.uuid4())
    request_doc = {
        "id": request_id,
        "user_id": current_user["id"],
        "user_name": current_user["full_name"],
        "user_email": current_user.get("email", current_user.get("username", "")),
        "new_email": new_email,
        "reason": data.reason or "Changement d'email demande",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.email_change_requests.insert_one(request_doc)
    
    # Notify all admins
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for admin in admins:
        await create_notification(
            user_id=admin["id"],
            title="Demande de changement d'email",
            message=f"{current_user['full_name']} ({current_user.get('email', '')}) demande a changer son email vers {new_email}. Raison: {data.reason or 'Non precisee'}",
            notif_type="email_change_request",
            link="/users"
        )
    
    return {"message": "Demande envoyee. L'administrateur sera notifie."}

@api_router.get("/email-change-requests")
async def get_email_change_requests(current_user: dict = Depends(auth_dependency)):
    """Admin: get all email change requests"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    requests = await db.email_change_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.put("/email-change-requests/{request_id}")
async def handle_email_change_request(request_id: str, action: str = "approve", current_user: dict = Depends(auth_dependency)):
    """Admin: approve or reject an email change request"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    req = await db.email_change_requests.find_one({"id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Demande non trouvee")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Cette demande a deja ete traitee")
    
    if action == "approve":
        new_email = req["new_email"]
        # Verify email isn't taken
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": req["user_id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Cet email est deja utilise par un autre utilisateur")
        
        # Update user email
        await db.users.update_one(
            {"id": req["user_id"]},
            {"$set": {"email": new_email, "username": new_email}}
        )
        
        # Mark request as approved
        await db.email_change_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "approved", "handled_by": current_user["id"], "handled_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Notify user
        await create_notification(
            user_id=req["user_id"],
            title="Email modifie",
            message=f"Votre email a ete change de {req['user_email']} vers {new_email}. Utilisez votre nouvel email pour vous connecter.",
            notif_type="info",
        )
        
        return {"message": f"Email change de {req['user_email']} vers {new_email}"}
    
    elif action == "reject":
        await db.email_change_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "rejected", "handled_by": current_user["id"], "handled_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Notify user
        await create_notification(
            user_id=req["user_id"],
            title="Demande d'email refusee",
            message=f"Votre demande de changement d'email vers {req['new_email']} a ete refusee par l'administrateur.",
            notif_type="warning",
        )
        
        return {"message": "Demande refusee"}
    
    else:
        raise HTTPException(status_code=400, detail="Action invalide. Utilisez 'approve' ou 'reject'")

@api_router.get("/my-email-change-request")
async def get_my_email_change_request(current_user: dict = Depends(auth_dependency)):
    """Get the current user's pending email change request"""
    req = await db.email_change_requests.find_one({
        "user_id": current_user["id"],
        "status": "pending"
    }, {"_id": 0})
    return req


# ─── Login History ───

@api_router.get("/login-history")
async def get_login_history(current_user: dict = Depends(auth_dependency)):
    """Admin: get login history with IP"""
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    history = await db.login_history.find({}, {"_id": 0}).sort("logged_at", -1).to_list(200)
    return history

# ─── Server Monitoring ───

@api_router.get("/monitoring/active-sessions")
async def get_active_sessions(current_user: dict = Depends(auth_dependency)):
    """Admin: get currently active sessions"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    sessions = await db.active_sessions.find({}, {"_id": 0}).to_list(500)
    return sessions

@api_router.get("/monitoring/login-attempts")
async def get_login_attempts(current_user: dict = Depends(auth_dependency)):
    """Admin: get all login attempts (success + failed)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    attempts = await db.login_attempts.find({}, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return attempts

@api_router.get("/monitoring/brute-force")
async def get_brute_force_stats(current_user: dict = Depends(auth_dependency)):
    """Admin: detect brute force attempts - IPs/emails with many failed attempts"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    # Failed attempts in last 24h
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    failed = await db.login_attempts.find(
        {"success": False, "timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ).to_list(5000)
    
    # Group by IP
    ip_counts = {}
    email_counts = {}
    for f in failed:
        ip = f.get("ip", "unknown")
        email = f.get("email", "unknown")
        ip_counts[ip] = ip_counts.get(ip, 0) + 1
        email_counts[email] = email_counts.get(email, 0) + 1
    
    suspicious_ips = [{"ip": ip, "attempts": count} for ip, count in sorted(ip_counts.items(), key=lambda x: -x[1]) if count >= 3]
    suspicious_emails = [{"email": email, "attempts": count} for email, count in sorted(email_counts.items(), key=lambda x: -x[1]) if count >= 3]
    
    # Total stats
    total_failed_24h = len(failed)
    total_success_24h = await db.login_attempts.count_documents({"success": True, "timestamp": {"$gte": cutoff}})
    
    return {
        "total_failed_24h": total_failed_24h,
        "total_success_24h": total_success_24h,
        "suspicious_ips": suspicious_ips,
        "suspicious_emails": suspicious_emails,
        "recent_failed": failed[:20],
    }

@api_router.get("/monitoring/server-stats")
async def get_server_stats(current_user: dict = Depends(auth_dependency)):
    """Admin: get server statistics"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    total_users = await db.users.count_documents({})
    total_students = await db.users.count_documents({"role": "etudiant"})
    total_exercises = await db.exercises.count_documents({})
    total_submissions = await db.submissions.count_documents({})
    total_courses = await db.courses.count_documents({})
    total_notifications = await db.notifications.count_documents({})
    active_sessions = await db.active_sessions.count_documents({})
    
    # DB collections sizes
    collections = await db.list_collection_names()
    db_stats = {}
    for col in collections:
        count = await db[col].count_documents({})
        db_stats[col] = count
    
    return {
        "server": {
            "python_version": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
            "hostname": platform.node(),
            "architecture": platform.machine(),
        },
        "database": {
            "total_users": total_users,
            "total_students": total_students,
            "total_exercises": total_exercises,
            "total_submissions": total_submissions,
            "total_courses": total_courses,
            "total_notifications": total_notifications,
            "active_sessions": active_sessions,
            "collections": db_stats,
        },
    }

# ─── System Updates Management ───

async def _run_cmd(cmd: list, timeout: int = 120) -> dict:
    """Run a shell command asynchronously and return stdout/stderr/returncode"""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "stdout": stdout.decode("utf-8", errors="replace"),
            "stderr": stderr.decode("utf-8", errors="replace"),
            "returncode": proc.returncode,
        }
    except asyncio.TimeoutError:
        proc.kill()
        return {"stdout": "", "stderr": "Commande timeout", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}


def _parse_upgradable(output: str) -> list:
    """Parse apt list --upgradable output into structured data"""
    packages = []
    for line in output.strip().split("\n"):
        if "/" not in line or "Listing..." in line:
            continue
        try:
            # Format: package_name/source version_new arch [upgradable from: version_old]
            match = re.match(r'^(\S+)/(\S+)\s+(\S+)\s+(\S+)(?:\s+\[upgradable from:\s+(\S+)\])?', line)
            if match:
                pkg_name = match.group(1)
                source = match.group(2)
                new_version = match.group(3)
                arch = match.group(4)
                old_version = match.group(5) or "inconnu"
                packages.append({
                    "name": pkg_name,
                    "source": source,
                    "current_version": old_version,
                    "new_version": new_version,
                    "arch": arch,
                })
        except Exception:
            continue
    return packages


@api_router.get("/system/check-updates")
async def check_system_updates(current_user: dict = Depends(auth_dependency)):
    """Admin: check for available system updates (apt update + list upgradable)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    # apt update
    update_res = await _run_cmd(["apt-get", "update", "-qq"], timeout=120)
    if update_res["returncode"] != 0:
        logger.warning(f"apt update stderr: {update_res['stderr']}")
    
    # List upgradable
    list_res = await _run_cmd(["apt", "list", "--upgradable"], timeout=30)
    packages = _parse_upgradable(list_res["stdout"])
    
    # Get system info
    os_info = ""
    try:
        lsb = await _run_cmd(["lsb_release", "-ds"], timeout=5)
        os_info = lsb["stdout"].strip()
    except Exception:
        os_info = f"{platform.system()} {platform.release()}"
    
    # Get last update time from apt history
    last_update = None
    try:
        hist_res = await _run_cmd(["stat", "-c", "%Y", "/var/cache/apt/pkgcache.bin"], timeout=5)
        if hist_res["returncode"] == 0:
            ts = int(hist_res["stdout"].strip())
            last_update = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        pass
    
    # Save check to DB for history
    await db.system_update_checks.insert_one({
        "id": str(uuid.uuid4()),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "packages_available": len(packages),
        "checked_by": current_user["id"],
    })
    
    return {
        "packages": packages,
        "total_upgradable": len(packages),
        "os_info": os_info,
        "last_cache_update": last_update,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/system/upgradable")
async def list_upgradable_packages(current_user: dict = Depends(auth_dependency)):
    """Admin: list currently upgradable packages without running apt update"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    list_res = await _run_cmd(["apt", "list", "--upgradable"], timeout=30)
    packages = _parse_upgradable(list_res["stdout"])
    
    return {"packages": packages, "total_upgradable": len(packages)}


class SystemUpdateApply(BaseModel):
    packages: Optional[List[str]] = None  # None = upgrade all, list = specific packages
    security_only: bool = False


@api_router.post("/system/apply-updates")
async def apply_system_updates(data: SystemUpdateApply, current_user: dict = Depends(auth_dependency)):
    """Admin: apply system updates (all or selected packages)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    update_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    
    # Save update start to DB
    update_doc = {
        "id": update_id,
        "started_at": started_at,
        "status": "in_progress",
        "packages_requested": data.packages or ["all"],
        "applied_by": current_user["id"],
        "applied_by_name": current_user["full_name"],
        "output": "",
        "error": "",
    }
    await db.system_updates.insert_one(update_doc)
    
    # Build the command
    if data.packages and len(data.packages) > 0:
        # Install specific packages
        cmd = ["apt-get", "install", "-y", "--only-upgrade"] + data.packages
    else:
        # Full upgrade
        cmd = ["apt-get", "upgrade", "-y"]
    
    # Set DEBIAN_FRONTEND=noninteractive
    env_cmd = ["env", "DEBIAN_FRONTEND=noninteractive"] + cmd
    
    result = await _run_cmd(env_cmd, timeout=300)
    
    finished_at = datetime.now(timezone.utc).isoformat()
    status = "success" if result["returncode"] == 0 else "error"
    
    # Parse updated packages from output
    updated_packages = []
    for line in result["stdout"].split("\n"):
        if line.startswith("Setting up ") or line.startswith("Unpacking "):
            pkg_match = re.match(r'(?:Setting up|Unpacking)\s+(\S+)\s+\((\S+)\)', line)
            if pkg_match:
                updated_packages.append({
                    "name": pkg_match.group(1),
                    "version": pkg_match.group(2),
                })
    
    # Update DB record
    await db.system_updates.update_one(
        {"id": update_id},
        {"$set": {
            "status": status,
            "finished_at": finished_at,
            "output": result["stdout"][-5000:],  # Keep last 5k chars
            "error": result["stderr"][-2000:],
            "updated_packages": updated_packages,
            "packages_count": len(updated_packages),
        }}
    )
    
    return {
        "id": update_id,
        "status": status,
        "packages_updated": len(updated_packages),
        "updated_packages": updated_packages,
        "output_preview": result["stdout"][-2000:],
        "error": result["stderr"][-1000:] if result["returncode"] != 0 else "",
        "started_at": started_at,
        "finished_at": finished_at,
    }


@api_router.get("/system/changelog/{package_name}")
async def get_package_changelog(package_name: str, current_user: dict = Depends(auth_dependency)):
    """Admin: get changelog/patch notes for a specific package"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    # Sanitize package name
    safe_name = re.sub(r'[^a-zA-Z0-9._\-+]', '', package_name)
    if not safe_name:
        raise HTTPException(status_code=400, detail="Nom de package invalide")
    
    # Try apt changelog
    result = await _run_cmd(["apt-get", "changelog", safe_name], timeout=30)
    
    if result["returncode"] == 0 and result["stdout"].strip():
        # Parse changelog - get first ~50 lines (most recent changes)
        lines = result["stdout"].strip().split("\n")
        changelog_preview = "\n".join(lines[:80])
        
        # Try to extract version entries
        entries = []
        current_entry = None
        for line in lines[:200]:
            # Changelog entry header: package (version) distro; urgency=level
            header_match = re.match(r'^(\S+)\s+\(([^)]+)\)\s+(\S+);\s+urgency=(\S+)', line)
            if header_match:
                if current_entry:
                    entries.append(current_entry)
                current_entry = {
                    "package": header_match.group(1),
                    "version": header_match.group(2),
                    "distribution": header_match.group(3),
                    "urgency": header_match.group(4),
                    "changes": [],
                    "author": "",
                    "date": "",
                }
            elif current_entry and line.startswith("  * "):
                current_entry["changes"].append(line.strip()[2:])
            elif current_entry and line.startswith("  - "):
                current_entry["changes"].append(line.strip()[2:])
            elif current_entry and line.startswith(" -- "):
                current_entry["author"] = line.strip()[3:].strip()
                # Extract date
                date_match = re.search(r'>\s+(.+)$', line)
                if date_match:
                    current_entry["date"] = date_match.group(1).strip()
        
        if current_entry:
            entries.append(current_entry)
        
        return {
            "package": safe_name,
            "changelog_raw": changelog_preview,
            "entries": entries[:10],  # Return up to 10 most recent entries
            "available": True,
        }
    
    # Try dpkg info as fallback
    info_res = await _run_cmd(["dpkg", "-s", safe_name], timeout=10)
    description = ""
    if info_res["returncode"] == 0:
        for line in info_res["stdout"].split("\n"):
            if line.startswith("Description:"):
                description = line.split(":", 1)[1].strip()
                break
    
    return {
        "package": safe_name,
        "changelog_raw": f"Changelog non disponible pour {safe_name}",
        "entries": [],
        "description": description,
        "available": False,
    }


@api_router.get("/system/update-history")
async def get_update_history(current_user: dict = Depends(auth_dependency)):
    """Admin: get history of system updates applied through the panel"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    history = await db.system_updates.find({}, {"_id": 0, "output": 0}).sort("started_at", -1).to_list(50)
    return history


@api_router.get("/system/update-detail/{update_id}")
async def get_update_detail(update_id: str, current_user: dict = Depends(auth_dependency)):
    """Admin: get detailed info about a specific update"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    update = await db.system_updates.find_one({"id": update_id}, {"_id": 0})
    if not update:
        raise HTTPException(status_code=404, detail="Mise a jour non trouvee")
    return update


@api_router.get("/system/info")
async def get_system_info(current_user: dict = Depends(auth_dependency)):
    """Admin: get detailed system information"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin uniquement")
    
    info = {
        "os": f"{platform.system()} {platform.release()}",
        "python_version": platform.python_version(),
        "hostname": platform.node(),
        "architecture": platform.machine(),
        "processor": platform.processor() or "N/A",
    }
    
    # OS details
    try:
        lsb = await _run_cmd(["lsb_release", "-a"], timeout=5)
        if lsb["returncode"] == 0:
            for line in lsb["stdout"].split("\n"):
                if "Description:" in line:
                    info["os_description"] = line.split(":", 1)[1].strip()
                elif "Release:" in line:
                    info["os_release"] = line.split(":", 1)[1].strip()
                elif "Codename:" in line:
                    info["os_codename"] = line.split(":", 1)[1].strip()
    except Exception:
        pass
    
    # Kernel version
    try:
        uname = await _run_cmd(["uname", "-r"], timeout=5)
        if uname["returncode"] == 0:
            info["kernel"] = uname["stdout"].strip()
    except Exception:
        pass
    
    # Uptime
    try:
        uptime = await _run_cmd(["uptime", "-p"], timeout=5)
        if uptime["returncode"] == 0:
            info["uptime"] = uptime["stdout"].strip()
    except Exception:
        pass
    
    # Disk usage
    try:
        df = await _run_cmd(["df", "-h", "/"], timeout=5)
        if df["returncode"] == 0:
            lines = df["stdout"].strip().split("\n")
            if len(lines) >= 2:
                parts = lines[1].split()
                if len(parts) >= 5:
                    info["disk"] = {
                        "total": parts[1],
                        "used": parts[2],
                        "available": parts[3],
                        "usage_percent": parts[4],
                    }
    except Exception:
        pass
    
    # Memory
    try:
        mem = await _run_cmd(["free", "-h"], timeout=5)
        if mem["returncode"] == 0:
            lines = mem["stdout"].strip().split("\n")
            if len(lines) >= 2:
                parts = lines[1].split()
                if len(parts) >= 3:
                    info["memory"] = {
                        "total": parts[1],
                        "used": parts[2],
                        "available": parts[len(parts)-1] if len(parts) > 5 else parts[3],
                    }
    except Exception:
        pass
    
    # Installed packages count
    try:
        dpkg = await _run_cmd(["dpkg", "--get-selections"], timeout=10)
        if dpkg["returncode"] == 0:
            info["installed_packages"] = len([l for l in dpkg["stdout"].split("\n") if l.strip()])
    except Exception:
        pass
    
    return info


# ─── Manual Feedback ───

class ManualFeedback(BaseModel):
    feedback: str

@api_router.post("/submissions/{submission_id}/feedback")
async def add_manual_feedback(submission_id: str, data: ManualFeedback, current_user: dict = Depends(auth_dependency)):
    """Formateur/Admin adds manual feedback to a submission"""
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Formateur ou admin uniquement")
    
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Soumission non trouvee")
    
    feedback_entry = {
        "id": str(uuid.uuid4()),
        "author_id": current_user["id"],
        "author_name": current_user["full_name"],
        "text": data.feedback,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.submissions.update_one(
        {"id": submission_id},
        {"$push": {"manual_feedbacks": feedback_entry}}
    )
    
    # Notify student
    await create_notification(
        user_id=submission["student_id"],
        title="Nouveau commentaire du formateur",
        message=f"{current_user['full_name']} a commente votre exercice '{submission.get('exercise_title', '')}'",
        notif_type="info",
        link=f"/results/{submission_id}"
    )
    
    return {"message": "Commentaire ajoute", "feedback": feedback_entry}

# ─── Formateur Enhanced Stats ───

@api_router.get("/stats/formateur-alerts")
async def get_formateur_alerts(formation: str = None, current_user: dict = Depends(auth_dependency)):
    """Get alerts for formateur: struggling students, inactive students"""
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    form_filter = {"formation": formation} if formation else {}
    students = await db.users.find({**form_filter, "role": "etudiant"}, {"_id": 0, "password": 0}).to_list(500)
    
    struggling = []
    inactive = []
    now = datetime.now(timezone.utc)
    
    for student in students:
        # Get submissions
        subs = await db.submissions.find(
            {"student_id": student["id"], "graded": True},
            {"_id": 0, "score": 1, "max_score": 1, "submitted_at": 1}
        ).to_list(100)
        
        if subs:
            # Calculate average score /20
            total_score = sum(s.get("score", 0) for s in subs)
            total_max = sum(s.get("max_score", 1) for s in subs)
            avg_20 = round((total_score / max(total_max, 1)) * 20, 1)
            
            if avg_20 < 10:
                struggling.append({
                    "id": student["id"],
                    "full_name": student.get("full_name", ""),
                    "email": student.get("email", ""),
                    "avg_score_20": avg_20,
                    "submissions_count": len(subs),
                    "formation": student.get("formation", ""),
                })
            
            # Check last activity
            last_sub = max(subs, key=lambda s: s.get("submitted_at", ""))
            try:
                last_date = datetime.fromisoformat(last_sub["submitted_at"].replace("Z", "+00:00"))
                days_inactive = (now - last_date).days
                if days_inactive > 7:
                    inactive.append({
                        "id": student["id"],
                        "full_name": student.get("full_name", ""),
                        "email": student.get("email", ""),
                        "days_inactive": days_inactive,
                        "last_activity": last_sub["submitted_at"],
                        "formation": student.get("formation", ""),
                    })
            except Exception:
                pass
        else:
            # No submissions at all = inactive
            inactive.append({
                "id": student["id"],
                "full_name": student.get("full_name", ""),
                "email": student.get("email", ""),
                "days_inactive": 999,
                "last_activity": None,
                "formation": student.get("formation", ""),
            })
    
    struggling.sort(key=lambda s: s["avg_score_20"])
    inactive.sort(key=lambda s: s["days_inactive"], reverse=True)
    
    return {
        "struggling": struggling,
        "inactive": inactive,
    }


# ─── Seed Data ───

@api_router.post("/seed")
async def seed_data():
    admin_exists = await db.users.find_one({"$or": [{"email": "admin@netbfrs.fr"}, {"username": "admin"}]}, {"_id": 0})
    if admin_exists:
        return {"message": "Donnees deja initialisees"}
    
    admin_id = str(uuid.uuid4())
    await db.users.insert_one({"id": admin_id, "email": "admin@netbfrs.fr", "username": "admin@netbfrs.fr", "password": hash_password("admin123"), "full_name": "Administrateur NETBFRS", "role": "admin", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    formateur_id = str(uuid.uuid4())
    await db.users.insert_one({"id": formateur_id, "email": "formateur@netbfrs.fr", "username": "formateur@netbfrs.fr", "password": hash_password("formateur123"), "full_name": "Jean Dupont", "role": "formateur", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    # BTS SIO SISR students
    for email, fname in [("alice.martin@netbfrs.fr", "Alice Martin"), ("bob.durand@netbfrs.fr", "Bob Durand")]:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "username": email, "password": hash_password("etudiant123"), "full_name": fname, "role": "etudiant", "formation": "bts-sio-sisr", "created_at": datetime.now(timezone.utc).isoformat()})
    
    # Bachelor AIS students
    for email, fname in [("claire.petit@netbfrs.fr", "Claire Petit"), ("david.moreau@netbfrs.fr", "David Moreau")]:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "username": email, "password": hash_password("etudiant123"), "full_name": fname, "role": "etudiant", "formation": "bachelor-ais", "created_at": datetime.now(timezone.utc).isoformat()})
    
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
        "admin": {"email": "admin@netbfrs.fr", "password": "admin123"},
        "formateur": {"email": "formateur@netbfrs.fr", "password": "formateur123"},
        "bts_sisr": {"email": "alice.martin@netbfrs.fr / bob.durand@netbfrs.fr", "password": "etudiant123"},
        "bachelor_ais": {"email": "claire.petit@netbfrs.fr / david.moreau@netbfrs.fr", "password": "etudiant123"},
    }}


# ─── Course Routes ───

@api_router.post("/courses", status_code=201)
async def create_course(data: CourseCreate, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Formateur ou admin uniquement")
    
    # If exercise_id provided, verify it exists
    exercise = None
    if data.exercise_id:
        exercise = await db.exercises.find_one({"id": data.exercise_id}, {"_id": 0})
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercice non trouve")
        
        # Check if course already exists for this exercise
        existing = await db.courses.find_one({"exercise_id": data.exercise_id}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Un cours existe deja pour cet exercice. Utilisez PUT pour le modifier.")
    
    # Determine formation and category
    formation = data.formation
    category = data.category
    if exercise:
        formation = formation or exercise.get("formation", "bts-sio-sisr")
        category = category or exercise.get("category", "")
    
    course_id = str(uuid.uuid4())
    course_doc = {
        "id": course_id,
        "exercise_id": data.exercise_id,
        "title": data.title,
        "content": data.content,
        "cover_image": data.cover_image,
        "video_filename": data.video_filename,
        "images": data.images,
        "objectives": data.objectives,
        "prerequisites": data.prerequisites,
        "duration_estimate": data.duration_estimate,
        "formation": formation or "bts-sio-sisr",
        "category": category or "",
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
        # Get courses directly tagged with formation OR linked to exercises of this formation
        exercises = await db.exercises.find({"formation": formation}, {"_id": 0, "id": 1}).to_list(1000)
        ex_ids = [e["id"] for e in exercises]
        courses = await db.courses.find({
            "$or": [
                {"exercise_id": {"$in": ex_ids}},
                {"formation": formation},
            ]
        }, {"_id": 0}).to_list(1000)
    else:
        courses = await db.courses.find({}, {"_id": 0}).to_list(1000)
    
    # Enrich with exercise info when linked
    for course in courses:
        if course.get("exercise_id"):
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
    if data.exercise_id is not None:
        # Validate exercise if provided (empty string = unlink)
        if data.exercise_id:
            exercise = await db.exercises.find_one({"id": data.exercise_id}, {"_id": 0})
            if not exercise:
                raise HTTPException(status_code=404, detail="Exercice non trouve")
        update["exercise_id"] = data.exercise_id if data.exercise_id else None
    if data.title is not None:
        update["title"] = data.title
    if data.content is not None:
        update["content"] = data.content
    if data.cover_image is not None:
        update["cover_image"] = data.cover_image
    if data.video_filename is not None:
        update["video_filename"] = data.video_filename
    if data.images is not None:
        update["images"] = data.images
    if data.objectives is not None:
        update["objectives"] = data.objectives
    if data.prerequisites is not None:
        update["prerequisites"] = data.prerequisites
    if data.duration_estimate is not None:
        update["duration_estimate"] = data.duration_estimate
    if data.formation is not None:
        update["formation"] = data.formation
    if data.category is not None:
        update["category"] = data.category
    
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
    
    # Delete associated cover image
    if course.get("cover_image"):
        cover_path = UPLOAD_IMAGES_DIR / course["cover_image"]
        if cover_path.exists():
            cover_path.unlink()
    
    # Delete associated illustration images
    for img_filename in course.get("images", []):
        img_path = UPLOAD_IMAGES_DIR / img_filename
        if img_path.exists():
            img_path.unlink()
    
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


# ─── Image Upload & Serve ───

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if not file.content_type or file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Le fichier doit etre une image (JPEG, PNG, GIF, WebP, SVG)")
    
    # Generate unique filename
    ext = Path(file.filename).suffix if file.filename else ".png"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_IMAGES_DIR / filename
    
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

@api_router.get("/images/{filename}")
async def serve_image(filename: str):
    filepath = UPLOAD_IMAGES_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image non trouvee")
    
    content_type = "image/png"
    ext = Path(filename).suffix.lower()
    type_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml"}
    content_type = type_map.get(ext, "image/png")
    
    return FileResponse(filepath, media_type=content_type, filename=filename)

@api_router.delete("/images/{filename}")
async def delete_image(filename: str, current_user: dict = Depends(auth_dependency)):
    if current_user["role"] not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Acces refuse")
    filepath = UPLOAD_IMAGES_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image non trouvee")
    filepath.unlink()
    return {"message": "Image supprimee"}


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


# ─── Notifications ───

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(auth_dependency)):
    """Get notifications for current user"""
    notifs = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs

@api_router.put("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: dict = Depends(auth_dependency)):
    result = await db.notifications.update_one(
        {"id": notif_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification non trouvee")
    return {"message": "Notification lue"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(auth_dependency)):
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Toutes les notifications marquees comme lues"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(auth_dependency)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    return {"count": count}

async def create_notification(user_id: str, title: str, message: str, notif_type: str = "info", link: str = None):
    """Helper to create a notification"""
    notif_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notif_doc)
    return notif_doc

# ─── Enhanced Student Stats ───

@api_router.get("/stats/student-detailed")
async def get_student_detailed_stats(current_user: dict = Depends(auth_dependency)):
    """Get detailed student stats including streaks, level, badges"""
    if current_user["role"] != "etudiant":
        raise HTTPException(status_code=403, detail="Etudiants uniquement")
    
    student_id = current_user["id"]
    formation = current_user.get("formation", "bts-sio-sisr")
    
    # Get all submissions
    submissions = await db.submissions.find(
        {"student_id": student_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(1000)
    
    # Get all exercises for the formation
    exercises = await db.exercises.find(
        {"formation": formation},
        {"_id": 0, "id": 1, "title": 1, "category": 1}
    ).to_list(1000)
    
    total_exercises = len(exercises)
    completed_ids = set()
    total_score = 0
    total_max = 0
    graded_count = 0
    best_score = 0
    worst_score = 20
    scores_list = []
    
    for sub in submissions:
        completed_ids.add(sub["exercise_id"])
        if sub.get("graded") and sub.get("max_score", 0) > 0:
            score_20 = round((sub["score"] / sub["max_score"]) * 20, 1) if sub.get("score_20") is None else sub["score_20"]
            scores_list.append(score_20)
            total_score += sub["score"]
            total_max += sub["max_score"]
            graded_count += 1
            if score_20 > best_score:
                best_score = score_20
            if score_20 < worst_score:
                worst_score = score_20
    
    completed_count = len(completed_ids)
    avg_score_20 = round((total_score / max(total_max, 1)) * 20, 1)
    completion_pct = round((completed_count / max(total_exercises, 1)) * 100)
    
    # Calculate streak (consecutive days with submissions)
    streak = 0
    if submissions:
        from datetime import timedelta
        today = datetime.now(timezone.utc).date()
        dates = sorted(set(
            datetime.fromisoformat(s["submitted_at"].replace("Z", "+00:00")).date()
            for s in submissions if s.get("submitted_at")
        ), reverse=True)
        if dates and (today - dates[0]).days <= 1:
            streak = 1
            for i in range(1, len(dates)):
                if (dates[i-1] - dates[i]).days <= 1:
                    streak += 1
                else:
                    break
    
    # Calculate level (XP based)
    xp = completed_count * 100 + graded_count * 50 + int(avg_score_20 * 10)
    level = 1
    xp_thresholds = [0, 200, 500, 1000, 2000, 3500, 5000, 7500, 10000]
    for i, threshold in enumerate(xp_thresholds):
        if xp >= threshold:
            level = i + 1
    next_level_xp = xp_thresholds[min(level, len(xp_thresholds)-1)]
    prev_level_xp = xp_thresholds[min(level-1, len(xp_thresholds)-1)]
    level_progress = round(((xp - prev_level_xp) / max(next_level_xp - prev_level_xp, 1)) * 100)
    
    level_names = ["Debutant", "Apprenti", "Intermediaire", "Avance", "Expert", "Maitre", "Legende", "Architecte", "Virtuose"]
    level_name = level_names[min(level-1, len(level_names)-1)]
    
    # Generate badges
    badges = []
    if completed_count >= 1:
        badges.append({"id": "first_step", "name": "Premier pas", "icon": "🎯", "desc": "Premier exercice complete"})
    if completed_count >= 5:
        badges.append({"id": "studious", "name": "Studieux", "icon": "📚", "desc": "5 exercices completes"})
    if completed_count >= 10:
        badges.append({"id": "dedicated", "name": "Dedie", "icon": "🏆", "desc": "10 exercices completes"})
    if avg_score_20 >= 16:
        badges.append({"id": "excellent", "name": "Excellent", "icon": "⭐", "desc": "Moyenne >= 16/20"})
    if avg_score_20 >= 18:
        badges.append({"id": "genius", "name": "Genie", "icon": "🧠", "desc": "Moyenne >= 18/20"})
    if streak >= 3:
        badges.append({"id": "streak3", "name": "En serie", "icon": "🔥", "desc": "3 jours consecutifs"})
    if streak >= 7:
        badges.append({"id": "streak7", "name": "Infatigable", "icon": "💪", "desc": "7 jours consecutifs"})
    if best_score >= 19:
        badges.append({"id": "perfect", "name": "Quasi-parfait", "icon": "💎", "desc": "Note >= 19/20"})
    if completion_pct >= 100:
        badges.append({"id": "complete", "name": "Completiste", "icon": "🎓", "desc": "Tous les exercices completes"})
    
    return {
        "completed_exercises": completed_count,
        "total_exercises": total_exercises,
        "completion_pct": completion_pct,
        "avg_score_20": avg_score_20,
        "best_score": best_score if graded_count > 0 else 0,
        "worst_score": worst_score if graded_count > 0 else 0,
        "graded_count": graded_count,
        "total_submissions": len(submissions),
        "streak": streak,
        "xp": xp,
        "level": level,
        "level_name": level_name,
        "level_progress": level_progress,
        "next_level_xp": next_level_xp,
        "badges": badges,
        "scores": scores_list[-20:],  # Last 20 scores
    }



# Include router and middleware
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','), allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
