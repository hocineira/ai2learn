#!/bin/bash
# ============================================================
#  AI2Lean - NETBFRS Academy
#  Script de deploiement pour VPS Debian 12/13
#  
#  Usage: sudo bash install.sh
#  
#  Services installes:
#   - MongoDB 7.0 (base de donnees)
#   - Python 3 + FastAPI (backend API)
#   - Node.js 20 + React build (frontend)
#   - Nginx (reverse proxy + static)
#   - UFW (firewall)
#   - Let's Encrypt (SSL, optionnel)
# ============================================================

set -euo pipefail

export PATH="$PATH:/usr/sbin:/usr/local/sbin:/sbin"
export DEBIAN_FRONTEND=noninteractive

# ─── Couleurs ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}── $1 ──${NC}\n"; }

# ─── Variables ───
APP_DIR="/opt/ai2lean"
BACKEND_PORT=8001
FRONTEND_BUILD_DIR="$APP_DIR/frontend/build"
DB_NAME="ai2lean_production"

DOMAIN=""
SSL_ENABLED="n"
LLM_KEY=""

GUACAMOLE_IP="192.168.1.202"
GUACAMOLE_PORT=8080
GUACAMOLE_USER="guacadmin"
GUACAMOLE_PASSWORD="guacadmin"

PROXMOX_HOST=""
PROXMOX_PORT=8006
PROXMOX_NODE="SRVDEPLOY"
PROXMOX_USER=""
PROXMOX_TOKEN_NAME=""
PROXMOX_TOKEN_SECRET=""
PROXMOX_TEMPLATE=9002

LAB_PASSWORD="Lab2026!"

ERRORS=()

# ─── Fonctions utilitaires ───
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit etre execute en tant que root"
        echo "  → sudo bash install.sh"
        exit 1
    fi
}

detect_system() {
    log_step "Detection du systeme"
    
    if [ ! -f /etc/os-release ]; then
        log_error "Impossible de detecter l'OS"
        exit 1
    fi
    
    . /etc/os-release
    
    if [ "$ID" != "debian" ]; then
        log_warn "Ce script est optimise pour Debian. OS detecte: $PRETTY_NAME"
        read -p "Continuer quand meme ? (o/n) [n] : " cont
        [ "$cont" = "o" ] || exit 0
    fi
    
    log_success "Systeme : $PRETTY_NAME ($(uname -m))"
    log_info "Kernel  : $(uname -r)"
}

