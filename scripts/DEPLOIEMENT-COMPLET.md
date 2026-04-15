# ============================================================
#  AI2Lean - Guide de deploiement complet
#  VM Debian 12 + Guacamole (192.168.1.202)
# ============================================================

## Architecture du deploiement

```
                     Reseau local 192.168.1.0/24
                              |
    ┌─────────────────────────┼─────────────────────────┐
    |                         |                         |
    v                         v                         v
[ VM Web Server ]     [ VM Guacamole ]          [ VM Proxmox ]
  Debian 12              192.168.1.202            (labs VMs)
  - Nginx :80/:443       - Guacamole :8080
  - FastAPI :8001        - PostgreSQL
  - MongoDB :27017       - Tomcat
  - React (statique)
  - Videos MP4
```

### Flux utilisateur :

1. L'etudiant accede a `http://IP-WEB-SERVER/`
2. Il se connecte (JWT)
3. Il consulte le **cours** (texte + video MP4) avant chaque lab
4. Il clique **"Demarrer le Lab"** → VM provisionnee via Proxmox
5. Il accede au bureau distant via **Guacamole** (proxy Nginx)
6. Il soumet ses reponses → **Correction IA** automatique

---

## Pre-requis

### VM Web Server (Debian 12)
- Debian 12 (Bookworm) ou 13
- Minimum 2 Go RAM, 20 Go disque (plus pour les videos)
- Acces root (SSH)
- IP fixe sur le reseau local

### VM Guacamole (192.168.1.202)
- Debian 12 ou Ubuntu 22.04+
- Minimum 1 Go RAM
- IP fixe : 192.168.1.202

---

## Partie 1 : Installation de Guacamole (VM 192.168.1.202)

### Installation rapide avec Docker

```bash
# Sur la VM Guacamole (192.168.1.202)
ssh root@192.168.1.202

# Installer Docker
curl -fsSL https://get.docker.com | sh

# Creer le docker-compose.yml
mkdir -p /opt/guacamole && cd /opt/guacamole

cat > docker-compose.yml << 'EOF'
version: '3'

services:
  guacdb:
    image: postgres:15
    environment:
      POSTGRES_DB: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: GuacP@ss2026!
    volumes:
      - ./init:/docker-entrypoint-initdb.d
      - pgdata:/var/lib/postgresql/data
    restart: always

  guacd:
    image: guacamole/guacd
    restart: always

  guacamole:
    image: guacamole/guacamole
    depends_on:
      - guacdb
      - guacd
    environment:
      GUACD_HOSTNAME: guacd
      POSTGRES_HOSTNAME: guacdb
      POSTGRES_DATABASE: guacamole_db
      POSTGRES_USER: guacamole_user
      POSTGRES_PASSWORD: GuacP@ss2026!
    ports:
      - "8080:8080"
    restart: always

volumes:
  pgdata:
EOF

# Generer le schema de la BDD
mkdir -p init
docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --postgresql > init/initdb.sql

# Demarrer
docker compose up -d

# Verifier
sleep 10
curl -s http://localhost:8080/guacamole/ | head -5
```

### Acces : `http://192.168.1.202:8080/guacamole/`
- Login : `guacadmin` / `guacadmin`
- **⚠ Changez le mot de passe admin immediatement !**

### Installation manuelle (sans Docker)

```bash
apt-get update && apt-get install -y \
    guacamole-client guacd libguac-client-rdp \
    postgresql tomcat9

# Suivre la doc officielle :
# https://guacamole.apache.org/doc/gug/installing-guacamole.html
```

---

## Partie 2 : Installation du serveur web (Debian 12)

### Option A : Script automatise (recommande)

```bash
# Sur la VM Web Server
ssh root@IP-WEB-SERVER

# 1. Copier le projet
# Option via git :
git clone VOTRE_REPO /opt/ai2lean-src
# Option via scp :
scp -r /chemin/local/app root@IP-WEB-SERVER:/opt/ai2lean-src

# 2. Lancer le script
cd /opt/ai2lean-src/scripts
chmod +x deploy-debian.sh
sudo bash deploy-debian.sh
```

Le script va :
1. Installer Node.js 20, Python 3, MongoDB 7, Nginx
2. Configurer le backend FastAPI avec venv Python
3. Builder le frontend React
4. Configurer Nginx (reverse proxy + Guacamole proxy)
5. Creer un service systemd
6. Configurer le firewall
7. (Optionnel) Installer SSL Let's Encrypt

### Option B : Installation manuelle

#### 1. Paquets systeme

```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl wget gnupg2 nginx python3 python3-pip python3-venv
```

#### 2. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g yarn
```

#### 3. MongoDB 7

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | \
    tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update && apt-get install -y mongodb-org
systemctl enable mongod && systemctl start mongod
```

#### 4. Backend

