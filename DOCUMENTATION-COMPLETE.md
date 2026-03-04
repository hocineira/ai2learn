# ============================================================
#  AI2Lean - DOCUMENTATION TECHNIQUE COMPLETE
#  Plateforme de Formation NETBFRS Academy
#  Date : Fevrier 2026
# ============================================================

## 1. PRESENTATION DU PROJET

### 1.1 Objectif
AI2Lean est une plateforme de formation IT pour l'academie NETBFRS. Elle permet :
- Le suivi en temps reel de la progression des etudiants
- La creation d'exercices interactifs (QCM + questions ouvertes)
- La correction automatique par IA (OpenAI GPT-5.2 via Emergent Integrations)
- Le lancement de labs pratiques (VM Windows Server via Proxmox + Guacamole)
- Le deploiement sur VPS Debian 12

### 1.2 Formations supportees
1. **BTS SIO SISR** (Bac+2) - Solutions d'Infrastructure, Systemes et Reseaux
2. **Bachelor AIS** (Bac+3, RNCP 37680) - Administrateur d'Infrastructures Securisees

### 1.3 Roles utilisateurs
| Role | Acces |
|------|-------|
| **admin** | Dashboard global, gestion utilisateurs, gestion exercices, soumissions, suivi etudiants |
| **formateur** | Dashboard par formation, creation/modification exercices, suivi etudiants, soumissions |
| **etudiant** | Dashboard personnel, exercices de sa formation, resultats, labs pratiques |

### 1.4 Identifiants de demo
| Role | Username | Mot de passe | Formation |
|------|----------|-------------|-----------|
| Admin | admin | admin123 | bts-sio-sisr |
| Formateur | formateur | formateur123 | bts-sio-sisr |
| Etudiant BTS 1 | etudiant1 | etudiant123 | bts-sio-sisr |
| Etudiant BTS 2 | etudiant2 | etudiant123 | bts-sio-sisr |
| Etudiant AIS 1 | ais_student1 | etudiant123 | bachelor-ais |
| Etudiant AIS 2 | ais_student2 | etudiant123 | bachelor-ais |

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Stack
| Couche | Technologie | Details |
|--------|------------|---------|
| Frontend | React 19 + Tailwind CSS 3 + Shadcn/UI | Theme sombre, accents cyan/violet |
| Backend | FastAPI + Motor (async MongoDB) | Monolithe dans `server.py` |
| Base de donnees | MongoDB 7 | Via `motor` (async driver) |
| Auth | JWT (PyJWT) + bcrypt | Token dans `localStorage` |
| IA | OpenAI GPT-5.2 | Via `emergentintegrations` library |
| Labs (en cours) | Proxmox VE + Apache Guacamole | Clonage VM + RDP dans le navigateur |
| Deploiement | Nginx + systemd sur Debian 12 | Script `install.sh` automatise |