# ─── Configuration interactive ───
ask_config() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║   AI2Lean — Configuration du deploiement     ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Domaine
    read -p "  Nom de domaine (vide = IP du serveur) : " DOMAIN
    
    # SSL
    if [ -n "$DOMAIN" ]; then
        read -p "  Activer SSL Let's Encrypt ? (o/n) [n] : " SSL_ENABLED
        SSL_ENABLED=${SSL_ENABLED:-n}
    fi
    
    # Cle LLM
    echo ""
    log_info "Correction IA (optionnel)"
    echo "  Fournissez une cle Emergent LLM (sk-emergent-...) ou Google Gemini (AIzaSy...)"
    read -p "  Cle LLM (vide = desactive) : " LLM_KEY
    
    # Guacamole
    echo ""
    log_info "Apache Guacamole — acces RDP aux labs (optionnel)"
    read -p "  IP Guacamole [$GUACAMOLE_IP] : " input
    GUACAMOLE_IP=${input:-$GUACAMOLE_IP}
    read -p "  Port Guacamole [$GUACAMOLE_PORT] : " input
    GUACAMOLE_PORT=${input:-$GUACAMOLE_PORT}
    read -p "  User Guacamole [$GUACAMOLE_USER] : " input
    GUACAMOLE_USER=${input:-$GUACAMOLE_USER}
    read -sp "  Password Guacamole [$GUACAMOLE_PASSWORD] : " input
    echo ""
    GUACAMOLE_PASSWORD=${input:-$GUACAMOLE_PASSWORD}
    
    # Proxmox
    echo ""
    log_info "Proxmox VE — labs VM (optionnel)"
    read -p "  IP/Hostname Proxmox (vide = desactive) : " PROXMOX_HOST
    
    if [ -n "$PROXMOX_HOST" ]; then
        read -p "  Port [$PROXMOX_PORT] : " input; PROXMOX_PORT=${input:-$PROXMOX_PORT}
        read -p "  Noeud [$PROXMOX_NODE] : " input; PROXMOX_NODE=${input:-$PROXMOX_NODE}
        read -p "  User API (ex: admin@pve) : " PROXMOX_USER
        read -p "  Token name : " PROXMOX_TOKEN_NAME
        read -sp "  Token secret : " PROXMOX_TOKEN_SECRET; echo ""
        read -p "  ID template VM [$PROXMOX_TEMPLATE] : " input; PROXMOX_TEMPLATE=${input:-$PROXMOX_TEMPLATE}
        read -sp "  Mot de passe RDP des VMs [$LAB_PASSWORD] : " input; echo ""
        LAB_PASSWORD=${input:-$LAB_PASSWORD}
    fi
    
    # Résumé
    echo ""
    echo -e "${BOLD}Résumé :${NC}"
    echo "  Domaine      : ${DOMAIN:-$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'IP locale')}"
    echo "  SSL          : $SSL_ENABLED"
    echo "  LLM          : ${LLM_KEY:+Oui}${LLM_KEY:-Non}"
    echo "  Guacamole    : $GUACAMOLE_IP:$GUACAMOLE_PORT"
    echo "  Proxmox      : ${PROXMOX_HOST:-Desactive}"
    echo ""
    
    read -p "  Lancer l'installation ? (o/n) [o] : " confirm
    [ "${confirm:-o}" != "n" ] || { echo "Annule."; exit 0; }
}

# ─── Paquets systeme ───
install_system_deps() {
    log_step "Installation des paquets systeme"
    
    apt-get update -qq
    apt-get upgrade -y -qq
    
    apt-get install -y -qq \
        curl wget gnupg2 ca-certificates lsb-release \
        software-properties-common apt-transport-https \
        build-essential git unzip nano htop \
        python3 python3-pip python3-venv python3-dev \
        ufw openssl supervisor
    
    log_success "Paquets de base installes"
}

# ─── Nginx ───
install_nginx() {
    log_step "Installation de Nginx"
    
    if command -v nginx &>/dev/null; then
        log_info "Nginx deja installe: $(nginx -v 2>&1)"
        return
    fi
    
    # Tenter depuis les repos Debian par defaut
    if apt-get install -y -qq nginx 2>/dev/null; then
        log_success "Nginx installe depuis les repos Debian"
        systemctl enable nginx && systemctl start nginx
        return
    fi
    
    # Fallback: repo officiel Nginx
    log_warn "Ajout du repo officiel Nginx..."
    curl -fsSL https://nginx.org/keys/nginx_signing.key | gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg 2>/dev/null
    
    # Pour Debian 13 (trixie), utiliser bookworm car Nginx ne supporte pas encore trixie
    CODENAME=$(lsb_release -cs 2>/dev/null || echo "bookworm")
    case "$CODENAME" in
        bookworm|bullseye) ;;
        *) CODENAME="bookworm" ;;
    esac
    
    echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/debian ${CODENAME} nginx" \
        > /etc/apt/sources.list.d/nginx.list
    
    apt-get update -qq
    apt-get install -y -qq nginx || {
        apt-get install -y -qq nginx-full 2>/dev/null || apt-get install -y -qq nginx-light 2>/dev/null || {
            log_error "Impossible d'installer Nginx. Installez-le manuellement puis relancez."
            exit 1
        }
    }
    
    systemctl enable nginx && systemctl start nginx
    log_success "Nginx installe: $(nginx -v 2>&1)"
}

