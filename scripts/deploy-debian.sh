#!/bin/bash
# ============================================================
#  AI2Lean - NETBFRS Academy
#  Script de deploiement automatise pour Debian 12/13
#  Inclut: Web Server + Guacamole (VM separee 192.168.1.202)
# ============================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERREUR]${NC} $1"; }

# ─── Variables par defaut ───
APP_DIR="/opt/ai2lean"
BACKEND_PORT=8001
FRONTEND_BUILD_DIR="$APP_DIR/frontend/build"
GUACAMOLE_IP="192.168.1.202"
GUACAMOLE_PORT=8080
DOMAIN=""
SSL_ENABLED="n"
LLM_KEY=""
DB_NAME="ai2lean_production"

# ─── Proxmox (a configurer) ───
PROXMOX_HOST=""
PROXMOX_PORT=8006
PROXMOX_NODE="SRVDEPLOY"
PROXMOX_USER=""
PROXMOX_TOKEN_NAME=""
PROXMOX_TOKEN_SECRET=""
PROXMOX_TEMPLATE=9002

# ─── Detection du systeme ───
detect_system() {
    log_info "Detection du systeme..."
    
    if [ ! -f /etc/os-release ]; then
        log_error "Impossible de detecter l'OS. Ce script supporte Debian 12/13."
        exit 1
    fi
    
    . /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
    
    if [ "$OS_NAME" != "debian" ]; then
        log_warn "Ce script est optimise pour Debian. OS detecte: $OS_NAME $OS_VERSION"
    fi
    
    log_success "Systeme: $PRETTY_NAME"
}

# ─── Questions interactives ───
ask_config() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}  AI2Lean - Configuration du deploiement ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Domaine
    read -p "Nom de domaine (laisser vide pour utiliser l'IP) : " DOMAIN
    
    # SSL
    if [ -n "$DOMAIN" ]; then
        read -p "Activer SSL avec Let's Encrypt ? (o/n) [n] : " SSL_ENABLED
        SSL_ENABLED=${SSL_ENABLED:-n}
    fi
    
    # Port backend
    read -p "Port backend FastAPI [$BACKEND_PORT] : " input_port
    BACKEND_PORT=${input_port:-$BACKEND_PORT}
    
    # Cle LLM
    read -p "Cle Emergent LLM (pour la correction IA, optionnel) : " LLM_KEY
    
    # Guacamole IP
    read -p "IP du serveur Guacamole [$GUACAMOLE_IP] : " input_guac
    GUACAMOLE_IP=${input_guac:-$GUACAMOLE_IP}
    
    # Guacamole port
    read -p "Port Guacamole [$GUACAMOLE_PORT] : " input_guac_port
    GUACAMOLE_PORT=${input_guac_port:-$GUACAMOLE_PORT}
    
    # Proxmox
    echo ""
    log_info "Configuration Proxmox (optionnel - necessaire pour les labs VM)"
    read -p "IP/Hostname Proxmox (laisser vide pour ignorer) : " PROXMOX_HOST
    
    if [ -n "$PROXMOX_HOST" ]; then
        read -p "Port Proxmox [$PROXMOX_PORT] : " input_px_port
        PROXMOX_PORT=${input_px_port:-$PROXMOX_PORT}
        
        read -p "Node Proxmox [$PROXMOX_NODE] : " input_px_node
        PROXMOX_NODE=${input_px_node:-$PROXMOX_NODE}
        
        read -p "Utilisateur Proxmox (ex: admin@pve) : " PROXMOX_USER
        read -p "Nom du token API : " PROXMOX_TOKEN_NAME
        read -p "Secret du token API : " PROXMOX_TOKEN_SECRET
        
        read -p "ID template VM [$PROXMOX_TEMPLATE] : " input_template
        PROXMOX_TEMPLATE=${input_template:-$PROXMOX_TEMPLATE}
    fi
    
    echo ""
    log_info "Resume de la configuration:"
    echo "  Domaine        : ${DOMAIN:-IP locale}"
    echo "  SSL            : $SSL_ENABLED"
    echo "  Port backend   : $BACKEND_PORT"
    echo "  Guacamole      : $GUACAMOLE_IP:$GUACAMOLE_PORT"
    echo "  Proxmox        : ${PROXMOX_HOST:-Non configure}"
    echo "  Cle LLM        : ${LLM_KEY:+Configuree}"
    echo ""
    
    read -p "Continuer l'installation ? (o/n) [o] : " confirm
    if [ "$confirm" = "n" ]; then
        echo "Installation annulee."
        exit 0
    fi
}

