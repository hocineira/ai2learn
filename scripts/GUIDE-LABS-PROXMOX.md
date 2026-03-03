# ============================================================
#  AI2Lean - Guide COMPLET de A a Z
#  Proxmox + Guacamole + Windows Server 2022 + Lab DHCP
#  
#  Node : SRVDEPLOY
#  Proxmox : https://94.187.145.238:20850/
# ============================================================


# ████████████████████████████████████████████████████████████
#  PARTIE 1 : CREER LE TOKEN API PROXMOX (via interface web)
# ████████████████████████████████████████████████████████████

# Tout se fait dans l'interface web de Proxmox :
# https://94.187.145.238:20850/

# --- 1.1 Creer un utilisateur dedie ---
#
# Menu gauche : Datacenter > Permissions > Users > bouton "Add"
#
#   User name     : ai2lean
#   Realm         : Proxmox VE authentication server (pve)
#   Password      : Choisis un mot de passe (ex: Ai2Lean2026!)
#   Confirm       : Meme mot de passe
#   Enable        : Coche
#   > Clique "Add"

# --- 1.2 Donner les droits ---
#
# Menu gauche : Datacenter > Permissions > bouton "Add" > "User Permission"
#
#   Path          : /
#   User          : ai2lean@pve
#   Role          : Administrator
#   Propagate     : Coche
#   > Clique "Add"

# --- 1.3 Creer le token API ---
#
# Menu gauche : Datacenter > Permissions > API Tokens > bouton "Add"
#
#   User          : ai2lean@pve
#   Token ID      : ai2lean-token
#   Privilege Separation : DECOCHE cette case !! (tres important)
#   > Clique "Add"
#
# ⚠️  UNE FENETRE S'AFFICHE AVEC LE TOKEN SECRET
#     COPIE-LE MAINTENANT ET GARDE-LE !!
#     Format : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#     Tu ne pourras plus le voir apres.

# --- 1.4 Tester le token ---
#
# Va dans le shell Proxmox (menu gauche : SRVDEPLOY > Shell)
# Copie-colle cette commande (remplace TON_TOKEN_SECRET) :

curl -k -H "Authorization: PVEAPIToken=ai2lean@pve!ai2lean-token=TON_TOKEN_SECRET" \
  https://127.0.0.1:8006/api2/json/version

# Tu dois voir quelque chose comme :
# {"data":{"version":"8.x.x","release":"8.x"...}}
# Si oui, le token fonctionne !


# ████████████████████████████████████████████████████████████
#  PARTIE 2 : CREER LA VM GUACAMOLE (installation native)
# ████████████████████████████████████████████████████████████

# On va faire tout ca depuis le shell Proxmox
# (Menu gauche : SRVDEPLOY > Shell)

# --- 2.1 Telecharger le template Debian 12 ---

pveam update
pveam download local debian-12-standard_12.7-1_amd64.tar.zst

# Si cette version exacte n'existe pas, liste les disponibles :
# pveam available | grep debian-12
# Et telecharge celle qui apparait.

# --- 2.2 Creer le conteneur LXC pour Guacamole ---

# On utilise un conteneur LXC (plus leger qu'une VM, 
# parfait pour Guacamole en natif)

pct create 100 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname guacamole \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs local-lvm:10 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1 \
  --start 1 \
  --password Guac2026!

# Note : Si le template a un nom different, adapte la ligne.
# Si tu preferes une IP fixe au lieu de DHCP, remplace ip=dhcp par :
# ip=192.168.X.X/24,gw=192.168.X.1
# (adapte a ton reseau)

# --- 2.3 Attendre le demarrage et recuperer l'IP ---

sleep 10
pct exec 100 -- ip addr show eth0

# Note l'adresse IP (ex: 192.168.1.50)
# On va l'appeler IP_GUAC dans la suite.

# --- 2.4 Installer Guacamole dans le conteneur ---

# Entre dans le conteneur :
pct enter 100

# Une fois dedans, copie-colle TOUT ce bloc :

apt update && apt upgrade -y