### 2.2 Structure des fichiers
```
/app/
├── backend/
│   ├── .env                    # Variables d'environnement (MONGO_URL, EMERGENT_LLM_KEY, PROXMOX_*, GUACAMOLE_*)
│   ├── requirements.txt        # Dependances Python (pip freeze)
│   └── server.py               # TOUT le backend (1003 lignes) - FastAPI monolithe
│
├── frontend/
│   ├── .env                    # REACT_APP_BACKEND_URL
│   ├── package.json            # Dependances Node (yarn)
│   ├── src/
│   │   ├── App.js              # Router principal (BrowserRouter, Routes protegees)
│   │   ├── index.css           # Styles globaux (theme sombre, animations, gradients)
│   │   ├── index.js            # Point d'entree React
│   │   ├── contexts/
│   │   │   └── AuthContext.js  # Contexte auth (login, register, logout, token, formation active)
│   │   ├── components/
│   │   │   ├── Sidebar.js      # Barre laterale (navigation, switcher formation, menu utilisateur)
│   │   │   └── ui/             # Composants Shadcn/UI (button, card, badge, select, table, tabs, progress, etc.)
│   │   ├── pages/
│   │   │   ├── LoginPage.js           # Page connexion/inscription
│   │   │   ├── AdminDashboard.js      # Dashboard admin (stats globales, par formation)
│   │   │   ├── FormateurDashboard.js  # Dashboard formateur (stats, suivi, exercices)
│   │   │   ├── EtudiantDashboard.js   # Dashboard etudiant (progression, exercices dispo, resultats)
│   │   │   ├── ExercisesPage.js       # Liste des exercices (filtrable par categorie)
│   │   │   ├── ExerciseCreate.js      # Creation d'exercice (QCM + questions ouvertes)
│   │   │   ├── ExerciseTake.js        # Passage d'un exercice (navigation question par question, timer)
│   │   │   ├── ResultsPage.js         # Resultats etudiant (liste + detail avec feedback IA)
│   │   │   ├── SubmissionsPage.js     # Soumissions (formateur/admin : voir toutes, declencher correction IA)
│   │   │   ├── TrackingPage.js        # Suivi etudiants (cartes avec progression)
│   │   │   └── UsersPage.js           # Gestion utilisateurs admin (modifier role/formation, supprimer)
│   │   ├── hooks/
│   │   │   └── use-toast.js           # Hook pour les toasts
│   │   └── lib/
│   │       └── utils.js               # Utilitaire cn() pour Tailwind
│   └── tailwind.config.js
│
├── scripts/
│   ├── install.sh              # Script d'installation Debian 12 (Node, Python, MongoDB, Nginx, build)
│   ├── DEPLOIEMENT.md          # Guide complet de deploiement VPS
│   └── GUIDE-LABS-PROXMOX.md   # Guide A-Z : Token API, Guacamole LXC, Template Windows Server, Exercice DHCP
│
├── memory/
│   └── PRD.md                  # Product Requirements Document
│
└── DOCUMENTATION-COMPLETE.md   # CE FICHIER
```

### 2.3 Variables d'environnement

#### Backend (`backend/.env`)
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY=sk-emergent-XXXXXX         # Cle Emergent pour OpenAI GPT-5.2

# Proxmox
PROXMOX_HOST=94.187.145.238
PROXMOX_PORT=20850
PROXMOX_NODE=SRVDEPLOY
PROXMOX_USER=ai2lean@pve
PROXMOX_TOKEN_NAME=ai2lean-token
PROXMOX_TOKEN_SECRET=lab-portal-10           # REMPLACEZ par votre vrai token secret
PROXMOX_TEMPLATE_WINSERVER=9002

# Guacamole
GUACAMOLE_URL=http://94.187.145.238:20999
GUACAMOLE_USER=guacadmin
GUACAMOLE_PASSWORD=guacadmin
```

#### Frontend (`frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://votre-domaine.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

---

## 3. BACKEND - API DETAILLEE (`server.py`)

### 3.1 Configuration & Initialisation (lignes 1-31)
- Chargement `.env` avec `python-dotenv`
- Connexion MongoDB async avec `motor`
- JWT secret et config
- Logger configure

### 3.2 Donnees statiques (lignes 33-73)
**FORMATIONS** : Liste de 2 formations avec id, name, full_name, level, description, color
**CATEGORIES_BY_FORMATION** : Dictionnaire avec les categories par formation
- BTS SISR : 6 categories (admin-systeme, reseaux, cybersecurite, virtualisation, services-infra, scripting)
- Bachelor AIS : 8 categories (admin-securise, conception-infra, cyber-gestion, cloud-virtualisation, supervision, automatisation, reseaux-avances, gestion-projet)

### 3.3 Modeles Pydantic (lignes 75-116)
- `UserCreate` : username, password, full_name, role, formation
- `UserLogin` : username, password
- `UserUpdate` : role (optionnel), formation (optionnel)
- `ExerciseQuestion` : id (auto UUID), question_text, question_type (qcm/open), options, correct_answer, points
- `ExerciseCreate` : title, description, category, formation, questions[], time_limit, shared
- `SubmissionAnswer` : question_id, answer
- `SubmissionCreate` : exercise_id, answers[]
- `LabStart` : exercise_id

### 3.4 Endpoints API