# ─── Installation des dependances systeme ───
install_system_deps() {
    log_info "Mise a jour du systeme..."
    apt-get update -qq
    apt-get upgrade -y -qq
    
    log_info "Installation des paquets de base..."
    apt-get install -y -qq \
        curl wget gnupg2 ca-certificates lsb-release \
        software-properties-common apt-transport-https \
        build-essential git unzip nano htop \
        python3 python3-pip python3-venv python3-dev \
        nginx certbot python3-certbot-nginx \
        ufw
    
    log_success "Paquets systeme installes"
}

# ─── Installation Node.js 20 LTS ───
install_nodejs() {
    log_info "Installation de Node.js 20 LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VER=$(node --version)
        log_info "Node.js deja installe: $NODE_VER"
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    fi
    
    # Installer Yarn
    if ! command -v yarn &> /dev/null; then
        npm install -g yarn
    fi
    
    log_success "Node.js $(node --version) + Yarn $(yarn --version)"
}

# ─── Installation MongoDB 7 ───
install_mongodb() {
    log_info "Installation de MongoDB 7..."
    
    if command -v mongod &> /dev/null; then
        log_info "MongoDB deja installe"
    else
        # Import GPG key
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
            gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
        
        # Add repo (compatible Debian 12 bookworm)
        echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | \
            tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        
        apt-get update -qq
        apt-get install -y -qq mongodb-org
    fi
    
    systemctl enable mongod
    systemctl start mongod
    
    log_success "MongoDB installe et demarre"
}

# ─── Copie des fichiers de l'application ───
setup_app_files() {
    log_info "Configuration des fichiers de l'application..."
    
    # Creer le repertoire
    mkdir -p "$APP_DIR"
    
    # Copier backend et frontend
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    cp -r "$PROJECT_DIR/backend" "$APP_DIR/"
    cp -r "$PROJECT_DIR/frontend" "$APP_DIR/"
    
    # Creer le dossier d'upload videos
    mkdir -p "$APP_DIR/backend/uploads/videos"
    
    log_success "Fichiers copies dans $APP_DIR"
}

# ─── Configuration Backend ───
setup_backend() {
    log_info "Configuration du backend FastAPI..."
    
    # URL backend
    if [ -n "$DOMAIN" ]; then
        if [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ]; then
            BACKEND_URL="https://$DOMAIN"
        else
            BACKEND_URL="http://$DOMAIN"
        fi
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
        BACKEND_URL="http://$SERVER_IP"
    fi
    
    # URL Guacamole
    GUAC_URL="http://$GUACAMOLE_IP:$GUACAMOLE_PORT"
    
    # Generer JWT secret
    JWT_SECRET=$(openssl rand -hex 32)
    
    # Creer le .env backend
    cat > "$APP_DIR/backend/.env" << ENVEOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=$DB_NAME
CORS_ORIGINS=*
JWT_SECRET=$JWT_SECRET
EMERGENT_LLM_KEY=$LLM_KEY
GUACAMOLE_URL=$GUAC_URL
GUACAMOLE_USER=guacadmin
GUACAMOLE_PASSWORD=guacadmin
PROXMOX_HOST=$PROXMOX_HOST
PROXMOX_PORT=$PROXMOX_PORT
PROXMOX_NODE=$PROXMOX_NODE
PROXMOX_USER=$PROXMOX_USER
PROXMOX_TOKEN_NAME=$PROXMOX_TOKEN_NAME
PROXMOX_TOKEN_SECRET=$PROXMOX_TOKEN_SECRET
PROXMOX_TEMPLATE_WINSERVER=$PROXMOX_TEMPLATE
ENVEOF
    
    # Creer l'environnement virtuel Python
    cd "$APP_DIR/backend"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -q 2>/dev/null || true
    deactivate
    
    log_success "Backend configure"
}