# Installer les dependances de compilation
apt install -y build-essential libcairo2-dev libjpeg62-turbo-dev \
  libpng-dev libtool-bin uuid-dev libossp-uuid-dev \
  libavcodec-dev libavformat-dev libavutil-dev libswscale-dev \
  freerdp2-dev libpango1.0-dev libssh2-1-dev libtelnet-dev \
  libvncserver-dev libwebsockets-dev libpulse-dev libssl-dev \
  libvorbis-dev libwebp-dev wget curl tomcat10 tomcat10-admin \
  tomcat10-common mariadb-server libmariadb-dev

# --- 2.5 Telecharger et compiler Guacamole Server ---

GUAC_VERSION="1.5.5"

cd /tmp
wget https://archive.apache.org/dist/guacamole/$GUAC_VERSION/source/guacamole-server-$GUAC_VERSION.tar.gz
tar -xzf guacamole-server-$GUAC_VERSION.tar.gz
cd guacamole-server-$GUAC_VERSION

./configure --with-init-dir=/etc/init.d --enable-allow-freerdp-snapshots
make -j$(nproc)
make install
ldconfig

# Demarrer le daemon guacd
systemctl daemon-reload
systemctl enable guacd
systemctl start guacd

# Verifier qu'il tourne :
systemctl status guacd
# Doit afficher "active (running)"

# --- 2.6 Installer Guacamole Web App ---

cd /tmp
wget https://archive.apache.org/dist/guacamole/$GUAC_VERSION/binary/guacamole-$GUAC_VERSION.war

# Deployer dans Tomcat
mkdir -p /etc/guacamole
cp guacamole-$GUAC_VERSION.war /var/lib/tomcat10/webapps/guacamole.war

# --- 2.7 Configurer la base de donnees MySQL ---

# Telecharger le connecteur JDBC
wget https://archive.apache.org/dist/guacamole/$GUAC_VERSION/binary/guacamole-auth-jdbc-$GUAC_VERSION.tar.gz
tar -xzf guacamole-auth-jdbc-$GUAC_VERSION.tar.gz

# Creer les repertoires
mkdir -p /etc/guacamole/extensions
mkdir -p /etc/guacamole/lib

# Copier l'extension MySQL
cp guacamole-auth-jdbc-$GUAC_VERSION/mysql/guacamole-auth-jdbc-mysql-$GUAC_VERSION.jar \
   /etc/guacamole/extensions/

# Telecharger le connecteur MySQL Java
wget https://dev.mysql.com/get/Downloads/Connector-J/mysql-connector-j-8.3.0.tar.gz
tar -xzf mysql-connector-j-8.3.0.tar.gz
cp mysql-connector-j-8.3.0/mysql-connector-j-8.3.0.jar /etc/guacamole/lib/

# --- 2.8 Configurer MySQL ---

systemctl enable mariadb
systemctl start mariadb

