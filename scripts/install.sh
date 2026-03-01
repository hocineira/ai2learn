#!/bin/bash
# ============================================================
#  SISR.io - Script d'installation automatique
#  Debian 12 | MongoDB | FastAPI | React | Nginx
# ============================================================
#  Usage: sudo bash install.sh
# ============================================================

set -e

# ─── Couleurs ───
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${CYAN}[SISR.io]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $1"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

# ─── Verification root ───
if [ "$EUID" -ne 0 ]; then
  err "Ce script doit etre lance en root: sudo bash install.sh"
fi

# ─── Variables ───
APP_DIR="/opt/sisr-io"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_CONF="/etc/nginx/sites-available/sisr-io"
SERVICE_BACKEND="/etc/systemd/system/sisr-io-backend.service"

# Detecter l'IP publique du serveur
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         SISR.io - Installation automatique          ║${NC}"
echo -e "${CYAN}║         Plateforme de formation BTS SIO SISR        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Demander la configuration ───
read -p "Nom de domaine (laisser vide pour utiliser l'IP $SERVER_IP) : " DOMAIN
if [ -z "$DOMAIN" ]; then
  DOMAIN="$SERVER_IP"
  USE_DOMAIN=false
  log "Installation avec IP: $SERVER_IP"
else
  USE_DOMAIN=true
  log "Installation avec domaine: $DOMAIN"
fi

read -p "Installer SSL Let's Encrypt ? (o/N, requiert un domaine) : " INSTALL_SSL
INSTALL_SSL=${INSTALL_SSL,,}  # lowercase

read -p "Port pour le backend (defaut: 8001) : " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-8001}

read -p "Cle Emergent LLM pour l'IA (laisser vide pour configurer plus tard) : " LLM_KEY

# Generer un secret JWT aleatoire
JWT_SECRET=$(openssl rand -hex 32)

echo ""
log "Configuration:"
log "  Serveur     : $DOMAIN"
log "  Backend port: $BACKEND_PORT"
log "  Repertoire  : $APP_DIR"
log "  LLM Key     : ${LLM_KEY:+configuree}${LLM_KEY:-non configuree}"
echo ""
read -p "Continuer l'installation ? (O/n) : " CONFIRM
CONFIRM=${CONFIRM:-O}
if [[ ! "$CONFIRM" =~ ^[OoYy]$ ]]; then
  log "Installation annulee."
  exit 0
fi

# ============================================================
#  1. MISE A JOUR SYSTEME
# ============================================================
log "1/8 - Mise a jour du systeme..."
apt-get update -qq
apt-get upgrade -y -qq
ok "Systeme mis a jour"

# ============================================================
#  2. INSTALLATION DES DEPENDANCES
# ============================================================
log "2/8 - Installation des dependances..."
apt-get install -y -qq \
  curl wget gnupg2 git build-essential \
  python3 python3-pip python3-venv \
  nginx certbot python3-certbot-nginx \
  software-properties-common apt-transport-https ca-certificates

ok "Dependances systeme installees"

# ─── Node.js 20 LTS ───
if ! command -v node &> /dev/null; then
  log "Installation de Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node -v) installe"

# ─── Yarn ───
if ! command -v yarn &> /dev/null; then
  npm install -g yarn --silent > /dev/null 2>&1
fi
ok "Yarn $(yarn -v) installe"

# ─── MongoDB 7 ───
if ! command -v mongod &> /dev/null; then
  log "Installation de MongoDB 7..."
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
  systemctl enable mongod
  systemctl start mongod
  sleep 2
fi
# Verifier que MongoDB tourne
if systemctl is-active --quiet mongod; then
  ok "MongoDB actif"
else
  systemctl start mongod
  sleep 2
  if systemctl is-active --quiet mongod; then
    ok "MongoDB demarre"
  else
    err "MongoDB n'a pas pu demarrer. Verifiez: systemctl status mongod"
  fi
fi

# ============================================================
#  3. CREATION DU REPERTOIRE APPLICATIF
# ============================================================
log "3/8 - Creation de l'application..."
mkdir -p "$APP_DIR"

# ─── Copier le backend ───
if [ -d "/app/backend" ]; then
  cp -r /app/backend "$BACKEND_DIR"
  log "Backend copie depuis /app/backend"
else
  err "Repertoire /app/backend introuvable. Placez les fichiers source dans /app/"
fi

# ─── Copier le frontend ───
if [ -d "/app/frontend" ]; then
  cp -r /app/frontend "$FRONTEND_DIR"
  log "Frontend copie depuis /app/frontend"