# ─── Configuration Frontend ───
setup_frontend() {
    log_info "Build du frontend React..."
    
    # URL backend
    if [ -n "$DOMAIN" ]; then
        if [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ]; then
            BACKEND_URL="https://$DOMAIN"
        else
            BACKEND_URL="http://$DOMAIN"
        fi
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
        BACKEND_URL="http://$SERVER_IP"
    fi
    
    # Creer le .env frontend
    cat > "$APP_DIR/frontend/.env" << ENVEOF
REACT_APP_BACKEND_URL=$BACKEND_URL
ENVEOF
    
    cd "$APP_DIR/frontend"
    yarn install --frozen-lockfile 2>/dev/null || yarn install
    yarn build
    
    log_success "Frontend compile dans $FRONTEND_BUILD_DIR"
}

# ─── Service systemd Backend ───
setup_systemd() {
    log_info "Creation du service systemd..."
    
    cat > /etc/systemd/system/ai2lean-backend.service << SVCEOF
[Unit]
Description=AI2Lean Backend - NETBFRS Academy
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port $BACKEND_PORT --reload
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
    
    systemctl daemon-reload
    systemctl enable ai2lean-backend
    systemctl start ai2lean-backend
    
    log_success "Service ai2lean-backend cree et demarre"
}

# ─── Configuration Nginx ───
setup_nginx() {
    log_info "Configuration de Nginx..."
    
    SERVER_NAME="${DOMAIN:-_}"
    
    cat > /etc/nginx/sites-available/ai2lean << NGXEOF
# AI2Lean - NETBFRS Academy
# Reverse proxy + static frontend

# Augmenter la taille max d'upload pour les videos
client_max_body_size 500M;

server {
    listen 80;
    server_name $SERVER_NAME;

    # Frontend statique (React build)
    root $FRONTEND_BUILD_DIR;
    index index.html;

    # API Backend (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeout pour les uploads video
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }

    # Proxy Guacamole (optionnel - acces bureau a distance)
    location /guacamole/ {
        proxy_pass http://$GUACAMOLE_IP:$GUACAMOLE_PORT/guacamole/;
        proxy_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cookie_path /guacamole/ /guacamole/;
        
        # Timeout pour les connexions RDP longues
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # React Router - SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Securite headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGXEOF
    
    # Activer le site
    ln -sf /etc/nginx/sites-available/ai2lean /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test et reload
    nginx -t
    systemctl reload nginx
    
    log_success "Nginx configure"
}

# ─── SSL Let's Encrypt ───
setup_ssl() {
    if [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ]; then
        if [ -z "$DOMAIN" ]; then
            log_warn "SSL necessite un nom de domaine. Ignore."
            return
        fi
        
        log_info "Installation du certificat SSL..."
        
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
        
        log_success "SSL installe pour $DOMAIN"
    fi
}

# ─── Firewall ───
setup_firewall() {
    log_info "Configuration du firewall (UFW)..."
    
    ufw default deny incoming 2>/dev/null || true
    ufw default allow outgoing 2>/dev/null || true
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    
    # Permettre l'acces a Guacamole depuis le reseau local
    ufw allow from 192.168.1.0/24 2>/dev/null || true
    
    echo "y" | ufw enable 2>/dev/null || true
    
    log_success "Firewall configure"
}

# ─── Commande de gestion ───
create_management_command() {
    log_info "Creation de la commande 'ai2lean'..."
    
    cat > /usr/local/bin/ai2lean << 'CMDEOF'
#!/bin/bash
# AI2Lean - Commande de gestion

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

case "$1" in
    status)
        echo -e "${CYAN}═══ AI2Lean - Statut des services ═══${NC}"
        echo ""
        echo -e "${CYAN}Backend:${NC}"
        systemctl status ai2lean-backend --no-pager -l | head -5
        echo ""
        echo -e "${CYAN}MongoDB:${NC}"
        systemctl status mongod --no-pager -l | head -3
        echo ""
        echo -e "${CYAN}Nginx:${NC}"
        systemctl status nginx --no-pager -l | head -3
        echo ""
        echo -e "${CYAN}Test API:${NC}"
        curl -s http://127.0.0.1:8001/api/ | head -1 && echo -e "${GREEN} OK${NC}" || echo -e "${RED} ERREUR${NC}"
        ;;
    restart)
        echo "Redemarrage des services..."
        systemctl restart ai2lean-backend
        systemctl restart nginx
        echo -e "${GREEN}Services redemarres${NC}"
        ;;
    logs)
        journalctl -u ai2lean-backend -f
        ;;
    update)
        echo "Mise a jour de l'application..."
        cd /opt/ai2lean/backend
        source venv/bin/activate
        pip install -r requirements.txt -q
        deactivate
        systemctl restart ai2lean-backend
        
        cd /opt/ai2lean/frontend
        yarn install
        yarn build
        systemctl reload nginx
        
        echo -e "${GREEN}Mise a jour terminee${NC}"
        ;;
    ssl)
        if [ -z "$2" ]; then
            echo "Usage: ai2lean ssl <domaine>"
            exit 1
        fi
        DOMAIN="$2"
        sed -i "s/server_name .*/server_name $DOMAIN;/" /etc/nginx/sites-available/ai2lean
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect
        
        # Rebuild frontend avec nouveau domaine
        cd /opt/ai2lean/frontend
        echo "REACT_APP_BACKEND_URL=https://$DOMAIN" > .env
        yarn build
        systemctl reload nginx
        echo -e "${GREEN}SSL active pour $DOMAIN${NC}"
        ;;
    backup)
        BACKUP_DIR="/root/backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        mongodump --db ai2lean_production --out "$BACKUP_DIR" --quiet
        cp -r /opt/ai2lean/backend/uploads "$BACKUP_DIR/"
        echo -e "${GREEN}Sauvegarde dans $BACKUP_DIR${NC}"
        ;;
    *)
        echo "AI2Lean - Commandes disponibles:"
        echo "  ai2lean status   - Voir le statut des services"
        echo "  ai2lean restart  - Redemarrer tous les services"
        echo "  ai2lean logs     - Voir les logs du backend"
        echo "  ai2lean update   - Mettre a jour apres modif du code"
        echo "  ai2lean ssl <d>  - Ajouter un domaine + SSL"
        echo "  ai2lean backup   - Sauvegarder la BDD et les videos"
        ;;