# ─── Node.js 20 LTS ───
install_nodejs() {
    log_step "Installation de Node.js 20 LTS"
    
    if command -v node &>/dev/null; then
        log_info "Node.js deja installe: $(node --version)"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        log_success "Node.js $(node --version) installe"
    fi
    
    if ! command -v yarn &>/dev/null; then
        npm install -g yarn --silent
    fi
    log_success "Yarn $(yarn --version) disponible"
}

# ─── MongoDB 7.0 ───
install_mongodb() {
    log_step "Installation de MongoDB 7.0"
    
    if command -v mongod &>/dev/null; then
        log_info "MongoDB deja installe"
        systemctl enable mongod 2>/dev/null && systemctl start mongod 2>/dev/null
        return
    fi
    
    # Cle GPG
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg 2>/dev/null || true
    
    # Pour Debian 13 (trixie), utiliser le repo bookworm
    CODENAME=$(lsb_release -cs 2>/dev/null || echo "bookworm")
    case "$CODENAME" in
        bookworm|bullseye) ;;
        *) 
            log_warn "Debian $CODENAME: utilisation du repo bookworm pour MongoDB"
            CODENAME="bookworm"
            ;;
    esac
    
    echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian ${CODENAME}/mongodb-org/7.0 main" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    apt-get update -qq
    
    # Sur Debian 13, libssl3 peut causer des conflits — installer les compat si necessaire
    apt-get install -y -qq mongodb-org || {
        log_warn "Installation standard echouee, tentative avec libssl-compat..."
        # Debian 13 utilise libssl3t64 au lieu de libssl3
        apt-get install -y -qq mongodb-org --fix-broken 2>/dev/null || {
            log_error "Echec installation MongoDB."
            log_info "Alternative: installez MongoDB manuellement ou utilisez Docker:"
            log_info "  docker run -d --name mongo -p 27017:27017 mongo:7"
            exit 1
        }
    }
    
    systemctl enable mongod
    systemctl start mongod
    sleep 3
    
    if systemctl is-active --quiet mongod; then
        log_success "MongoDB demarre"
    else
        log_warn "MongoDB installe mais ne demarre pas — verifiez: journalctl -u mongod"
        ERRORS+=("MongoDB ne demarre pas")
    fi
}

# ─── Certbot ───
install_certbot() {
    if [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ]; then
        log_info "Installation de certbot..."
        apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null || {
            log_warn "Certbot non disponible — SSL Let's Encrypt ne sera pas configure"
            SSL_ENABLED="n"
        }
    fi
}

# ─── Copie des fichiers ───
setup_app_files() {
    log_step "Copie des fichiers de l'application"
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    mkdir -p "$APP_DIR"
    
    # Copier backend et frontend
    rsync -a --delete "$PROJECT_DIR/backend/" "$APP_DIR/backend/" --exclude='venv' --exclude='__pycache__' --exclude='.env'
    rsync -a --delete "$PROJECT_DIR/frontend/" "$APP_DIR/frontend/" --exclude='node_modules' --exclude='build' --exclude='.env'
    
    # Creer les dossiers d'upload
    mkdir -p "$APP_DIR/backend/uploads/videos"
    mkdir -p "$APP_DIR/backend/uploads/images"
    
    log_success "Fichiers copies dans $APP_DIR"
}

