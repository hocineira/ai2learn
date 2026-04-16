# RAPPORT TECHNIQUE COMPLET — AI2Lean (NETBFRS Academy)

> **Version** : 2.5  
> **Date** : Avril 2026  
> **Auteur** : Documentation auto-generee  
> **Objectif** : Onboarding developpeur — couverture exhaustive du projet

---

## TABLE DES MATIERES

1. [Stack Technique](#1-stack-technique)
2. [Architecture](#2-architecture)
3. [Schema de Base de Donnees](#3-schema-de-base-de-donnees)
4. [APIs — Catalogue Complet des Routes](#4-apis--catalogue-complet-des-routes)
5. [Variables d'Environnement](#5-variables-denvironnement)
6. [Dependances Externes](#6-dependances-externes)
7. [Fonctionnalites Implementees](#7-fonctionnalites-implementees)
8. [Points Techniques Complexes](#8-points-techniques-complexes)
9. [Comptes de Test](#9-comptes-de-test)

---

## 1. STACK TECHNIQUE

### Backend

| Composant | Technologie | Version |
|-----------|------------|---------|
| **Runtime** | Python | 3.11.15 |
| **Framework** | FastAPI | 0.110.1 |
| **Serveur ASGI** | Uvicorn | 0.25.0 |
| **Base de donnees** | MongoDB (via Motor async) | motor 3.3.1 / pymongo 4.5.0 |
| **ORM/ODM** | Aucun (acces direct Motor) | — |
| **Authentification** | JWT (PyJWT) | 2.11.0 |
| **Hash mots de passe** | bcrypt | 4.1.3 |
| **Validation** | Pydantic | 2.12.5 |
| **LLM — Google** | google-generativeai / google-genai | 0.8.6 / 1.65.0 |
| **LLM — OpenAI (Emergent)** | emergentintegrations | 0.1.0 |
| **Virtualisation** | proxmoxer (API Proxmox) | 2.3.0 |
| **HTTP Client** | httpx / requests | 0.28.1 / 2.32.5 |
| **Fichiers .env** | python-dotenv | 1.2.1 |
| **Stripe (prevu)** | stripe | 14.4.0 |

### Frontend

| Composant | Technologie | Version |
|-----------|------------|---------|
| **Framework** | React | 19.0.0 |
| **Build** | Create React App + CRACO | CRA 5.0.1 / CRACO 7.1.0 |
| **Routage** | react-router-dom | 7.5.1 |
| **CSS** | Tailwind CSS | 3.4.17 |
| **Composants UI** | shadcn/ui (Radix UI) | ~46 composants |
| **Icones** | Lucide React | 0.507.0 |
| **Graphiques** | Recharts | 2.15.3 |
| **HTTP Client** | Axios | 1.8.4 |
| **Notifications** | Sonner | 2.0.3 |
| **Theme** | Tailwind dark mode (class) | — |
| **PDF** | jspdf + jspdf-autotable | 4.2.0 / 5.0.7 |
| **Formulaires** | react-hook-form + zod | 7.56.2 / 3.24.4 |

### Infrastructure

| Composant | Technologie |
|-----------|------------|
| **OS Serveur** | Debian GNU/Linux 12 (bookworm) |
| **Base de donnees** | MongoDB (locale) |
| **Process Manager** | Supervisor |
| **Reverse Proxy** | Kubernetes Ingress (Nginx) |
| **Virtualisation Labs** | Proxmox VE (API) |
| **Acces distant Labs** | Apache Guacamole (RDP) |

---

## 2. ARCHITECTURE

### Structure des dossiers

```
/app/
├── backend/
│   ├── server.py              # Point d'entree unique (~3100 lignes)
│   ├── .env                   # Variables d'environnement backend
│   ├── requirements.txt       # Dependances Python
│   ├── uploads/
│   │   ├── videos/            # Videos uploadees (MP4, WebM, OGG)
│   │   └── images/            # Images uploadees (JPEG, PNG, GIF, WebP, SVG)
│   └── tests/
│
├── frontend/
│   ├── package.json           # Dependances Node/Yarn
│   ├── .env                   # REACT_APP_BACKEND_URL
│   ├── craco.config.js        # Override CRA config (alias @/)
│   ├── tailwind.config.js     # Config Tailwind + shadcn
│   ├── src/
│   │   ├── App.js             # Routing principal
│   │   ├── index.js           # Point d'entree React
│   │   ├── index.css          # Variables CSS + theme light/dark
│   │   ├── contexts/
│   │   │   ├── AuthContext.js  # Authentification (token, user, formation)
│   │   │   └── ThemeContext.js # Theme light/dark (localStorage)
│   │   ├── components/
│   │   │   ├── Sidebar.js     # Navigation laterale (role-based)
│   │   │   ├── NotificationBell.js # Cloche notifications
│   │   │   └── ui/            # ~46 composants shadcn/ui (.jsx)
│   │   ├── pages/             # 22 pages
│   │   │   ├── LoginPage.js
│   │   │   ├── LandingPage.js         # (desactivee, conservee)
│   │   │   ├── AdminDashboard.js
│   │   │   ├── FormateurDashboard.js
│   │   │   ├── EtudiantDashboard.js
│   │   │   ├── ExercisesPage.js
│   │   │   ├── ExerciseCreate.js
│   │   │   ├── ExerciseTake.js
│   │   │   ├── UsersPage.js
│   │   │   ├── TrackingPage.js
│   │   │   ├── ResultsPage.js
│   │   │   ├── SubmissionsPage.js
│   │   │   ├── LabPage.js
│   │   │   ├── LabsListPage.js
│   │   │   ├── CoursePage.js
│   │   │   ├── CourseCreatePage.js
│   │   │   ├── CourseViewPage.js
│   │   │   ├── CoursesListPage.js
│   │   │   ├── SettingsPage.js
│   │   │   ├── MonitoringPage.js
│   │   │   ├── LoginHistoryPage.js
│   │   │   └── ResultsPage.js
│   │   ├── hooks/
│   │   │   └── use-toast.js
│   │   └── lib/
│   │       └── utils.js       # cn() helper (clsx + tailwind-merge)
│   └── public/
│
├── scripts/
│   ├── deploy-debian.sh       # Script de deploiement Debian
│   ├── install.sh             # Installation initiale
│   ├── DEPLOIEMENT.md
│   └── GUIDE-LABS-PROXMOX.md
│
├── memory/
│   ├── PRD.md                 # Product Requirements Document
│   └── test_credentials.md    # Identifiants de test
│
└── test_result.md             # Resultats de tests + protocole
```

### Patterns utilises

| Pattern | Description |
|---------|------------|
| **Monolith backend** | Un seul fichier `server.py` avec toutes les routes (APIRouter prefixe `/api`) |
| **Role-based access** | Middleware `auth_dependency` + verification `current_user["role"]` par endpoint |
| **JWT stateless** | Token JWT sans expiration, stocke dans localStorage cote client |
| **Context API (React)** | `AuthContext` (auth/formation), `ThemeContext` (dark/light) |
| **Component-based UI** | shadcn/ui (Radix primitives + Tailwind) |
| **Role-based routing** | `ProtectedRoute` avec prop `roles` dans App.js |
| **Role-based sidebar** | `navItems` conditionnel dans Sidebar.js selon `user.role` |
| **LLM fallback chain** | DB key → .env Emergent key → fallback, avec detection auto du provider |
| **UUID-only IDs** | Pas d'ObjectId MongoDB, tout en UUID v4 pour la serialisation JSON |

---

## 3. SCHEMA DE BASE DE DONNEES

> MongoDB — toutes les collections utilisent `id` (UUID string) comme cle primaire, jamais `_id`.

### Collection `users`
```json
{
  "id": "uuid",
  "email": "string",
  "username": "string (= email)",
  "password": "string (bcrypt hash)",
  "full_name": "string",
  "role": "admin | formateur | etudiant",
  "formation": "bts-sio-sisr | bachelor-ais",
  "created_at": "ISO datetime"
}
```

### Collection `exercises`
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "category": "string (id categorie)",
  "formation": "bts-sio-sisr | bachelor-ais",
  "shared": "boolean",
  "exercise_type": "standard | lab",
  "exam_mode": "boolean",
  "time_limit": "int (minutes, 0 = illimite)",
  "questions": [
    {
      "id": "uuid",
      "question_text": "string",
      "question_type": "qcm | open",
      "options": ["string..."],
      "correct_answer": "string",
      "points": "int"
    }
  ],
  "lab_instructions": "string | null",
  "lab_username": "string | null",
  "lab_password": "string | null",
  "proxmox_template_id": "int | null",
  "validation_scripts": [{"name":"...","command":"...","expected":"..."}],
  "created_by": "uuid (user_id)",
  "created_by_name": "string",
  "created_at": "ISO datetime"
}
```

### Collection `submissions`
```json
{
  "id": "uuid",
  "exercise_id": "uuid",
  "exercise_title": "string",
  "formation": "string",
  "student_id": "uuid",
  "student_name": "string",
  "answers": [
    {
      "question_id": "uuid",
      "answer": "string",
      "correct": "boolean | null",
      "points_earned": "int",
      "ai_feedback": "string | null"
    }
  ],
  "score": "int | null",
  "score_20": "float | null (note sur 20)",
  "max_score": "int",
  "ai_feedback": "string | null",
  "graded": "boolean",
  "vm_validation": "[{name, command, expected, actual, passed}] | null",
  "vm_validation_summary": "string | null",
  "manual_feedbacks": [{"id","author_id","author_name","text","created_at"}],
  "submitted_at": "ISO datetime"
}
```

### Collection `courses`
```json
{
  "id": "uuid",
  "exercise_id": "uuid | null (optionnel — cours standalone)",
  "title": "string",
  "content": "string (markdown)",
  "cover_image": "string | null (filename)",
  "video_filename": "string | null",
  "images": ["string (filenames)"],
  "objectives": ["string"],
  "prerequisites": ["string"],
  "duration_estimate": "string | null",
  "formation": "string | null",
  "category": "string | null",
  "created_by": "uuid",
  "created_by_name": "string",
  "created_at": "ISO datetime"
}
```

### Collection `labs`
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "exercise_id": "uuid",
  "lab_name": "string",
  "vmid": "int (Proxmox VM ID)",
  "vm_ip": "string | null",
  "guac_connection_id": "string | null",
  "guac_url": "string | null",
  "status": "cloning | starting | running | stopping | stopped | completed | error",
  "provisioning_steps": [{"step","status","detail","timestamp"}],
  "error_message": "string | null",
  "started_at": "ISO datetime",
  "stopped_at": "ISO datetime | null"
}
```

### Collection `notifications`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "string",
  "message": "string",
  "type": "info | grading | password_request | email_change_request | warning",
  "link": "string | null",
  "read": "boolean",
  "created_at": "ISO datetime"
}
```

### Collection `login_history`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_name": "string",
  "user_email": "string",
  "role": "string",
  "ip": "string",
  "user_agent": "string",
  "logged_at": "ISO datetime"
}
```

### Collection `login_attempts`
```json
{
  "id": "uuid",
  "email": "string",
  "ip": "string",
  "user_agent": "string",
  "success": "boolean",
  "timestamp": "ISO datetime"
}
```

### Collection `active_sessions`
```json
{
  "user_id": "uuid (cle unique — upsert)",
  "user_name": "string",
  "user_email": "string",
  "role": "string",
  "ip": "string",
  "user_agent": "string",
  "last_seen": "ISO datetime"
}
```

### Collection `password_requests`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_name": "string",
  "user_email": "string",
  "reason": "string",
  "status": "pending | done",
  "created_at": "ISO datetime",
  "handled_by": "uuid | null",
  "handled_at": "ISO datetime | null"
}
```

### Collection `email_change_requests`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_name": "string",
  "user_email": "string (email actuel)",
  "new_email": "string (email demande)",
  "reason": "string",
  "status": "pending | approved | rejected",
  "created_at": "ISO datetime",
  "handled_by": "uuid | null",
  "handled_at": "ISO datetime | null"
}
```

### Collection `settings`
```json
{
  "key": "global",
  "llm_key": "string | null (cle API LLM)",
  "llm_provider": "google | emergent | null"
}
```

### Collection `system_updates`
```json
{
  "id": "uuid",
  "started_at": "ISO datetime",
  "finished_at": "ISO datetime | null",
  "status": "in_progress | success | error",
  "packages_requested": ["string"],
  "applied_by": "uuid",
  "applied_by_name": "string",
  "output": "string (stdout apt-get)",
  "error": "string (stderr)",
  "updated_packages": [{"name","version"}],
  "packages_count": "int"
}
```

### Collection `system_update_checks`
```json
{
  "id": "uuid",
  "checked_at": "ISO datetime",
  "packages_available": "int",
  "checked_by": "uuid"
}
```

### Relations (logiques, pas de FK MongoDB)

```
users.id  ←──→  submissions.student_id
users.id  ←──→  labs.student_id
users.id  ←──→  notifications.user_id
users.id  ←──→  password_requests.user_id
users.id  ←──→  email_change_requests.user_id
users.id  ←──→  login_history.user_id
users.id  ←──→  active_sessions.user_id

exercises.id  ←──→  submissions.exercise_id
exercises.id  ←──→  labs.exercise_id
exercises.id  ←──→  courses.exercise_id (optionnel)

courses → exercises (via exercise_id, nullable)
courses → uploads/images (via cover_image, images[])
courses → uploads/videos (via video_filename)
```

---

## 4. APIs — CATALOGUE COMPLET DES ROUTES

> Toutes les routes sont prefixees `/api`. Les roles indiques sont ceux autorises.

### 4.1 Authentification

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/auth/register` | Public | Inscription. Body: `{email, password, full_name, role?, formation?}` → `{token, user}` |
| `POST` | `/api/auth/login` | Public | Connexion. Body: `{email, password}` → `{token, user}`. Log IP, user-agent, session active. |
| `GET` | `/api/auth/me` | Auth | Retourne l'utilisateur courant (depuis JWT). |

### 4.2 Formations & Categories

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/formations` | Public | Liste des formations (BTS SIO SISR, Bachelor AIS). |
| `GET` | `/api/categories` | Public | Categories par formation. Query: `?formation=bts-sio-sisr`. |

### 4.3 Gestion Utilisateurs

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/users` | Admin, Formateur | Liste tous les utilisateurs. Query: `?formation=...`. |
| `PUT` | `/api/users/{user_id}` | Admin | Modifie role, formation, password, **email**. Body: `{role?, formation?, new_password?, email?}`. |
| `DELETE` | `/api/users/{user_id}` | Admin | Supprime un utilisateur. |

### 4.4 Exercices

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/exercises` | Admin, Formateur | Creer un exercice (standard ou lab). Body: `ExerciseCreate`. |
| `GET` | `/api/exercises` | Auth | Lister les exercices. Query: `?category=...&formation=...`. |
| `GET` | `/api/exercises/{id}` | Auth | Detail d'un exercice. |
| `PUT` | `/api/exercises/{id}` | Admin, Formateur | Modifier un exercice. Body: `ExerciseCreate`. |
| `DELETE` | `/api/exercises/{id}` | Admin, Formateur | Supprimer un exercice. |

### 4.5 Soumissions

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/submissions` | Etudiant | Soumettre un exercice. Body: `{exercise_id, answers:[{question_id, answer}]}`. Correction auto QCM + IA pour questions ouvertes. |
| `GET` | `/api/submissions` | Auth | Lister. Etudiants voient les leurs, admin/formateur voient tout. Query: `?exercise_id=...&formation=...`. |
| `GET` | `/api/submissions/{id}` | Auth | Detail d'une soumission. |
| `POST` | `/api/grade/{submission_id}` | Auth | Declencher la correction IA manuellement. |
| `POST` | `/api/submissions/{id}/feedback` | Admin, Formateur | Ajouter un feedback manuel. Body: `{feedback: "string"}`. |

### 4.6 Cours

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/courses` | Admin, Formateur | Creer un cours (standalone ou lie a un exercice). Body: `CourseCreate`. |
| `GET` | `/api/courses` | Auth | Lister les cours. Query: `?formation=...`. |
| `GET` | `/api/courses/{course_id}` | Auth | Detail d'un cours. |
| `GET` | `/api/courses/by-exercise/{exercise_id}` | Auth | Trouver le cours lie a un exercice. |
| `PUT` | `/api/courses/{course_id}` | Admin, Formateur | Modifier un cours. Body: `CourseUpdate`. |
| `DELETE` | `/api/courses/{course_id}` | Admin, Formateur | Supprimer un cours + nettoyage fichiers. |

### 4.7 Upload Fichiers

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/upload/video` | Admin, Formateur | Upload video (multipart). Types: MP4, WebM, OGG. Max: pas de limite hard. |
| `GET` | `/api/videos/{filename}` | Public | Servir un fichier video (FileResponse). |
| `GET` | `/api/videos` | Admin, Formateur | Lister les videos uploadees. |
| `POST` | `/api/upload/image` | Admin, Formateur | Upload image (multipart). Types: JPEG, PNG, GIF, WebP, SVG. |
| `GET` | `/api/images/{filename}` | Public | Servir une image. |
| `DELETE` | `/api/images/{filename}` | Admin, Formateur | Supprimer une image. |

### 4.8 Labs (Proxmox + Guacamole)

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/labs/start` | Etudiant | Demarrer un lab. Clone VM Proxmox, configure Guacamole. Body: `{exercise_id}`. |
| `GET` | `/api/labs/status/{exercise_id}` | Auth | Statut du lab (cloning/starting/running/stopped...). |
| `GET` | `/api/labs/guac-url/{exercise_id}` | Auth | URL Guacamole pour l'acces RDP. |
| `POST` | `/api/labs/stop/{exercise_id}` | Auth | Arreter un lab (stop + delete VM + cleanup Guac). |
| `GET` | `/api/labs/active` | Admin, Formateur | Lister tous les labs actifs. |

### 4.9 Statistiques & Export

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/stats/overview` | Admin, Formateur | Stats globales (etudiants, exercices, soumissions, scores). Query: `?formation=...`. |
| `GET` | `/api/stats/student` | Etudiant | Stats personnelles de l'etudiant connecte. |
| `GET` | `/api/stats/student-detailed` | Etudiant | Stats detaillees (streaks, niveau, badges, XP). |
| `GET` | `/api/stats/student-charts` | Etudiant | Donnees graphiques (evolution scores). |
| `GET` | `/api/stats/students-tracking` | Admin, Formateur | Suivi de tous les etudiants. Query: `?formation=...`. |
| `GET` | `/api/stats/charts` | Admin, Formateur | Donnees graphiques (activite, notes, categories). |
| `GET` | `/api/stats/formateur-alerts` | Admin, Formateur | Alertes formateur (etudiants inactifs, notes basses). |
| `GET` | `/api/export/submissions-csv` | Admin, Formateur | Export CSV de toutes les soumissions. |
| `GET` | `/api/export/tracking-csv` | Admin, Formateur | Export CSV du suivi etudiants. |
| `GET` | `/api/export/result-csv/{submission_id}` | Auth | Export CSV d'un resultat individuel. |

### 4.10 Parametres & Profil

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/settings` | Admin | Parametres plateforme (cle LLM, provider). |
| `PUT` | `/api/settings` | Admin | Modifier parametres. Body: `{llm_key}`. |
| `PUT` | `/api/profile` | Auth | Obtenir le profil complet. |
| `POST` | `/api/profile/update` | Auth | Modifier profil. Body: `{full_name?, current_password?, new_password?}`. |

### 4.11 Demandes de changement

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/password-change-request` | Auth | Demander un changement de mot de passe (notifie admins). Body: `{reason?}`. |
| `GET` | `/api/password-requests` | Admin | Lister les demandes de mot de passe. |
| `PUT` | `/api/password-requests/{id}` | Admin | Marquer une demande comme traitee. |
| `POST` | `/api/email-change-request` | Etudiant, Formateur | Demander un changement d'email. Body: `{new_email, reason?}`. |
| `GET` | `/api/email-change-requests` | Admin | Lister les demandes d'email. |
| `PUT` | `/api/email-change-requests/{id}` | Admin | Approuver/refuser. Query: `?action=approve\|reject`. |
| `GET` | `/api/my-email-change-request` | Auth | Ma demande d'email en cours. |

### 4.12 Monitoring & Securite

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/login-history` | Admin, Formateur | Historique des connexions (IP, user-agent, date). |
| `GET` | `/api/monitoring/active-sessions` | Admin | Sessions actives. |
| `GET` | `/api/monitoring/login-attempts` | Admin | Tentatives de connexion (succes/echecs). |
| `GET` | `/api/monitoring/brute-force` | Admin | Detection brute-force (IPs suspectes, comptes cibles, echecs 24h). |
| `GET` | `/api/monitoring/server-stats` | Admin | Stats serveur (OS, Python, DB collections, compteurs). |

### 4.13 Mises a jour systeme

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/system/info` | Admin | Infos systeme (OS, kernel, uptime, disque, memoire, paquets installes). |
| `GET` | `/api/system/check-updates` | Admin | `apt update` + liste paquets a jour. Retourne `{packages, total_upgradable, os_info}`. |
| `GET` | `/api/system/upgradable` | Admin | Liste paquets a jour (sans `apt update`). |
| `POST` | `/api/system/apply-updates` | Admin | Appliquer les mises a jour. Body: `{packages?: ["pkg1"], security_only?: false}`. |
| `GET` | `/api/system/changelog/{package_name}` | Admin | Changelog/patch notes d'un paquet. Retourne entries parsees. |
| `GET` | `/api/system/update-history` | Admin | Historique des mises a jour appliquees depuis le panel. |
| `GET` | `/api/system/update-detail/{update_id}` | Admin | Detail d'une mise a jour (output, packages, erreurs). |

### 4.14 Notifications

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/notifications` | Auth | Notifications de l'utilisateur (dernieres 50). |
| `PUT` | `/api/notifications/{notif_id}/read` | Auth | Marquer une notification comme lue. |
| `PUT` | `/api/notifications/read-all` | Auth | Marquer toutes comme lues. |
| `GET` | `/api/notifications/unread-count` | Auth | Nombre de notifications non lues. |

### 4.15 Seed & Init

| Methode | Route | Roles | Description |
|---------|-------|-------|-------------|
| `POST` | `/api/seed` | Public | Initialise les donnees de demo (admin, formateur, etudiants, exercices). Idempotent. |

---

## 5. VARIABLES D'ENVIRONNEMENT

### Backend (`/app/backend/.env`)

| Variable | Description | Exemple |
|----------|------------|---------|
| `MONGO_URL` | URI de connexion MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | Nom de la base de donnees | `ai2lean` |
| `CORS_ORIGINS` | Origines CORS autorisees | `*` |
| `EMERGENT_LLM_KEY` | Cle API Emergent (fallback LLM) | `sk-emergent-...` |
| `PROXMOX_HOST` | IP/hostname du serveur Proxmox | `192.168.1.100` |
| `PROXMOX_PORT` | Port API Proxmox | `8006` |
| `PROXMOX_NODE` | Nom du noeud Proxmox | `SRVDEPLOY` |
| `PROXMOX_USER` | Utilisateur API Proxmox | `ai2learn@pve` |
| `PROXMOX_TOKEN_NAME` | Nom du token API Proxmox | `ai2lean-api` |
| `PROXMOX_TOKEN_SECRET` | Secret du token Proxmox | `xxxxxxxx-xxxx-...` |
| `PROXMOX_TEMPLATE_WINSERVER` | ID du template VM Windows Server | `901` |
| `GUACAMOLE_URL` | URL du serveur Apache Guacamole | `https://guac.netbfrs.fr` |
| `GUACAMOLE_USER` | Utilisateur Guacamole admin | `guacadmin` |
| `GUACAMOLE_PASSWORD` | Mot de passe Guacamole | `password` |

> **Note** : `JWT_SECRET` est defini en dur dans le code (`ai2lean-secret-key-2026`). A externaliser en production.

### Frontend (`/app/frontend/.env`)

| Variable | Description | Exemple |
|----------|------------|---------|
| `REACT_APP_BACKEND_URL` | URL publique du backend | `https://api.ai2lean.netbfrs.fr` |
| `WDS_SOCKET_PORT` | Port WebSocket dev server | `0` |
| `ENABLE_HEALTH_CHECK` | Health check | `true` |

---

## 6. DEPENDANCES EXTERNES

### Services tiers utilises

| Service | Usage | Requis ? |
|---------|-------|----------|
| **MongoDB** | Base de donnees principale | **Oui** |
| **Proxmox VE** | Gestion VMs pour les labs pratiques | Non (labs desactives sans) |
| **Apache Guacamole** | Acces RDP aux VMs via navigateur | Non (labs desactives sans) |
| **Google Gemini** (gemini-2.5-flash, 2.0-flash, 2.0-flash-lite) | Correction IA des questions ouvertes | Non (correction manuelle possible) |
| **Emergent LLM** (OpenAI via Emergent) | Fallback correction IA | Non |
| **Stripe** | Prevu (lib installee, non integre) | Non |

### Chaine LLM (fallback)

```
1. Cle utilisateur (DB settings) → detect provider (Google ou Emergent)
2. Si echec → Cle .env EMERGENT_LLM_KEY
3. Si echec → Erreur "Correction IA non disponible"
```

Modeles Google Gemini supportes : `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`.

---

## 7. FONCTIONNALITES IMPLEMENTEES

### ✅ Fait

| Fonctionnalite | Description |
|----------------|-------------|
| **Authentification JWT** | Register, login, role-based access, sessions actives |
| **Multi-formations** | BTS SIO SISR + Bachelor AIS avec categories dediees |
| **Exercices QCM + ouvertes** | Creation, soumission, correction auto QCM |
| **Correction IA** | Questions ouvertes corrigees par Gemini/Emergent avec fallback |
| **Labs pratiques (Proxmox)** | Clone VM, provisioning auto, acces RDP via Guacamole |
| **Validation VM** | Scripts PowerShell executes sur la VM pour verifier le travail |
| **Cours pedagogiques** | Cours standalone ou lies a un exercice, avec video/images/markdown |
| **Upload images & videos** | Multipart upload, serveur de fichiers statiques |
| **Image de couverture** | Cover image par cours avec apercu dans les listes |
| **Dashboards role-based** | Admin (stats globales + graphiques), Formateur (suivi), Etudiant (progression) |
| **Gamification** | Niveaux, XP, streaks, badges pour les etudiants |
| **Suivi etudiants** | Tracking progression, activite, scores par formation |
| **Export CSV** | Soumissions, tracking, resultats individuels |
| **Notifications** | Systeme de notifications in-app (corrections, demandes) |
| **Theme light/dark** | Toggle avec persistence localStorage |
| **Monitoring serveur** | Stats server, sessions actives, securite brute-force |
| **Mises a jour systeme** | Recherche, selection, installation, patch notes, historique |
| **Changement d'email** | Demande par utilisateur/formateur, approbation admin |
| **Changement de mot de passe** | Direct (avec ancien mdp) ou demande a l'admin |
| **Historique connexions** | IP, user-agent, date/heure de chaque login |
| **Detection brute-force** | IPs suspectes, comptes cibles (seuil 3 echecs/24h) |
| **Feedback manuel** | Formateur peut ajouter un commentaire sur une soumission |
| **Mode examen** | Fullscreen + anti-copie pour les exercices |

### 🔜 Prevu / Non implemente

| Fonctionnalite | Statut |
|----------------|--------|
| **Paiement Stripe** | Lib installee, non integre |
| **Mise a jour serveur depuis panel** | Gestion de services (restart, etc.) |
| **Mises a jour auto programmees** | Planification des updates |
| **Export PDF des resultats** | jspdf installe, integration partielle |

---

## 8. POINTS TECHNIQUES COMPLEXES

### 8.1 Systeme de correction IA

La correction IA est le coeur technique du projet. Flux :

1. Etudiant soumet un exercice (`POST /api/submissions`)
2. Les questions QCM sont corrigees immediatement (comparaison directe)
3. Pour les questions ouvertes, `grade_submission_with_ai()` est appele
4. Le prompt est construit avec : question, reponse attendue, reponse etudiant, contexte formation
5. Pour les labs, les resultats de validation VM (PowerShell) sont inclus dans le prompt
6. La reponse LLM est parsee en JSON : `{scores: [{question_id, points_earned, feedback}], total_score, general_feedback}`
7. Fallback : si les `question_id` ne matchent pas, les scores sont attribues dans l'ordre
8. Le score final = QCM auto + IA ouvertes, rapporte sur 20
9. Notification envoyee a l'etudiant

### 8.2 Provisioning des Labs Proxmox

Le flux de creation d'un lab est asynchrone :

1. `POST /api/labs/start` → verifie l'exercice type "lab" + pas de lab existant
2. Clone la VM template Proxmox (`proxmox_template_id` de l'exercice)
3. **Background task** (`_provision_lab_background`) :
   - Attend le clonage (polling status)
   - Demarre la VM
   - Attend le QEMU Guest Agent (IP disponible)
   - Execute des scripts PowerShell d'initialisation (si definis)
   - Cree la connexion Guacamole (RDP)
   - Met a jour le statut en DB a chaque etape
4. L'etudiant accede a la VM via iframe Guacamole

### 8.3 Systeme de theme (Light/Dark)

- `ThemeContext` gere l'etat du theme
- Classe `dark` sur `<html>` pour Tailwind `dark:` variants
- Variables CSS custom (`th-page`, `th-text`, `th-sidebar`, etc.) dans `index.css`
- Persistence dans `localStorage` sous cle `ai2lean-theme`
- Toggle accessible dans le header de la sidebar

### 8.4 Gestion des formations

- Un selecteur de formation active dans la sidebar (admin/formateur)
- Toutes les requetes de stats/exercices/cours filtrables par `?formation=`
- Les etudiants sont lies a une formation, les exercices aussi
- `shared: true` sur un exercice le rend visible a toutes les formations

### 8.5 Mises a jour systeme depuis le panel

- Execution de commandes systeme via `asyncio.create_subprocess_exec`
- `apt-get update` + `apt list --upgradable` pour la detection
- `apt-get upgrade -y` ou `apt-get install -y --only-upgrade [pkgs]` pour l'installation
- Parsing des changelogs Debian (`apt-get changelog`) avec extraction des entries versionnees
- Historique persiste en DB avec output complet et packages mis a jour
- Protection admin-only sur tous les endpoints

---

## 9. COMPTES DE TEST

| Role | Email | Mot de passe | Formation |
|------|-------|-------------|-----------|
| **Admin** | admin@netbfrs.fr | admin123 | BTS SIO SISR |
| **Formateur** | formateur@netbfrs.fr | formateur123 | BTS SIO SISR |
| **Etudiant BTS** | alice.martin@netbfrs.fr | etudiant123 | BTS SIO SISR |
| **Etudiant BTS** | bob.durand@netbfrs.fr | etudiant123 | BTS SIO SISR |
| **Etudiant Bachelor** | claire.petit@netbfrs.fr | etudiant123 | Bachelor AIS |
| **Etudiant Bachelor** | david.moreau@netbfrs.fr | etudiant123 | Bachelor AIS |

> Ces comptes sont crees automatiquement par `POST /api/seed` au demarrage de l'application.

---

*Fin du rapport technique — AI2Lean v2.5*