else
  err "Repertoire /app/frontend introuvable. Placez les fichiers source dans /app/"
fi

ok "Fichiers applicatifs copies"

# ============================================================
#  4. CONFIGURATION BACKEND
# ============================================================
log "4/8 - Configuration du backend..."

# Creer le .env backend
cat > "$BACKEND_DIR/.env" << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=sisr_io_production
CORS_ORIGINS=*
JWT_SECRET=$JWT_SECRET
EMERGENT_LLM_KEY=${LLM_KEY:-VOTRE_CLE_ICI}
EOF

# Creer l'environnement virtuel Python
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate

# Installer les dependances Python
pip install --upgrade pip -q
pip install -r requirements.txt -q 2>/dev/null || true
pip install fastapi uvicorn motor pymongo python-dotenv bcrypt pyjwt python-multipart -q
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q 2>/dev/null || warn "emergentintegrations non installe (optionnel pour IA)"

deactivate
ok "Backend configure"

# ============================================================
#  5. BUILD FRONTEND
# ============================================================
log "5/8 - Build du frontend (cela peut prendre quelques minutes)..."

# Determiner l'URL backend
if [ "$USE_DOMAIN" = true ]; then
  BACKEND_URL="http://$DOMAIN"
else
  BACKEND_URL="http://$SERVER_IP"
fi

# Creer le .env frontend
cat > "$FRONTEND_DIR/.env" << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF

cd "$FRONTEND_DIR"

# Installer les dependances Node
yarn install --silent 2>/dev/null

# Build de production
yarn build 2>/dev/null
if [ -d "build" ]; then
  ok "Frontend build avec succes"
else
  err "Le build frontend a echoue. Lancez 'cd $FRONTEND_DIR && yarn build' pour voir les erreurs."
fi

# ============================================================
#  6. SERVICE SYSTEMD (Backend)
# ============================================================
log "6/8 - Creation du service systemd..."

cat > "$SERVICE_BACKEND" << EOF
[Unit]
Description=SISR.io Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$BACKEND_DIR
Environment=PATH=$BACKEND_DIR/venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$BACKEND_DIR/venv/bin/uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sisr-io-backend
systemctl start sisr-io-backend
sleep 3

if systemctl is-active --quiet sisr-io-backend; then
  ok "Service backend actif sur le port $BACKEND_PORT"
else
  warn "Le backend n'a pas demarre. Verifiez: journalctl -u sisr-io-backend -f"
fi

# ============================================================
#  7. CONFIGURATION NGINX
# ============================================================
log "7/8 - Configuration Nginx..."