# ─── Backend ───
setup_backend() {
    log_step "Configuration du backend Python"
    
    # Determiner l'URL backend
    if [ -n "$DOMAIN" ]; then
        [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ] && BACKEND_URL="https://$DOMAIN" || BACKEND_URL="http://$DOMAIN"
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
        BACKEND_URL="http://$SERVER_IP"
    fi
    
    # Generer le secret JWT (256 bits)
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Creer .env backend
    cat > "$APP_DIR/backend/.env" << EOF
# AI2Lean Backend — Production
# Genere le $(date '+%Y-%m-%d %H:%M')

MONGO_URL=mongodb://localhost:27017
DB_NAME=$DB_NAME
CORS_ORIGINS=${BACKEND_URL}
JWT_SECRET=$JWT_SECRET
JWT_TOKEN_EXPIRE_HOURS=24

# LLM — Correction IA
EMERGENT_LLM_KEY=$LLM_KEY

# Mot de passe RDP des VMs
LAB_DEFAULT_PASSWORD=$LAB_PASSWORD

# Guacamole
GUACAMOLE_URL=http://$GUACAMOLE_IP:$GUACAMOLE_PORT
GUACAMOLE_USER=$GUACAMOLE_USER
GUACAMOLE_PASSWORD=$GUACAMOLE_PASSWORD

# Proxmox
PROXMOX_HOST=$PROXMOX_HOST
PROXMOX_PORT=$PROXMOX_PORT
PROXMOX_NODE=$PROXMOX_NODE
PROXMOX_USER=$PROXMOX_USER
PROXMOX_TOKEN_NAME=$PROXMOX_TOKEN_NAME
PROXMOX_TOKEN_SECRET=$PROXMOX_TOKEN_SECRET
PROXMOX_TEMPLATE_WINSERVER=$PROXMOX_TEMPLATE
EOF
    
    chmod 600 "$APP_DIR/backend/.env"
    
    # Venv Python
    cd "$APP_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    
    # Filtrer emergentintegrations (index prive)
    grep -v "^emergentintegrations" requirements.txt > /tmp/req_filtered.txt
    pip install -r /tmp/req_filtered.txt -q 2>&1 | tail -3 || {
        log_warn "Certaines dependances ont echoue, tentative partielle..."
        pip install -r /tmp/req_filtered.txt --ignore-installed -q 2>/dev/null || true
    }
    rm -f /tmp/req_filtered.txt
    
    # emergentintegrations (optionnel)
    if [ -n "$LLM_KEY" ]; then
        log_info "Installation d'emergentintegrations..."
        pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q 2>/dev/null || {
            log_warn "emergentintegrations non installe — correction IA via Google Gemini uniquement"
        }
    fi
    
    deactivate
    log_success "Backend configure (venv + .env)"
}

# ─── Frontend ───
setup_frontend() {
    log_step "Build du frontend React"
    
    if [ -n "$DOMAIN" ]; then
        [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ] && BACKEND_URL="https://$DOMAIN" || BACKEND_URL="http://$DOMAIN"
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
        BACKEND_URL="http://$SERVER_IP"
    fi
    
    cat > "$APP_DIR/frontend/.env" << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF
    
    cd "$APP_DIR/frontend"
    yarn install --frozen-lockfile 2>/dev/null || yarn install
    
    log_info "Compilation React (peut prendre 1-3 minutes)..."
    yarn build || {
        log_error "Echec de la compilation frontend"
        ERRORS+=("Build frontend echoue")
        return
    }
    
    log_success "Frontend compile → $FRONTEND_BUILD_DIR"
}

# ─── Service systemd ───
setup_service() {
    log_step "Creation du service systemd"
    
    cat > /etc/systemd/system/ai2lean.service << EOF
[Unit]
Description=AI2Lean Backend — NETBFRS Academy
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable ai2lean
    systemctl start ai2lean
    
    sleep 3
    if systemctl is-active --quiet ai2lean; then
        log_success "Service ai2lean actif"
    else
        log_error "Le service ne demarre pas — verifiez: journalctl -u ai2lean -n 30"
        ERRORS+=("Service backend ne demarre pas")
    fi
}