```bash
mkdir -p /opt/ai2lean
cp -r backend/ /opt/ai2lean/backend/
cp -r frontend/ /opt/ai2lean/frontend/

cd /opt/ai2lean/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
mkdir -p uploads/videos
```

Creer `/opt/ai2lean/backend/.env` :
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ai2lean_production
CORS_ORIGINS=*
JWT_SECRET=VOTRE_SECRET_GENERE
EMERGENT_LLM_KEY=VOTRE_CLE_ICI
GUACAMOLE_URL=http://192.168.1.202:8080
GUACAMOLE_USER=guacadmin
GUACAMOLE_PASSWORD=guacadmin
PROXMOX_HOST=IP_PROXMOX
PROXMOX_PORT=8006
PROXMOX_NODE=NOM_NODE
PROXMOX_USER=user@pve
PROXMOX_TOKEN_NAME=token-name
PROXMOX_TOKEN_SECRET=token-secret
PROXMOX_TEMPLATE_WINSERVER=9002
```

#### 5. Service systemd

```bash
cat > /etc/systemd/system/ai2lean-backend.service << 'EOF'
[Unit]
Description=AI2Lean Backend
After=network.target mongod.service

[Service]
Type=simple
WorkingDirectory=/opt/ai2lean/backend
EnvironmentFile=/opt/ai2lean/backend/.env
ExecStart=/opt/ai2lean/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ai2lean-backend
systemctl start ai2lean-backend
```

#### 6. Frontend

```bash
cd /opt/ai2lean/frontend
echo "REACT_APP_BACKEND_URL=http://VOTRE_IP" > .env
yarn install
yarn build
```

#### 7. Nginx

```bash
cat > /etc/nginx/sites-available/ai2lean << 'EOF'
client_max_body_size 500M;

server {
    listen 80;
    server_name _;

    root /opt/ai2lean/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /guacamole/ {
        proxy_pass http://192.168.1.202:8080/guacamole/;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/ai2lean /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## Partie 3 : Utilisation des cours

### Creer un cours (admin/formateur)

1. Connectez-vous en tant qu'admin ou formateur
2. Cliquez sur **"Cours"** dans la barre laterale
3. Cliquez sur **"Creer un cours"**
4. Selectionnez l'exercice lab associe
5. Remplissez :
   - **Titre** du cours
   - **Objectifs** (liste)
   - **Prerequis** (liste)
   - **Video** (upload MP4)
   - **Contenu** (texte avec formatage Markdown basique)
6. Sauvegardez

### Parcours etudiant

1. L'etudiant va dans **"Labs pratiques"**
2. Si un cours existe, il voit le badge **"Cours disponible"**
3. Il clique → page de cours avec video + texte
4. En bas, bouton **"Demarrer le Lab"** → lab VM

---

## Partie 4 : Gestion quotidienne

### Commandes

```bash
ai2lean status    # Statut de tous les services
ai2lean restart   # Redemarrer backend + nginx
ai2lean logs      # Logs du backend en temps reel
ai2lean update    # Mettre a jour le code
ai2lean backup    # Sauvegarder BDD + videos
ai2lean ssl dom   # Ajouter SSL pour un domaine
```

### Sauvegardes

```bash
# Manuelle
mongodump --db ai2lean_production --out /root/backups/$(date +%Y%m%d)

# Automatique (cron quotidien 3h)
crontab -e
0 3 * * * ai2lean backup
```

### Mise a jour du code

```bash
# Copier les nouveaux fichiers
scp -r backend/ root@IP:/opt/ai2lean/backend/
scp -r frontend/src/ root@IP:/opt/ai2lean/frontend/src/

# Sur le serveur
ai2lean update
```

---

## Depannage

### Le backend ne demarre pas
```bash
journalctl -u ai2lean-backend -n 50
# Verifier l'env
cat /opt/ai2lean/backend/.env
```

### Nginx 502
```bash
curl http://127.0.0.1:8001/api/
systemctl restart ai2lean-backend
```

### Guacamole inaccessible
```bash
# Depuis le web server, tester la connectivite
curl http://192.168.1.202:8080/guacamole/
# Si echec: verifier la VM Guacamole
ssh root@192.168.1.202 "docker compose -f /opt/guacamole/docker-compose.yml ps"
```

### Videos ne se chargent pas
```bash
# Verifier les permissions
ls -la /opt/ai2lean/backend/uploads/videos/
# Verifier Nginx (taille max)
grep client_max_body_size /etc/nginx/sites-available/ai2lean
```

---

## Identifiants par defaut

| Role       | Utilisateur   | Mot de passe    |
|------------|--------------|-----------------|
| Admin      | admin        | admin123        |
| Formateur  | formateur    | formateur123    |
| Etudiant 1 | etudiant1    | etudiant123     |
| Etudiant 2 | etudiant2    | etudiant123     |

> **⚠ IMPORTANT : Changez ces mots de passe en production !**