#### Auth
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/auth/register` | Inscription | Non |
| POST | `/api/auth/login` | Connexion | Non |
| GET | `/api/auth/me` | Profil utilisateur courant | Oui |

#### Formations & Categories
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/formations` | Liste des formations | Non |
| GET | `/api/categories?formation=xxx` | Categories par formation | Non |

#### Utilisateurs
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/users?formation=xxx` | Liste utilisateurs | admin/formateur |
| PUT | `/api/users/{user_id}` | Modifier role/formation | admin |
| DELETE | `/api/users/{user_id}` | Supprimer utilisateur | admin |

#### Exercices
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/exercises` | Creer un exercice | admin/formateur |
| GET | `/api/exercises?category=&formation=` | Lister exercices | Oui |
| GET | `/api/exercises/{id}` | Detail exercice | Oui |
| PUT | `/api/exercises/{id}` | Modifier exercice | admin/formateur |
| DELETE | `/api/exercises/{id}` | Supprimer exercice | admin/formateur |

Note : Les `correct_answer` sont masques pour les etudiants dans GET.

#### Soumissions
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/submissions` | Soumettre un exercice | etudiant |
| GET | `/api/submissions?exercise_id=&formation=` | Lister soumissions | Oui (etudiant=ses propres) |
| GET | `/api/submissions/{id}` | Detail soumission | Oui |

Note : La soumission declenche automatiquement la correction IA pour les questions ouvertes.

#### Correction IA
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/grade/{submission_id}` | Declencher correction IA | admin/formateur |

#### Statistiques
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/stats/overview?formation=` | Stats globales (admin/formateur) | admin/formateur |
| GET | `/api/stats/student` | Stats de l'etudiant courant | etudiant |
| GET | `/api/stats/students-tracking?formation=` | Suivi etudiants | admin/formateur |

#### Labs (Proxmox + Guacamole) - IMPLEMENTE
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/labs/start` | Demarrer un lab (clone VM + Guacamole) | etudiant |
| GET | `/api/labs/status/{exercise_id}` | Statut du lab en cours | Oui |
| POST | `/api/labs/stop/{exercise_id}` | Arreter le lab (detruit VM) | Oui |
| GET | `/api/labs/active` | Labs actifs (admin/formateur) | admin/formateur |