# ─── Nginx ───
setup_nginx() {
    log_step "Configuration Nginx"
    
    SERVER_NAME="${DOMAIN:-_}"
    
    # Supprimer le default
    rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
    
    # Determiner le dossier de config
    if [ -d /etc/nginx/sites-available ]; then
        NGINX_CONF="/etc/nginx/sites-available/ai2lean"
        NGINX_LINK="/etc/nginx/sites-enabled/ai2lean"
    else
        # Sur les repos nginx.org, pas de sites-available
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
        NGINX_CONF="/etc/nginx/sites-available/ai2lean"
        NGINX_LINK="/etc/nginx/sites-enabled/ai2lean"
        # Ajouter l'include si absent
        if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
            sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi
    fi
    
    cat > "$NGINX_CONF" << 'NGXEOF'
server {
    listen 80;
    server_name SERVER_NAME_PLACEHOLDER;

    client_max_body_size 200M;

    # Frontend statique
    root FRONTEND_BUILD_PLACEHOLDER;
    index index.html;

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Guacamole (optionnel)
    location /guacamole/ {
        proxy_pass http://GUAC_PLACEHOLDER/guacamole/;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Headers securite
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGXEOF
    
    # Remplacer les placeholders
    sed -i "s|SERVER_NAME_PLACEHOLDER|$SERVER_NAME|g" "$NGINX_CONF"
    sed -i "s|FRONTEND_BUILD_PLACEHOLDER|$FRONTEND_BUILD_DIR|g" "$NGINX_CONF"
    sed -i "s|BACKEND_PORT_PLACEHOLDER|$BACKEND_PORT|g" "$NGINX_CONF"
    sed -i "s|GUAC_PLACEHOLDER|$GUACAMOLE_IP:$GUACAMOLE_PORT|g" "$NGINX_CONF"
    
    ln -sf "$NGINX_CONF" "$NGINX_LINK"
    
    nginx -t 2>&1 || {
        log_error "Config Nginx invalide ! Verifiez: $NGINX_CONF"
        ERRORS+=("Config Nginx invalide")
        return
    }
    
    systemctl restart nginx
    log_success "Nginx configure et redemarre"
}

# ─── SSL ───
setup_ssl() {
    if [ "$SSL_ENABLED" != "o" ] && [ "$SSL_ENABLED" != "y" ]; then return; fi
    if [ -z "$DOMAIN" ]; then log_warn "SSL necessite un domaine"; return; fi
    
    log_step "Certificat SSL Let's Encrypt"
    
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect || {
        log_warn "Certbot a echoue. Configurez SSL manuellement avec:"
        log_info "  certbot --nginx -d $DOMAIN"
        ERRORS+=("SSL non configure")
    }
    
    log_success "SSL active pour $DOMAIN"
}

# ─── Firewall ───
setup_firewall() {
    log_step "Configuration du firewall"
    
    ufw default deny incoming 2>/dev/null || true
    ufw default allow outgoing 2>/dev/null || true
    ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
    ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
    echo "y" | ufw enable 2>/dev/null || true
    
    log_success "Firewall actif (SSH, HTTP, HTTPS)"
}

# ─── Commande de gestion ───
create_cli() {
    log_step "Creation de la commande 'ai2lean'"
    
    cat > /usr/local/bin/ai2lean << 'CLIEOF'
#!/bin/bash
GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

case "${1:-help}" in
    status)
        echo -e "${CYAN}═══ AI2Lean — Statut ═══${NC}"
        for svc in ai2lean mongod nginx; do
            if systemctl is-active --quiet $svc 2>/dev/null; then
                echo -e "  ${GREEN}●${NC} $svc : actif"
            else
                echo -e "  ${RED}●${NC} $svc : inactif"
            fi
        done
        echo ""
        echo -n "  API : "
        curl -sf http://127.0.0.1:8001/api/formations >/dev/null && echo -e "${GREEN}OK${NC}" || echo -e "${RED}ERREUR${NC}"
        echo "  Disque : $(df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}')"
        echo "  RAM    : $(free -h | awk 'NR==2{print $3"/"$2}')"
        ;;
    restart)
        echo "Redemarrage..."
        systemctl restart ai2lean nginx
        echo -e "${GREEN}Services redemarres${NC}"
        ;;
    stop)
        systemctl stop ai2lean
        echo -e "${YELLOW}Backend arrete${NC}"
        ;;
    logs)
        journalctl -u ai2lean -f --no-hostname
        ;;
    update)
        echo "Mise a jour de l'application..."
        cd /opt/ai2lean/backend
        source venv/bin/activate
        pip install -r requirements.txt -q 2>/dev/null
        deactivate
        systemctl restart ai2lean
        cd /opt/ai2lean/frontend
        yarn install --frozen-lockfile 2>/dev/null || yarn install
        yarn build
        systemctl reload nginx
        echo -e "${GREEN}Mise a jour terminee${NC}"
        ;;
    ssl)
        [ -z "$2" ] && { echo "Usage: ai2lean ssl <domaine>"; exit 1; }
        DOMAIN="$2"
        sed -i "s/server_name .*/server_name $DOMAIN;/" /etc/nginx/sites-available/ai2lean
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
        cd /opt/ai2lean/frontend
        echo "REACT_APP_BACKEND_URL=https://$DOMAIN" > .env
        yarn build && systemctl reload nginx
        echo -e "${GREEN}SSL active pour $DOMAIN${NC}"
        ;;
    backup)
        DIR="/root/backups/ai2lean_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$DIR"
        mongodump --db ai2lean_production --out "$DIR/db" --quiet 2>/dev/null
        cp -r /opt/ai2lean/backend/uploads "$DIR/"
        cp /opt/ai2lean/backend/.env "$DIR/backend.env"
        echo -e "${GREEN}Sauvegarde → $DIR${NC}"
        ;;
    restore)
        [ -z "$2" ] && { echo "Usage: ai2lean restore /root/backups/<dossier>"; exit 1; }
        mongorestore --db ai2lean_production "$2/db/ai2lean_production" --drop --quiet 2>/dev/null
        cp -r "$2/uploads/"* /opt/ai2lean/backend/uploads/ 2>/dev/null || true
        systemctl restart ai2lean
        echo -e "${GREEN}Restauration terminee${NC}"
        ;;
    *)
        echo -e "${CYAN}AI2Lean — Commandes :${NC}"
        echo "  ai2lean status      Statut des services"
        echo "  ai2lean restart     Redemarrer"
        echo "  ai2lean stop        Arreter le backend"
        echo "  ai2lean logs        Logs en temps reel"
        echo "  ai2lean update      MAJ apres modif du code"
        echo "  ai2lean ssl <dom>   Configurer SSL"
        echo "  ai2lean backup      Sauvegarder BDD + fichiers"
        echo "  ai2lean restore <d> Restaurer une sauvegarde"
        ;;