cat > "$NGINX_CONF" << 'NGINX_EOF'
server {
    listen 80;
    server_name SERVER_NAME_PLACEHOLDER;

    # Frontend - fichiers statiques React
    root FRONTEND_DIR_PLACEHOLDER/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # API Backend - proxy vers FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Frontend - React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

# Remplacer les placeholders
sed -i "s|SERVER_NAME_PLACEHOLDER|$DOMAIN|g" "$NGINX_CONF"
sed -i "s|FRONTEND_DIR_PLACEHOLDER|$FRONTEND_DIR|g" "$NGINX_CONF"
sed -i "s|BACKEND_PORT_PLACEHOLDER|$BACKEND_PORT|g" "$NGINX_CONF"

# Activer le site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/sisr-io
rm -f /etc/nginx/sites-enabled/default

# Tester la config Nginx
nginx -t 2>/dev/null
if [ $? -eq 0 ]; then
  systemctl reload nginx
  ok "Nginx configure et recharge"
else
  err "Configuration Nginx invalide. Verifiez: nginx -t"
fi

# ============================================================
#  8. SSL LET'S ENCRYPT (optionnel)
# ============================================================
if [[ "$INSTALL_SSL" =~ ^[OoYy]$ ]] && [ "$USE_DOMAIN" = true ]; then
  log "8/8 - Installation du certificat SSL..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect 2>/dev/null
  if [ $? -eq 0 ]; then
    # Mettre a jour l'URL backend en HTTPS
    sed -i "s|REACT_APP_BACKEND_URL=http://|REACT_APP_BACKEND_URL=https://|" "$FRONTEND_DIR/.env"
    cd "$FRONTEND_DIR" && yarn build 2>/dev/null
    ok "SSL installe et actif"
  else
    warn "SSL echoue. Verifiez que le DNS pointe vers ce serveur et reessayez: certbot --nginx -d $DOMAIN"
  fi
else
  log "8/8 - SSL ignore (pas de domaine ou non demande)"
fi

# ============================================================
#  INITIALISATION DES DONNEES
# ============================================================
log "Initialisation des donnees de demonstration..."
sleep 2
curl -s -X POST "http://127.0.0.1:$BACKEND_PORT/api/seed" > /dev/null 2>&1
ok "Donnees de demo chargees"

# ============================================================
#  VERIFICATION FINALE
# ============================================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            VERIFICATION DE L'INSTALLATION           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0

# Test MongoDB
if systemctl is-active --quiet mongod; then
  ok "MongoDB          : actif"
else
  err="MongoDB          : INACTIF"
  echo -e "${RED}[ FAIL ]${NC} $err"
  ERRORS=$((ERRORS+1))
fi

# Test Backend
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/" 2>/dev/null)
if [ "$BACKEND_RESPONSE" = "200" ]; then
  ok "Backend API      : actif (port $BACKEND_PORT)"
else
  echo -e "${RED}[ FAIL ]${NC} Backend API      : HTTP $BACKEND_RESPONSE"
  ERRORS=$((ERRORS+1))
fi

# Test Nginx
if systemctl is-active --quiet nginx; then
  ok "Nginx            : actif"
else
  echo -e "${RED}[ FAIL ]${NC} Nginx            : INACTIF"
  ERRORS=$((ERRORS+1))
fi

# Test Frontend
if [ -f "$FRONTEND_DIR/build/index.html" ]; then
  ok "Frontend build   : present"
else
  echo -e "${RED}[ FAIL ]${NC} Frontend build   : ABSENT"
  ERRORS=$((ERRORS+1))
fi

# Test acces web
WEB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/" 2>/dev/null)
if [ "$WEB_RESPONSE" = "200" ]; then
  ok "Acces web        : fonctionnel"
else
  echo -e "${RED}[ FAIL ]${NC} Acces web        : HTTP $WEB_RESPONSE"
  ERRORS=$((ERRORS+1))
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}"
  echo "  Installation terminee avec succes !"
  echo ""
  if [ "$USE_DOMAIN" = true ]; then
    echo "  Acces : http://$DOMAIN"
  else
    echo "  Acces : http://$SERVER_IP"
  fi
  echo ""
  echo "  Identifiants de demo :"
  echo "    Admin     : admin / admin123"
  echo "    Formateur : formateur / formateur123"
  echo "    Etudiant  : etudiant1 / etudiant123"
  echo -e "${NC}"
else
  echo -e "${YELLOW}"
  echo "  Installation terminee avec $ERRORS erreur(s)."
  echo "  Consultez les logs pour diagnostiquer :"
  echo "    journalctl -u sisr-io-backend -f"
  echo "    journalctl -u nginx -f"
  echo "    systemctl status mongod"
  echo -e "${NC}"
fi

echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================
#  CREER UN SCRIPT DE GESTION RAPIDE
# ============================================================
cat > /usr/local/bin/sisr-io << 'MGMT_EOF'
#!/bin/bash
case "$1" in
  status)
    echo "=== SISR.io - Statut des services ==="
    echo -n "MongoDB  : "; systemctl is-active mongod
    echo -n "Backend  : "; systemctl is-active sisr-io-backend
    echo -n "Nginx    : "; systemctl is-active nginx
    ;;
  restart)
    echo "Redemarrage des services..."
    systemctl restart mongod
    systemctl restart sisr-io-backend
    systemctl restart nginx
    echo "OK"
    ;;
  logs)
    journalctl -u sisr-io-backend -f
    ;;
  update)
    echo "Mise a jour du frontend..."
    cd /opt/sisr-io/frontend && yarn build
    systemctl reload nginx
    echo "Redemarrage du backend..."
    systemctl restart sisr-io-backend
    echo "Mise a jour terminee"
    ;;
  ssl)
    if [ -z "$2" ]; then
      echo "Usage: sisr-io ssl mondomaine.fr"
      exit 1
    fi
    DOMAIN=$2
    sed -i "s|server_name .*|server_name $DOMAIN;|" /etc/nginx/sites-available/sisr-io
    sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=https://$DOMAIN|" /opt/sisr-io/frontend/.env
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
    cd /opt/sisr-io/frontend && yarn build
    systemctl reload nginx
    echo "SSL active pour $DOMAIN"
    ;;
  *)
    echo "Usage: sisr-io {status|restart|logs|update|ssl <domaine>}"
    ;;
esac
MGMT_EOF
chmod +x /usr/local/bin/sisr-io

ok "Commande 'sisr-io' installee (status|restart|logs|update|ssl)"
echo ""