# Creer la base et l'utilisateur
mysql -u root << 'SQL'
CREATE DATABASE guacamole_db;
CREATE USER 'guacamole_user'@'localhost' IDENTIFIED BY 'GuacDB2026!';
GRANT SELECT,INSERT,UPDATE,DELETE ON guacamole_db.* TO 'guacamole_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# Importer le schema
cat guacamole-auth-jdbc-$GUAC_VERSION/mysql/schema/*.sql | mysql -u root guacamole_db

# --- 2.9 Creer le fichier de configuration ---

cat > /etc/guacamole/guacamole.properties << 'EOF'
# Guacamole Configuration
guacd-hostname: localhost
guacd-port: 4822
mysql-hostname: localhost
mysql-port: 3306
mysql-database: guacamole_db
mysql-username: guacamole_user
mysql-password: GuacDB2026!
mysql-auto-create-accounts: true
EOF

# Lien symbolique pour Tomcat
ln -sf /etc/guacamole /usr/share/tomcat10/.guacamole

# --- 2.10 Redemarrer les services ---

systemctl restart tomcat10
systemctl restart guacd

# Attendre 10 secondes que Tomcat demarre
sleep 10

# Verifier que tout tourne :
echo "=== GUACD ==="
systemctl is-active guacd
echo "=== TOMCAT ==="
systemctl is-active tomcat10

# --- 2.11 Tester l'acces ---

# Depuis l'interieur du conteneur :
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/guacamole/
# Doit afficher : 200

# Sortir du conteneur :
exit

# --- 2.12 Acceder a Guacamole ---

# Depuis ton navigateur, ouvre :
# http://IP_GUAC:8080/guacamole
#
# Login : guacadmin
# Password : guacadmin
#
# ⚠️ CHANGE LE MOT DE PASSE IMMEDIATEMENT :
# En haut a droite > guacadmin > Settings > Preferences > Change Password

# --- 2.13 Rendre accessible depuis internet (NAT) ---
#
# Sur ta box/routeur/firewall, ajoute une regle NAT :
#   Port externe  : 20851 (ou un autre port libre)
#   IP interne    : IP_GUAC (l'IP du conteneur)
#   Port interne  : 8080
#   Protocole     : TCP
#
# Apres, Guacamole sera accessible sur :
# http://94.187.145.238:20851/guacamole


# ████████████████████████████████████████████████████████████
#  PARTIE 3 : CREER LE TEMPLATE WINDOWS SERVER 2022
# ████████████████████████████████████████████████████████████

# Retourne dans le shell Proxmox (pas dans le conteneur !)
# SRVDEPLOY > Shell

# --- 3.1 Verifier que l'ISO est presente ---

# Liste les ISOs disponibles :
ls /var/lib/vz/template/iso/

# Tu dois voir ton ISO Windows Server 2022
# Note son nom exact (ex: fr-fr_windows_server_2022.iso)

# Si tu ne la vois pas, tu peux la telecharger via l'interface :
# SRVDEPLOY > local > ISO Images > Upload
# Ou Download from URL

# --- 3.2 Telecharger les drivers VirtIO ---
# (necessaires pour que Windows detecte les disques dans Proxmox)

cd /var/lib/vz/template/iso/
wget https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso

# --- 3.3 Creer la VM Windows Server ---
#
# Depuis l'INTERFACE WEB Proxmox (plus simple pour Windows) :
#
# Bouton "Create VM" en haut a droite :
#
# ** General **
#   VM ID   : 9002
#   Name    : tpl-winserver2022-dhcp
#
# ** OS **
#   ISO Image : selectionne ton ISO Windows Server 2022
#   Type      : Microsoft Windows
#   Version   : 11/2022
#
# ** System **
#   Machine   : q35
#   BIOS      : OVMF (UEFI)
#   EFI Storage : local-lvm
#   TPM       : Ajouter TPM (v2.0, storage: local-lvm)
#   SCSI Controller : VirtIO SCSI Single
#
# ** Disks **
#   Bus       : SCSI
#   Storage   : local-lvm
#   Size      : 40 Go
#   Discard   : Coche
#
# ** CPU **
#   Cores     : 2
#   Type      : host
#
# ** Memory **
#   Memory    : 4096 (4 Go)
#
# ** Network **
#   Bridge    : vmbr0
#   Model     : VirtIO (paravirtualized)
#
# > Clique "Finish" (NE DEMARRE PAS ENCORE)

# --- 3.4 Ajouter l'ISO VirtIO comme 2eme lecteur CD ---
#
# Clique sur la VM 9002 > Hardware > Add > CD/DVD Drive
#   Bus     : IDE 0
#   Storage : local
#   ISO     : virtio-win.iso
# > Add

# --- 3.5 Installer Windows Server ---
#
# Demarre la VM : bouton "Start"
# Ouvre la console : bouton "Console" (en haut)
#
# L'installation Windows demarre :
#
# 1. Langue : Francais > Suivant > Installer maintenant
#
# 2. Edition : "Windows Server 2022 Standard (Desktop Experience)"
#    (avec interface graphique)
#
# 3. Cle de produit : "Je n'ai pas de cle" (evaluation 180 jours)
#
# 4. Type : "Personnalise (avance)"
#
# 5. ⚠️ PAS DE DISQUE VISIBLE ? C'est normal !
#    Clique "Charger un pilote" > Parcourir
#    > Lecteur CD virtio-win > vioscsi > 2k22 > amd64
#    > OK > Suivant
#    Le disque de 40 Go apparait maintenant
#
# 6. Selectionne le disque > Suivant
#    Attends la fin de l'installation (10-15 minutes)
#
# 7. Mot de passe administrateur : Lab2026!
#    (simple pour les tests, on changera en production)
#
# 8. Apres le login, Windows Server est pret.

# --- 3.6 Configurer Windows pour les labs ---
#
# Dans Windows Server (console Proxmox), ouvre PowerShell en admin :
#
# Copie ces commandes une par une :

# Installer le driver reseau VirtIO
# (Si le reseau ne marche pas encore)
# > Ouvre le Gestionnaire de peripheriques
# > Carte reseau > Peripherique inconnu > Mettre a jour le pilote
# > Parcourir > Lecteur CD virtio-win > NetKVM > 2k22 > amd64

# Installer QEMU Guest Agent (dans le lecteur virtio-win)
# > Ouvre l'explorateur > lecteur CD virtio-win
# > Double-clic sur virtio-win-guest-tools.exe
# > Installe tout

# Activer le Bureau a Distance (RDP)
# PowerShell admin :
Set-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name "fDenyTSConnections" -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"

# Installer le role DHCP (PRET pour le lab, pas configure)
Install-WindowsFeature -Name DHCP -IncludeManagementTools

# Desactiver Windows Update (pour les labs, evite les surprises)
Set-Service -Name wuauserv -StartupType Disabled

# Autoriser le ping
New-NetFirewallRule -DisplayName "Allow ICMPv4" -Protocol ICMPv4 -IcmpType 8 -Action Allow

# Activer QEMU Guest Agent dans Proxmox :
# > VM 9002 > Options > QEMU Guest Agent > Edit > Cocher "Use QEMU Guest Agent" > OK

# --- 3.7 Eteindre et convertir en template ---
#
# Dans Windows : Menu Demarrer > Arreter
#
# Attendre que la VM soit bien arretee, puis :
# Dans Proxmox : Clic droit sur VM 9002 > "Convert to Template"
# > Confirme


# ████████████████████████████████████████████████████████████
#  PARTIE 4 : CREER L'EXERCICE DHCP DANS GUACAMOLE
# ████████████████████████████████████████████████████████████

# --- 4.1 Cloner le template pour tester ---
#
# Dans Proxmox :
# Clic droit sur template 9002 > Clone
#   VM ID   : 20002
#   Name    : lab-dhcp-test
#   Mode    : Full Clone
# > Clone
#
# Demarre la VM clonee (Start)
# Attends 1-2 minutes qu'elle boot
#
# Recupere son IP :
# Clique sur la VM > Summary > tu verras l'IP via le Guest Agent
# (ou dans la console Windows : ipconfig)

# --- 4.2 Ajouter la connexion dans Guacamole ---
#
# Ouvre Guacamole dans ton navigateur
# Settings > Connections > New Connection
#
#   Name         : Lab DHCP - Windows Server 2022
#   Protocol     : RDP
#
#   Parameters - Network :
#     Hostname   : IP_DE_LA_VM_CLONEE (ex: 192.168.1.51)
#     Port       : 3389
#
#   Parameters - Authentication :
#     Username   : Administrator   (ou Administrateur si install FR)
#     Password   : Lab2026!
#     Domain     : (vide)
#     Security   : NLA
#
#   Parameters - Display :
#     Color depth : True color (32-bit)
#     Width       : 1280
#     Height      : 800
#
# > Save

# --- 4.3 Tester la connexion ---
#
# Retourne a l'accueil de Guacamole
# Clique sur "Lab DHCP - Windows Server 2022"
#
# Tu dois voir le BUREAU WINDOWS dans ton navigateur !
# Avec le Server Manager qui s'ouvre.
#
# Si ca marche, c'est PARFAIT, tout est pret !


# ████████████████████████████████████████████████████████████
#  PARTIE 5 : L'EXERCICE DHCP (ce que l'etudiant devra faire)
# ████████████████████████████████████████████████████████████

# Voici l'enonce de l'exercice que l'etudiant verra sur AI2Lean :
#
# ┌─────────────────────────────────────────────────────────┐
# │  EXERCICE : Configuration d'un pool DHCP                │
# │  Formation : BTS SIO SISR                               │
# │  Duree : 30 minutes                                     │
# │  Type : Lab pratique (Windows Server 2022)               │
# │                                                          │
# │  CONTEXTE :                                              │
# │  Vous etes administrateur systeme dans une PME.          │
# │  On vous demande de configurer le serveur DHCP           │
# │  pour le reseau local de l'entreprise.                   │
# │                                                          │
# │  CONSIGNES :                                             │
# │  1. Ouvrir le gestionnaire DHCP                          │
# │  2. Autoriser le serveur DHCP dans Active Directory      │
# │     (ou en local si pas d'AD)                            │
# │  3. Creer un nouveau scope (etendue) :                   │
# │     - Nom : "Reseau_LAN"                                │
# │     - Plage : 192.168.10.100 a 192.168.10.200           │
# │     - Masque : 255.255.255.0                             │
# │     - Passerelle : 192.168.10.1                          │
# │     - DNS : 8.8.8.8 et 8.8.4.4                          │
# │     - Bail : 8 heures                                    │
# │  4. Activer le scope                                     │
# │  5. Creer une reservation pour l'imprimante :            │
# │     - IP : 192.168.10.50                                 │
# │     - MAC : 00:11:22:33:44:55                            │
# │                                                          │
# │  CRITERES DE VALIDATION :                                │
# │  - Scope cree avec la bonne plage          (4 pts)       │
# │  - Passerelle et DNS configures            (3 pts)       │
# │  - Bail correctement defini                (1 pt)        │
# │  - Scope active                            (1 pt)        │
# │  - Reservation creee                       (3 pts)       │
# │  - Service DHCP demarre                    (2 pts)       │
# │                                                          │
# │  TOTAL : /14 points                                      │
# └─────────────────────────────────────────────────────────┘


# ████████████████████████████████████████████████████████████
#  PARTIE 6 : ENVOIE-MOI CES INFOS POUR L'INTEGRATION
# ████████████████████████████████████████████████████████████

# Une fois que tout fonctionne, envoie-moi :
#
# PROXMOX_HOST=94.187.145.238
# PROXMOX_PORT=20850
# PROXMOX_NODE=SRVDEPLOY
# PROXMOX_USER=ai2lean@pve
# PROXMOX_TOKEN_NAME=ai2lean-token
# PROXMOX_TOKEN_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# PROXMOX_TEMPLATE_WINSERVER=9002
#
# GUACAMOLE_URL=http://94.187.145.238:20851  (apres config NAT)
# GUACAMOLE_ADMIN_USER=guacadmin
# GUACAMOLE_ADMIN_PASSWORD=ton_nouveau_mdp
#
# Avec ces infos j'integre dans AI2Lean :
# - Bouton "Demarrer le lab" = clone auto la VM
# - L'etudiant recoit un lien = bureau Windows dans le navigateur
# - Bouton "Soumettre" = script de validation PowerShell
# - L'IA note automatiquement le travail


# ████████████████████████████████████████████████████████████
#  RESUME CHECK-LIST
# ████████████████████████████████████████████████████████████
#
# [ ] 1. Token API Proxmox cree (ai2lean@pve + token)
# [ ] 2. Conteneur Guacamole (ID 100) cree et fonctionnel
# [ ] 3. Guacamole accessible sur http://IP_GUAC:8080/guacamole
# [ ] 4. NAT configure pour Guacamole (port 20851)
# [ ] 5. Template Windows Server 2022 (ID 9002) avec DHCP installe
# [ ] 6. Clone de test fait et fonctionnel
# [ ] 7. Connexion RDP Guacamole vers le clone testee
# [ ] 8. Bureau Windows visible dans le navigateur
# [ ] 9. Infos envoyees pour integration AI2Lean
#
# ████████████████████████████████████████████████████████████