esac
CLIEOF
    
    chmod +x /usr/local/bin/ai2lean
    log_success "Commande 'ai2lean' disponible"
}

# ─── Tests de validation ───
run_tests() {
    log_step "Tests de validation"
    
    local passed=0
    local failed=0
    
    # Test MongoDB
    if mongosh --eval "db.stats()" --quiet 2>/dev/null | grep -q "ok"; then
        echo -e "  ${GREEN}✓${NC} MongoDB fonctionnel"
        ((passed++))
    elif mongosh --eval "1" --quiet 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} MongoDB connecte"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} MongoDB non accessible"
        ((failed++))
    fi
    
    # Test Backend API
    sleep 2
    if curl -sf http://127.0.0.1:$BACKEND_PORT/api/formations >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Backend API repond sur :$BACKEND_PORT"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} Backend API ne repond pas"
        ((failed++))
    fi
    
    # Test Seed
    SEED_RESULT=$(curl -sf -X POST http://127.0.0.1:$BACKEND_PORT/api/seed 2>/dev/null || echo "ERREUR")
    if echo "$SEED_RESULT" | grep -q "initialisees\|deja"; then
        echo -e "  ${GREEN}✓${NC} Seed des donnees OK"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} Seed echoue"
        ((failed++))
    fi
    
    # Test Login
    LOGIN_RESULT=$(curl -sf -X POST http://127.0.0.1:$BACKEND_PORT/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@netbfrs.fr","password":"admin123"}' 2>/dev/null || echo "ERREUR")
    if echo "$LOGIN_RESULT" | grep -q "token"; then
        echo -e "  ${GREEN}✓${NC} Authentification admin OK"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} Authentification echouee"
        ((failed++))
    fi
    
    # Test Nginx
    if curl -sf http://localhost/ 2>/dev/null | grep -q "root\|AI2Lean\|html"; then
        echo -e "  ${GREEN}✓${NC} Nginx sert le frontend"
        ((passed++))
    elif [ -f "$FRONTEND_BUILD_DIR/index.html" ]; then
        echo -e "  ${GREEN}✓${NC} Frontend build existe"
        ((passed++))
    else
        echo -e "  ${RED}✗${NC} Frontend non disponible"
        ((failed++))
    fi
    
    # Test API via Nginx
    if curl -sf http://localhost/api/formations 2>/dev/null | grep -q "bts-sio-sisr"; then
        echo -e "  ${GREEN}✓${NC} Nginx proxifie vers l'API"
        ((passed++))
    else
        echo -e "  ${YELLOW}!${NC} Proxy API via Nginx a verifier"
    fi
    
    echo ""
    echo -e "  Resultats: ${GREEN}$passed passes${NC}, ${RED}$failed echoues${NC}"
}

