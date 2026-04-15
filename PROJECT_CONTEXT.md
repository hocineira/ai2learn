# AI2Lean - NETBFRS Academy - Documentation Technique Complète

> Ce document est destiné à fournir un maximum de contexte à une IA ou un développeur reprenant le projet.

---

## 1. Vue d'ensemble

**AI2Lean** est une plateforme de formation IT multi-formations développée pour l'académie **NETBFRS**. Elle permet aux étudiants de suivre des cours, réaliser des exercices (QCM + questions ouvertes), accéder à des labs pratiques sur des machines virtuelles Windows Server via Proxmox/Guacamole, et recevoir une correction automatique par IA.

### Formations supportées
- **BTS SIO SISR** (Bac+2) - Admin Système, Réseaux, Cyber, Virtualisation, Services Infra, Scripting
- **Bachelor AIS** (Bac+3, RNCP 37680) - Admin & Sécurisation, Conception Infra, Cyber, Cloud, Supervision, Automatisation

---

## 2. Architecture technique

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND                               │
│  React 19 + Tailwind CSS + Shadcn/UI                         │
│  Thème clair (défaut) / sombre avec toggle                   │
│  Port: 3000 (dev) / build statique Nginx (prod)              │
├──────────────────────────────────────────────────────────────┤
│                        BACKEND                                │
│  FastAPI (Python 3.11+) + Motor (async MongoDB)              │
│  Auth JWT, CRUD exercices/cours/soumissions                  │
│  Port: 8001                                                   │
├──────────────────────────────────────────────────────────────┤
│                       DATABASE                                │
│  MongoDB 7.0 (ou 4.4 si pas d'AVX)                          │
│  Collections: users, exercises, submissions, courses, labs   │
├──────────────────────────────────────────────────────────────┤
│                    INTÉGRATIONS EXTERNES                      │
│  Proxmox VE → Provisionnement VMs pour les labs              │
│  Apache Guacamole → Bureau à distance (RDP) via navigateur   │
│  OpenAI GPT-5.2 (via Emergent) → Correction IA automatique  │
└──────────────────────────────────────────────────────────────┘
```

### Déploiement production
- **VM Web Server** : Debian 12, Nginx (reverse proxy), systemd
- **VM Guacamole** : 192.168.1.202:8080 (Docker avec PostgreSQL)
- **Proxmox** : Serveur de virtualisation pour les labs VM

---

## 3. Structure des fichiers

```
/app/
├── backend/
│   ├── server.py              # API FastAPI unique (toutes les routes)
│   ├── .env                   # Variables d'environnement
│   ├── requirements.txt       # Dépendances Python
│   ├── uploads/videos/        # Vidéos uploadées pour les cours
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.js             # Routes React + ThemeProvider
│   │   ├── index.css          # Thème clair/sombre (CSS variables)
│   │   ├── contexts/
│   │   │   ├── AuthContext.js  # Auth JWT + state utilisateur
│   │   │   └── ThemeContext.js # Toggle thème clair/sombre
│   │   ├── components/
│   │   │   ├── Sidebar.js     # Navigation + toggle thème
│   │   │   └── ui/            # Composants Shadcn/UI
│   │   └── pages/
│   │       ├── LoginPage.js           # Connexion par email
│   │       ├── AdminDashboard.js      # Dashboard admin (charts recharts)
│   │       ├── FormateurDashboard.js  # Dashboard formateur
│   │       ├── EtudiantDashboard.js   # Dashboard étudiant
│   │       ├── ExercisesPage.js       # Liste exercices (filtrable)
│   │       ├── ExerciseCreate.js      # Création exercice (QCM/ouvert/lab)
│   │       ├── ExerciseTake.js        # Passer un exercice
│   │       ├── CoursesListPage.js     # Liste des cours pédagogiques
│   │       ├── CourseCreatePage.js    # Créer/modifier un cours
│   │       ├── CoursePage.js          # Voir cours (lié à un exercice lab)
│   │       ├── CourseViewPage.js      # Voir cours standalone (par ID)
│   │       ├── LabsListPage.js        # Liste des labs pratiques
│   │       ├── LabPage.js             # Lab VM (start/stop/Guacamole)
│   │       ├── UsersPage.js           # Gestion utilisateurs (admin)
│   │       ├── TrackingPage.js        # Suivi étudiants
│   │       ├── ResultsPage.js         # Résultats (CSV/PDF export)
│   │       └── SubmissionsPage.js     # Soumissions (CSV export)
│   ├── .env                   # REACT_APP_BACKEND_URL
│   ├── package.json
│   └── tailwind.config.js     # darkMode: ["class"]
├── scripts/
│   ├── deploy-debian.sh       # Script déploiement automatisé Debian 12/13
│   ├── DEPLOIEMENT-COMPLET.md # Guide détaillé
│   └── install.sh             # Ancien script (legacy)
├── memory/
│   ├── PRD.md                 # Product Requirements Document
│   └── test_credentials.md    # Identifiants de test
└── test_result.md             # Historique des tests
```

---

## 4. API Backend - Endpoints

### Auth
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/register` | Inscription (email, password, full_name, role, formation) |
| POST | `/api/auth/login` | Connexion (email, password) → token JWT |
| GET | `/api/auth/me` | Utilisateur courant (Bearer token) |

### Exercices
| POST | `/api/exercises` | Créer (admin/formateur) |
| GET | `/api/exercises` | Lister (filtrable par formation/catégorie) |
| GET | `/api/exercises/{id}` | Détail |
| PUT | `/api/exercises/{id}` | Modifier |
| DELETE | `/api/exercises/{id}` | Supprimer |

### Cours pédagogiques
| POST | `/api/courses` | Créer un cours (exercise_id optionnel) |
| GET | `/api/courses` | Lister (filtrable par formation) |
| GET | `/api/courses/{id}` | Détail par ID |
| GET | `/api/courses/by-exercise/{exercise_id}` | Cours lié à un exercice |
| PUT | `/api/courses/{id}` | Modifier |
| DELETE | `/api/courses/{id}` | Supprimer |

### Vidéos
| POST | `/api/upload/video` | Upload MP4 (multipart) |
| GET | `/api/videos/{filename}` | Servir une vidéo |
| GET | `/api/videos` | Lister les vidéos |

### Soumissions & Correction IA
| POST | `/api/submissions` | Soumettre réponses |
| GET | `/api/submissions` | Lister |
| POST | `/api/grade/{submission_id}` | Déclencher correction IA |

### Labs VM (Proxmox + Guacamole)
| POST | `/api/labs/start` | Provisionner VM (clone + start) |
| GET | `/api/labs/status/{exercise_id}` | Statut du lab |
| GET | `/api/labs/guac-url/{exercise_id}` | URL Guacamole (RDP) |
| POST | `/api/labs/stop/{exercise_id}` | Arrêter et supprimer VM |

### Stats & Export
| GET | `/api/stats/overview` | Vue d'ensemble admin |
| GET | `/api/stats/charts` | Données graphiques (recharts) |
| GET | `/api/stats/student-charts` | Graphiques étudiant |
| GET | `/api/export/submissions-csv` | Export CSV soumissions |
| GET | `/api/export/tracking-csv` | Export CSV suivi |

### Seed
| POST | `/api/seed` | Initialiser données démo |

---

## 5. Authentification

- **JWT** : Token dans header `Authorization: Bearer <token>`
- **3 rôles** : `admin`, `formateur`, `etudiant`
- **Login par email** (format: prenom.nom@netbfrs.fr)
- **Identifiants démo** :
  - Admin : `admin@netbfrs.fr` / `admin123`
  - Formateur : `formateur@netbfrs.fr` / `formateur123`
  - Étudiants BTS : `alice.martin@netbfrs.fr` / `etudiant123`
  - Étudiants AIS : `claire.petit@netbfrs.fr` / `etudiant123`

---

## 6. Thème clair/sombre

- **Clair par défaut**, toggle ☀️/🌙 dans la sidebar
- Implémenté via `ThemeContext.js` + classe `dark` sur `<html>`
- CSS variables dans `index.css` (`:root` = clair, `.dark` = sombre)
- Tailwind `darkMode: ["class"]` + préfixes `dark:` sur les classes
- Persistance dans `localStorage` (clé `ai2lean-theme`)

---

## 7. Flux utilisateur principal

### Étudiant
1. Connexion par email → Dashboard avec stats personnelles
2. Consulter les **Cours** (texte + vidéo MP4 + objectifs)
3. Cliquer **"Démarrer le Lab"** → Provisionnement VM Proxmox
4. Accéder au bureau distant via **Guacamole** (RDP)
5. Soumettre les réponses → **Correction IA automatique** (GPT-5.2)
6. Voir les résultats et feedback IA

### Admin/Formateur
1. Créer des exercices (QCM, questions ouvertes, labs VM)
2. Créer des cours avec vidéo MP4 (optionnellement liés à un lab)
3. Suivre les étudiants en temps réel (graphiques recharts)
4. Exporter les données en CSV/PDF

---

## 8. Intégrations externes

### Proxmox VE
- **Connexion** : API token (host, port, user, token_name, token_secret)
- **Workflow** : Clone template → Start VM → Récupérer IP (QEMU Guest Agent) → Créer connexion Guacamole → Après soumission: Stop + Delete VM
- **Variables .env** : `PROXMOX_HOST`, `PROXMOX_PORT`, `PROXMOX_NODE`, `PROXMOX_USER`, `PROXMOX_TOKEN_NAME`, `PROXMOX_TOKEN_SECRET`, `PROXMOX_TEMPLATE_WINSERVER`

### Apache Guacamole
- **Serveur** : VM séparée 192.168.1.202:8080 (Docker)
- **API** : Création/suppression de connexions RDP via REST
- **Variables .env** : `GUACAMOLE_URL`, `GUACAMOLE_USER`, `GUACAMOLE_PASSWORD`

### Correction IA (Emergent/OpenAI)
- **Modèle** : GPT-5.2 via `emergentintegrations` (index PyPI privé)
- **Usage** : Correction des questions ouvertes + validation VM (PowerShell)
- **Variable .env** : `EMERGENT_LLM_KEY`
- **Note** : Si le module n'est pas installé, le serveur démarre quand même (correction IA désactivée)

---

## 9. Déploiement production (Debian 12)

### Script automatisé
```bash
cd scripts/
sudo bash deploy-debian.sh
```

### Architecture déployée
```
Internet → Nginx :80/:443
  ├─ /api/*     → FastAPI :8001 → MongoDB :27017
  ├─ /guacamole/* → Guacamole 192.168.1.202:8080
  └─ /*         → React build (statique)
```

### Commandes de gestion
```bash
ai2lean status    # Statut services
ai2lean restart   # Redémarrer
ai2lean logs      # Logs backend
ai2lean update    # Mettre à jour le code
ai2lean backup    # Sauvegarder BDD + vidéos
```

---

## 10. Variables d'environnement

### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ai2lean_production
CORS_ORIGINS=*
JWT_SECRET=<généré automatiquement>
EMERGENT_LLM_KEY=<optionnel>
GUACAMOLE_URL=http://192.168.1.202:8080
GUACAMOLE_USER=guacadmin
GUACAMOLE_PASSWORD=guacadmin
PROXMOX_HOST=<IP Proxmox>
PROXMOX_PORT=8006
PROXMOX_NODE=SRVDEPLOY
PROXMOX_USER=<user@pve>
PROXMOX_TOKEN_NAME=<token>
PROXMOX_TOKEN_SECRET=<secret>
PROXMOX_TEMPLATE_WINSERVER=9002
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://<IP_SERVEUR_OU_DOMAINE>
```

---

## 11. Dépendances principales

### Backend (Python)
- FastAPI 0.110 + Uvicorn 0.25
- Motor 3.3 (MongoDB async) + PyMongo 4.5
- PyJWT 2.11, bcrypt 4.1
- proxmoxer 2.3, requests 2.32
- emergentintegrations 0.1 (optionnel, index privé)

### Frontend (Node.js)
- React 19, React Router 7.5
- Tailwind CSS 3.4, tailwindcss-animate
- Shadcn/UI (Radix primitives)
- recharts 2.15 (graphiques)
- jsPDF + jspdf-autotable (export PDF)
- axios, lucide-react, sonner (toasts)

---

## 12. Collections MongoDB

### users
```json
{ "id": "uuid", "email": "x@netbfrs.fr", "username": "x@netbfrs.fr", "password": "bcrypt_hash", "full_name": "...", "role": "admin|formateur|etudiant", "formation": "bts-sio-sisr|bachelor-ais" }
```

### exercises
```json
{ "id": "uuid", "title": "...", "description": "...", "category": "...", "formation": "...", "exercise_type": "standard|lab", "questions": [...], "lab_instructions": "...", "proxmox_template_id": 9002 }
```

### courses
```json
{ "id": "uuid", "exercise_id": "uuid|null", "title": "...", "content": "markdown", "video_filename": "uuid.mp4|null", "objectives": [...], "prerequisites": [...], "formation": "...", "category": "..." }
```

### submissions
```json
{ "id": "uuid", "exercise_id": "uuid", "student_id": "uuid", "answers": [...], "score": 15, "score_20": 15.0, "max_score": 20, "ai_feedback": "...", "graded": true }
```

### labs
```json
{ "id": "uuid", "exercise_id": "uuid", "student_id": "uuid", "vmid": 120, "vm_name": "lab-xxx", "vm_ip": "192.168.1.x", "status": "running|cloning|starting|stopped|error", "guac_url": "...", "guac_connection_id": "..." }
```

---

## 13. Historique des modifications

1. **V1** : Plateforme initiale (auth, exercices QCM/ouvertes, correction IA, Proxmox labs, Guacamole RDP)
2. **V2** : Graphiques recharts (dashboards), exports CSV/PDF, fix Proxmox auth
3. **V3** : Pages de cours avant labs (texte + vidéo MP4 + bouton "Démarrer le Lab")
4. **V4** : Exercice lab optionnel dans les cours, cours standalone
5. **V5** : Thème clair par défaut + toggle sombre, mise à jour de toutes les pages
6. **V6** : Login par email, nouveau logo NETBFRS, script déploiement robuste (Nginx, MongoDB AVX fix)
