# ============================================================
#  SISR.io - Guide de deploiement VPS (Debian 12)
# ============================================================

## Pre-requis

- VPS avec Debian 12 (minimum 1 Go RAM, 10 Go disque)
- Acces root (SSH)
- (Optionnel) Un nom de domaine pointe vers l'IP du VPS

---

## Installation rapide (1 commande)

Connectez-vous en SSH a votre VPS puis executez :

```bash
# 1. Telecharger les fichiers du projet sur le VPS
#    Option A : depuis votre machine locale avec scp
scp -r /chemin/vers/app root@VOTRE_IP:/app

#    Option B : depuis un depot git
cd / && git clone VOTRE_REPO /app

# 2. Lancer le script d'installation
cd /app/scripts
chmod +x install.sh
sudo bash install.sh
```

Le script va vous poser quelques questions :
- **Nom de domaine** : laissez vide pour utiliser l'IP (vous pourrez ajouter le domaine plus tard)
- **SSL** : repondez `n` pour l'instant si vous n'avez pas de domaine
- **Port backend** : appuyez Entree pour garder 8001
- **Cle LLM** : collez votre cle Emergent ou laissez vide

---

## Ce que le script installe automatiquement

| Composant   | Version | Role                          |
|-------------|---------|-------------------------------|
| Node.js     | 20 LTS  | Build du frontend React       |
| Yarn        | Latest  | Gestionnaire de paquets       |
| Python 3    | 3.11+   | Backend FastAPI               |
| MongoDB     | 7.0     | Base de donnees               |
| Nginx       | Latest  | Reverse proxy + serveur web   |
| Certbot     | Latest  | Certificats SSL (optionnel)   |

---

## Architecture du deploiement

```
Internet
   |
   v
[ Nginx :80/:443 ]
   |
   |-- /api/*  -->  [ FastAPI :8001 ]  -->  [ MongoDB :27017 ]
   |
   |-- /*      -->  [ React build (statique) ]
```

---

## Structure des fichiers sur le VPS

```
/opt/sisr-io/
  ├── backend/
  │   ├── server.py          # API FastAPI
  │   ├── .env               # Variables d'environnement
  │   ├── venv/              # Environnement Python
  │   └── requirements.txt
  ├── frontend/
  │   ├── build/             # Frontend compile (servi par Nginx)
  │   ├── src/               # Code source React
  │   ├── .env               # URL backend
  │   └── package.json
/etc/nginx/sites-available/sisr-io    # Config Nginx
/etc/systemd/system/sisr-io-backend.service  # Service systemd
/usr/local/bin/sisr-io                # Commande de gestion
```

---

## Commandes de gestion

Apres installation, la commande `sisr-io` est disponible :

```bash
# Voir le statut de tous les services
sisr-io status

# Redemarrer tous les services
sisr-io restart

# Voir les logs du backend en temps reel
sisr-io logs

# Mettre a jour apres modification du code
sisr-io update

# Ajouter un domaine + SSL plus tard
sisr-io ssl mondomaine.fr
```

---

## Ajouter un nom de domaine plus tard

### Etape 1 : Configurer le DNS

Chez votre registrar (OVH, Cloudflare, Gandi...) :
- Creez un enregistrement **A** pointant vers l'IP de votre VPS

```
Type : A
Nom  : formation (ou @ pour le domaine principal)
IP   : VOTRE_IP_VPS
TTL  : 3600
```

### Etape 2 : Verifier la propagation DNS

```bash
# Attendre que le DNS se propage (5 min a 48h)
dig +short formation.mondomaine.fr
# Doit retourner l'IP de votre VPS
```

### Etape 3 : Activer le domaine + SSL

```bash
sisr-io ssl formation.mondomaine.fr
```

Cette commande va :
- Mettre a jour la configuration Nginx
- Obtenir un certificat SSL Let's Encrypt
- Rebuilder le frontend avec la nouvelle URL
- Recharger Nginx

---

## Configuration manuelle (si besoin)

### Modifier les variables d'environnement backend

```bash
nano /opt/sisr-io/backend/.env
```

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=sisr_io_production
CORS_ORIGINS=*
JWT_SECRET=votre_secret_jwt
EMERGENT_LLM_KEY=votre_cle_ici
```

Puis redemarrer :
```bash
systemctl restart sisr-io-backend
```

### Modifier l'URL du frontend

```bash
nano /opt/sisr-io/frontend/.env
```

```env
REACT_APP_BACKEND_URL=https://votre-domaine.fr
```

Puis rebuilder :
```bash
cd /opt/sisr-io/frontend && yarn build
systemctl reload nginx
```

---

## Securisation supplementaire (recommande)

### Firewall (UFW)

```bash
apt install ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 80/tcp     # HTTP
ufw allow 443/tcp    # HTTPS
ufw enable
```

### Changer le port SSH (optionnel)

```bash
nano /etc/ssh/sshd_config
# Changer : Port 22 -> Port 2222
systemctl restart sshd
ufw allow 2222/tcp
```

### Creer un utilisateur dedie (au lieu de root)

```bash
adduser sisr
usermod -aG sudo sisr
# Puis se reconnecter en tant que sisr
```

---

## Sauvegardes

### Sauvegarder MongoDB

```bash
# Sauvegarde manuelle
mongodump --db sisr_io_production --out /root/backups/$(date +%Y%m%d)

# Restaurer
mongorestore --db sisr_io_production /root/backups/20260301/sisr_io_production/
```

### Sauvegarde automatique (cron)

```bash
crontab -e
# Ajouter cette ligne pour sauvegarder tous les jours a 3h du matin
0 3 * * * mongodump --db sisr_io_production --out /root/backups/$(date +\%Y\%m\%d) --quiet
```

---

## Depannage

### Le backend ne demarre pas

```bash
journalctl -u sisr-io-backend -n 50
# ou
sisr-io logs
```

### Nginx retourne une erreur 502

```bash
# Verifier que le backend tourne
curl http://127.0.0.1:8001/api/
# Si ca ne repond pas, redemarrer
systemctl restart sisr-io-backend
```

### MongoDB ne demarre pas

```bash
systemctl status mongod
journalctl -u mongod -n 30
# Souvent un probleme de permissions :
chown -R mongodb:mongodb /var/lib/mongodb
systemctl restart mongod
```

### Renouveler le certificat SSL

```bash
# Let's Encrypt renouvelle automatiquement, mais pour forcer :
certbot renew --force-renewal
systemctl reload nginx
```

---

## Identifiants de demonstration

| Role       | Utilisateur  | Mot de passe    |
|------------|-------------|-----------------|
| Admin      | admin       | admin123        |
| Formateur  | formateur   | formateur123    |
| Etudiant 1 | etudiant1   | etudiant123     |
| Etudiant 2 | etudiant2   | etudiant123     |
| Etudiant 3 | etudiant3   | etudiant123     |

> **Important** : Changez ces mots de passe en production !

---

## Mise a jour du code

Pour deployer une nouvelle version :

```bash
# 1. Transferer les nouveaux fichiers
scp -r backend/ root@VOTRE_IP:/opt/sisr-io/backend/
scp -r frontend/src/ root@VOTRE_IP:/opt/sisr-io/frontend/src/

# 2. Sur le VPS
sisr-io update
```