#### Seed
| Methode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/seed` | Initialiser donnees demo | Non |

### 3.5 Correction IA - Algorithme detaille (lignes 401-512)
1. Recupere la soumission et l'exercice depuis MongoDB
2. Identifie les questions ouvertes (non QCM)
3. Construit un prompt en francais demandant une reponse JSON avec scores par question
4. Appelle `emergentintegrations` avec `LlmChat` + `UserMessage`, modele `openai/gpt-5.2`
5. Parse la reponse JSON
6. Essaie d'abord de matcher par `question_id`, puis en fallback par ordre
7. Calcule le score total (QCM + IA) et normalise sur /20
8. Met a jour la soumission en base

### 3.6 Integration Labs - Algorithme detaille (lignes 718-993)
Le flux `POST /api/labs/start` :
1. Verifie que l'exercice est de type "lab" (`exercise_type == "lab"`)
2. Verifie qu'aucun lab n'est deja en cours pour cet etudiant/exercice
3. Se connecte a Proxmox via `proxmoxer` (token API)
4. Trouve un VMID disponible (a partir de 20001)
5. Clone le template VM (full clone)
6. Attend que le clone soit fini (poll toutes les 2s, max 30 iterations)
7. Demarre la VM clonee
8. Attend que la VM obtienne une IP via QEMU Guest Agent (poll toutes les 3s, max 30 iterations)
9. Cree une connexion RDP dans Guacamole via l'API REST
10. Sauvegarde le lab dans MongoDB avec statut "running"
11. Retourne l'URL Guacamole encodee en base64

Le flux `POST /api/labs/stop/{exercise_id}` :
1. Trouve le lab actif
2. Arrete la VM via Proxmox API
3. Attend 5 secondes
4. Supprime la VM
5. Supprime la connexion Guacamole
6. Met a jour le statut en "stopped"

---

## 4. FRONTEND - PAGES DETAILLEES

### 4.1 Router (`App.js`)
```
/login                -> LoginPage (non authentifie uniquement)
/dashboard            -> AdminDashboard | FormateurDashboard | EtudiantDashboard (selon role)
/exercises            -> ExercisesPage
/exercises/create     -> ExerciseCreate (admin/formateur)
/exercises/:id        -> ExerciseTake
/users                -> UsersPage (admin)
/tracking             -> TrackingPage (admin/formateur)
/results              -> ResultsPage (liste)
/results/:id          -> ResultsPage (detail)
/submissions          -> SubmissionsPage (admin/formateur)
/stats                -> AdminDashboard (admin)
/*                    -> Redirect vers /dashboard
```

Toutes les routes protegees sont wrappees dans `<Sidebar>`.

### 4.2 Contexte Auth (`AuthContext.js`)
Expose via `useAuth()` :
- `user` : objet utilisateur courant (id, username, full_name, role, formation)
- `token` : JWT token (stocke dans localStorage)
- `loading` : boolean
- `login(username, password)` : connexion
- `register(username, password, fullName, role, formation)` : inscription
- `logout()` : deconnexion
- `getAuthHeaders()` : retourne `{ Authorization: Bearer <token> }`
- `API` : URL de base (`REACT_APP_BACKEND_URL/api`)
- `activeFormation` : formation selectionnee (pour admin/formateur)
- `switchFormation(formationId)` : changer la formation active

### 4.3 Sidebar (`Sidebar.js`)
- Logo NETBFRS + branding AI2Lean
- Switcher de formation (admin/formateur uniquement)
- Navigation adaptee au role
- Menu utilisateur (dropdown) avec deconnexion
- Bouton collapse/expand
- Width : 64 (collapsed) / 256 (expanded)

### 4.4 Theme & Design
- Background principal : `#09090b` (zinc-950)
- Polices : Outfit (body), Space Grotesk (titres), JetBrains Mono (code)
- Gradient texte : cyan (#06b6d4) -> violet (#8b5cf6)
- Composants Shadcn/UI pre-configures en mode sombre
- Animations : fadeInUp, pulse-glow, typing
- Scrollbar personnalisee
- Effet glass-morphism sur les cartes (backdrop-blur)

### 4.5 Page ExerciseTake - Flux detaille
1. Charge l'exercice via GET `/api/exercises/:id`
2. Initialise le timer si `time_limit > 0`
3. Affiche les questions une par une avec navigation (dots + boutons)
4. QCM : boutons radio stylises, click pour selectionner
5. Ouvertes : textarea libre
6. Barre de progression basee sur le nombre de reponses
7. Bouton "Soumettre" (derniere question) -> POST `/api/submissions`
8. Affiche le resultat immediatement (score /20 + feedback IA si disponible)

---

## 5. BASE DE DONNEES - SCHEMAS MONGODB

### Collection `users`
```json
{
  "id": "uuid",
  "username": "string",
  "password": "bcrypt hash",
  "full_name": "string",
  "role": "admin|formateur|etudiant",
  "formation": "bts-sio-sisr|bachelor-ais",
  "created_at": "ISO datetime"
}
```

### Collection `exercises`
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "category": "string (ex: reseaux, admin-systeme)",
  "formation": "bts-sio-sisr|bachelor-ais",
  "shared": false,
  "questions": [
    {
      "id": "uuid",
      "question_text": "string",
      "question_type": "qcm|open",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "string",
      "points": 2
    }
  ],
  "time_limit": 15,
  "exercise_type": "standard|lab",
  "proxmox_template_id": 9002,
  "lab_username": "Administrator",
  "lab_password": "Lab2026!",
  "lab_instructions": "string",
  "created_by": "user_id",
  "created_by_name": "string",
  "created_at": "ISO datetime"
}
```
Note : Les champs `exercise_type`, `proxmox_template_id`, `lab_*` sont utilises uniquement pour les exercices de type "lab".

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
      "correct": true|false|null,
      "points_earned": 2,
      "ai_feedback": "string (questions ouvertes)"
    }
  ],
  "score": 8,
  "score_20": 14.3,
  "max_score": 12,
  "ai_feedback": "Feedback general de l'IA",
  "graded": true|false,
  "submitted_at": "ISO datetime"
}
```

### Collection `labs`
```json
{
  "id": "uuid",
  "exercise_id": "uuid",
  "student_id": "uuid",
  "student_name": "string",
  "vmid": 20001,
  "vm_name": "lab-username-20001",
  "vm_ip": "192.168.x.x|en-attente",
  "guac_connection_id": "string",
  "guac_url": "http://94.187.145.238:20999/guacamole/#/client/...",
  "status": "running|stopped",
  "started_at": "ISO datetime",
  "stopped_at": "ISO datetime|null"
}
```

---

## 6. INTEGRATION PROXMOX + GUACAMOLE

### 6.1 Architecture Labs
```
Etudiant (navigateur)
  |
  v
[AI2Lean Frontend] -- clic "Demarrer Lab" -->
  |
  v
[AI2Lean Backend] -- clone VM via API REST -->
  |
  v
[Proxmox VE (94.187.145.238:20850)]
  |
  +-- Template VM 9002 (Windows Server 2022 avec DHCP installe)
  +-- Clone -> VM 200XX (lab-username-200XX)
  |
  v
[Backend] -- cree connexion RDP via API REST -->
  |
  v
[Guacamole (94.187.145.238:20999)]
  |
  v
Etudiant recoit URL Guacamole -> Bureau Windows dans le navigateur
```

### 6.2 Credentials Proxmox
- Host : `94.187.145.238:20850`
- Node : `SRVDEPLOY`
- User : `ai2lean@pve`
- Token ID : `ai2lean-token`
- Token Secret : A REMPLACER (le secret dans .env actuel est `lab-portal-10` qui est incorrect, c'est l'ancien nom de l'env preview)
- Le vrai token secret est : `056e0a3f-ee79-414e-9775-377d12b298a3`
- Template VM ID : `9002` (Windows Server 2022 avec DHCP + RDP + QEMU Guest Agent)

### 6.3 Credentials Guacamole
- URL : `http://94.187.145.238:20999/guacamole/`
- Admin user : `guacadmin` / `guacadmin`
- Datasource : MySQL (via MariaDB dans un conteneur LXC ID 100)
- L'API REST utilise `/guacamole/api/tokens` pour l'auth et `/guacamole/api/session/data/{datasource}/connections` pour creer les connexions

### 6.4 Parametres VM clonee
- Username RDP : `Administrator`
- Password RDP : `Lab2026!`
- Protocole : RDP, port 3389
- Securite : NLA
- Couleur : 32-bit
- Le Guest Agent QEMU est installe pour detecter l'IP automatiquement

### 6.5 Etat actuel de l'integration
- Les endpoints backend sont IMPLEMENTES dans `server.py` (lignes 718-993)
- `proxmoxer` est installe dans requirements.txt
- Le frontend n'a PAS ENCORE de page/composant pour les labs (pas de LabPage.jsx, pas de route /labs)
- Il faut :
  1. Creer la page frontend `LabPage.jsx` pour afficher les labs disponibles et gerer le cycle de vie
  2. Ajouter la route dans `App.js`
  3. Ajouter le lien dans la Sidebar
  4. Permettre de creer des exercices de type "lab" dans ExerciseCreate.js
  5. Corriger le token secret dans `.env` (actuellement `lab-portal-10` au lieu de `056e0a3f-ee79-414e-9775-377d12b298a3`)

---

## 7. CORRECTION IA - DETAILS

### 7.1 Configuration
- Utilise `emergentintegrations` library (installee via pip avec extra-index-url)
- Cle : `EMERGENT_LLM_KEY` dans `.env`
- Modele : `openai/gpt-5.2`
- Session unique par soumission : `grading-{submission_id}`

### 7.2 Prompt de correction
Le systeme envoie un prompt en francais qui :
- Identifie la formation de l'exercice
- Fournit chaque question ouverte avec son texte, les points disponibles, la reponse attendue, et la reponse de l'etudiant
- Demande un JSON avec `scores` (array de {question_id, points_earned, feedback}) et `general_feedback`

### 7.3 Installation emergentintegrations
```bash
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

---

## 8. DEPLOIEMENT SUR VPS DEBIAN 12

### 8.1 Procedure rapide
```bash
scp -r /app root@VOTRE_IP:/app
cd /app/scripts && chmod +x install.sh && sudo bash install.sh
```

### 8.2 Ce que le script fait
1. Met a jour le systeme
2. Installe Node.js 20, Yarn, Python 3, MongoDB 7, Nginx, Certbot
3. Copie backend + frontend dans `/opt/sisr-io/`
4. Configure le `.env` backend (demande la cle LLM)
5. Cree un virtualenv Python + installe les dependances
6. Build le frontend React
7. Cree un service systemd pour le backend
8. Configure Nginx (reverse proxy `/api` -> FastAPI, `/` -> React build)
9. SSL optionnel via Let's Encrypt
10. Seed les donnees de demo
11. Cree la commande `sisr-io` pour la gestion rapide

### 8.3 Commandes de gestion post-deploiement
```bash
sisr-io status      # Voir statut des services
sisr-io restart     # Redemarrer tout
sisr-io logs        # Logs du backend
sisr-io update      # Rebuild frontend + restart backend
sisr-io ssl domaine # Activer SSL
```

---

## 9. TACHES RESTANTES (BACKLOG)

### P0 - Priorite haute
- [x] Endpoints backend labs (Proxmox clone, Guacamole connexion, stop)
- [x] Frontend page Labs (LabPage.jsx) + route + Sidebar link
- [x] Creation d'exercices de type "lab" dans ExerciseCreate.js
- [x] Corriger le token Proxmox dans .env (ai2learn@pve + bon secret)

### P1 - Priorite moyenne
- [x] Graphiques de progression (recharts sur Admin, Formateur, Etudiant dashboards)
- [x] Export resultats CSV/PDF (boutons sur toutes les pages, PDF via jsPDF)
- [ ] Validation automatique des labs (scripts PowerShell executes via Proxmox + notation IA)

### P2 - Priorite basse
- [ ] Templates VM additionnels (pfSense, Wazuh, Ansible)
- [ ] Monitoring labs en temps reel par les formateurs
- [ ] Systeme de badges/gamification
- [ ] Notifications temps reel (WebSocket)
- [ ] Progression par competences referentiel
- [ ] Commentaires formateur sur soumissions

### Refactoring
- [ ] Decouper server.py en modules (routers/labs.py, routers/auth.py, etc.)
- [ ] Sidebar : fix z-index overlay (bug cosmétique mineur)

---

## 10. GUIDES SPECIAUX

Les guides detailles pour configurer l'infrastructure se trouvent dans :
- `/app/scripts/GUIDE-LABS-PROXMOX.md` : Guide complet de A a Z pour Proxmox + Guacamole + Windows Server
- `/app/scripts/DEPLOIEMENT.md` : Guide de deploiement VPS
- `/app/scripts/install.sh` : Script d'installation automatique

---

## 11. CONVENTIONS DE CODE

### Backend
- Tout en un fichier `server.py` (a refactorer)
- Routes prefixees par `/api` via `APIRouter(prefix="/api")`
- Auth via `Depends(auth_dependency)` sur chaque route protegee
- MongoDB : projections `{"_id": 0}` systematiques pour eviter les erreurs de serialisation
- IDs : UUID v4 generes cote serveur (pas les ObjectId de MongoDB)
- Dates : `datetime.now(timezone.utc).isoformat()`

### Frontend
- Composants pages : `export default function PageName()`
- Composants reutilisables : `export const ComponentName`
- Shadcn/UI imports depuis `@/components/ui/xxx`
- Contexte auth via `useAuth()` hook
- API calls via `axios` avec `getAuthHeaders()`
- Style : Tailwind classes + styles inline pour `fontFamily: 'Space Grotesk'`
- Toasts via `sonner` (import `toast` from 'sonner')
- Data-testid sur tous les elements interactifs

### Nommage des fichiers
- Backend : `server.py` (monolithe)
- Frontend pages : `PascalCase.js` (ex: `ExerciseTake.js`)
- Frontend composants : `PascalCase.js` (ex: `Sidebar.js`)
- Frontend contexts : `PascalCase.js` (ex: `AuthContext.js`)