esac
CMDEOF
    
    chmod +x /usr/local/bin/ai2lean
    log_success "Commande 'ai2lean' disponible"
}

# ─── Resume final ───
print_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "${GREEN}  AI2Lean - Installation terminee !       ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    if [ -n "$DOMAIN" ]; then
        if [ "$SSL_ENABLED" = "o" ] || [ "$SSL_ENABLED" = "y" ]; then
            URL="https://$DOMAIN"
        else
            URL="http://$DOMAIN"
        fi
    else
        URL="http://$SERVER_IP"
    fi
    
    echo -e "  ${CYAN}URL Application:${NC}   $URL"
    echo -e "  ${CYAN}URL Guacamole:${NC}     http://$GUACAMOLE_IP:$GUACAMOLE_PORT/guacamole/"
    echo -e "  ${CYAN}Backend API:${NC}       $URL/api/"
    echo ""
    echo -e "  ${CYAN}Repertoire:${NC}        $APP_DIR"
    echo -e "  ${CYAN}Videos:${NC}            $APP_DIR/backend/uploads/videos/"
    echo ""
    echo -e "  ${YELLOW}Identifiants par defaut:${NC}"
    echo "  ┌────────────┬─────────────┬──────────────┐"
    echo "  │ Role       │ Utilisateur │ Mot de passe │"
    echo "  ├────────────┼─────────────┼──────────────┤"
    echo "  │ Admin      │ admin       │ admin123     │"
    echo "  │ Formateur  │ formateur   │ formateur123 │"
    echo "  │ Etudiant   │ etudiant1   │ etudiant123  │"
    echo "  └────────────┴─────────────┴──────────────┘"
    echo ""
    echo -e "  ${YELLOW}⚠  Changez ces mots de passe en production !${NC}"
    echo ""
    echo -e "  Commandes de gestion: ${CYAN}ai2lean status|restart|logs|update|backup${NC}"
    echo ""
}

# ─── MAIN ───
main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  AI2Lean - NETBFRS Academy                ║${NC}"
    echo -e "${CYAN}║  Script de deploiement Debian 12/13       ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    
    # Verifier root
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit etre execute en tant que root (sudo)"
        exit 1
    fi
    
    detect_system
    ask_config
    
    install_system_deps
    install_nodejs
    install_mongodb
    setup_app_files
    setup_backend
    setup_frontend
    setup_systemd
    setup_nginx
    setup_ssl
    setup_firewall
    create_management_command
    
    print_summary
}

main "$@"