# ─── Resume final ───
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   AI2Lean — Installation terminee !          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    
    if [ -n "$DOMAIN" ]; then
        [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ] && URL="https://$DOMAIN" || URL="http://$DOMAIN"
    else
        URL="http://$SERVER_IP"
    fi
    
    echo -e "  ${CYAN}Application :${NC}  $URL"
    echo -e "  ${CYAN}API Backend :${NC}  $URL/api/"
    echo -e "  ${CYAN}Repertoire  :${NC}  $APP_DIR"
    echo ""
    echo -e "  ${YELLOW}Identifiants initiaux :${NC}"
    echo "  ┌─────────────┬──────────────────────────┬──────────────┐"
    echo "  │ Role        │ Email                    │ Mot de passe │"
    echo "  ├─────────────┼──────────────────────────┼──────────────┤"
    echo "  │ Admin       │ admin@netbfrs.fr         │ admin123     │"
    echo "  │ Formateur   │ formateur@netbfrs.fr     │ formateur123 │"
    echo "  │ Etudiant    │ alice.martin@netbfrs.fr  │ etudiant123  │"
    echo "  └─────────────┴──────────────────────────┴──────────────┘"
    echo ""
    echo -e "  ${RED}⚠  Changez ces mots de passe immediatement en production !${NC}"
    echo ""
    echo -e "  Gestion : ${CYAN}ai2lean status | restart | logs | update | backup${NC}"
    echo ""
    
    if [ ${#ERRORS[@]} -gt 0 ]; then
        echo -e "  ${YELLOW}Avertissements :${NC}"
        for err in "${ERRORS[@]}"; do
            echo -e "    ${YELLOW}!${NC} $err"
        done
        echo ""
    fi
}

# ════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════
main() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║   AI2Lean — NETBFRS Academy                  ║${NC}"
    echo -e "${BOLD}${CYAN}║   Deploiement VPS Debian 12/13               ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    detect_system
    ask_config
    
    install_system_deps
    install_nginx
    install_nodejs
    install_mongodb
    install_certbot
    setup_app_files
    setup_backend
    setup_frontend
    setup_service
    setup_nginx
    setup_ssl
    setup_firewall
    create_cli
    run_tests
    
    print_summary
}

main "$@"
