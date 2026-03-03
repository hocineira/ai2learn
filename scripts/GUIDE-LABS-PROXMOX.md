# ============================================================
#  AI2Lean - Mise en place Labs Proxmox + Guacamole
#  Procedure pas a pas pour NETBFRS
# ============================================================
#
#  Serveur Proxmox : https://94.187.145.238:20850/
#  RAM : 32 Go | CPU : 12 cores
#
# ============================================================


## ETAPE 1 : Creer un token API Proxmox (5 minutes)

AI2Lean a besoin d'un token pour communiquer avec ton Proxmox.

### 1.1 - Connecte-toi a Proxmox
- Va sur https://94.187.145.238:20850/
- Connecte-toi avec ton compte admin

### 1.2 - Creer un utilisateur dedie
- Menu gauche : **Datacenter** > **Permissions** > **Users** > **Add**
  - User name : `ai2lean`
  - Realm : `pve` (Proxmox VE authentication)
  - Password : choisis un mot de passe
  - Clique **Add**

### 1.3 - Donner les droits
- **Datacenter** > **Permissions** > **Add** (bouton en haut)
  - Path : `/`
  - User : `ai2lean@pve`
  - Role : `PVEVMAdmin` (permet de gerer les VMs)
  - Clique **Add**

### 1.4 - Creer le token API
- **Datacenter** > **Permissions** > **API Tokens** > **Add**
  - User : `ai2lean@pve`
  - Token ID : `ai2lean-token`
  - **DECOCHER** "Privilege Separation" (important !)
  - Clique **Add**

⚠️ **COPIE LE TOKEN SECRET** qui s'affiche ! Il ne sera plus visible apres.
Il ressemble a : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 1.5 - Tester le token
Depuis n'importe quel terminal :
```bash
curl -k -H "Authorization: PVEAPIToken=ai2lean@pve!ai2lean-token=TON_TOKEN_SECRET" \
  https://94.187.145.238:20850/api2/json/version
```
Tu dois voir une reponse JSON avec la version de Proxmox.


---


## ETAPE 2 : Installer Guacamole (10 minutes)

On va creer un conteneur LXC sur Proxmox avec Guacamole installe automatiquement.

### 2.1 - Se connecter en SSH au serveur Proxmox
```bash
ssh root@94.187.145.238 -p PORT_SSH
```
(remplace PORT_SSH par ton port SSH)

### 2.2 - Lancer le script d'installation automatique
```bash
bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/apache-guacamole.sh)"
```

Le script va te poser des questions :
- **Type** : choisis les valeurs par defaut (Entree)
- **Cores** : 2 (suffisant pour les tests)
- **RAM** : 2048 (2 Go)
- **Storage** : local-lvm (ou ton stockage)

Attends 2-5 minutes, il installe tout automatiquement.

### 2.3 - Noter l'IP du conteneur Guacamole
A la fin, le script affiche l'IP du conteneur. Note-la.
Sinon, va dans Proxmox UI > le conteneur cree > Summary > IP.

Exemple : `192.168.1.50`

### 2.4 - Acceder a Guacamole
- Ouvre dans ton navigateur : `http://IP_CONTENEUR:8080/guacamole`
- Login par defaut : `guacadmin` / `guacadmin`
- **CHANGE LE MOT DE PASSE** immediatement :
  - En haut a droite > guacadmin > Settings > Preferences > Change Password

### 2.5 - Rendre Guacamole accessible depuis internet
Tu dois ajouter une regle NAT sur ta box/routeur :
- Port externe : `20851` (ou ce que tu veux)
- Redirection vers : `IP_CONTENEUR:8080`
- Protocole : TCP

Apres, Guacamole sera accessible sur : `http://94.187.145.238:20851/guacamole`


---


## ETAPE 3 : Creer un template VM de test (15 minutes)

On cree une VM Debian basique qui servira de template pour les labs.

### 3.1 - Telecharger l'ISO Debian
Dans Proxmox UI :
- **local** (storage) > **ISO Images** > **Download from URL**
- URL : `https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.9.0-amd64-netinst.iso`
- Clique **Download**

### 3.2 - Creer la VM
- **Create VM** (bouton en haut a droite)
  - **General** : 
    - VM ID : `9001` (les templates commencent par 9000)
    - Name : `tpl-debian-lab`
  - **OS** : selectionne l'ISO Debian telecharge
  - **System** : defaut
  - **Disks** : 10 Go (suffisant pour un lab)
  - **CPU** : 1 core
  - **Memory** : 1024 Mo (1 Go)
  - **Network** : bridge par defaut (vmbr0)
  - Clique **Finish**

### 3.3 - Installer Debian
- Demarre la VM (Start)
- Ouvre la console (Console)
- Installe Debian avec ces options :
  - Langue : Francais
  - Utilisateur root : `root` / mot de passe : `lab123`
  - Utilisateur normal : `etudiant` / mot de passe : `etudiant`
  - Logiciels : **SSH server** + **standard system utilities** (pas de bureau graphique)
  - Termine l'installation et redemarre

### 3.4 - Preparer la VM pour les labs
Connecte-toi en SSH a la VM (depuis le serveur Proxmox) :
```bash
ssh root@IP_DE_LA_VM
```

Puis execute :
```bash
# Mettre a jour
apt update && apt upgrade -y

# Installer les outils de base pour les labs
apt install -y sudo curl wget net-tools dnsutils vim nano \
  htop tree unzip git qemu-guest-agent

# Activer le guest agent (permet a Proxmox de voir l'IP)
systemctl enable qemu-guest-agent
systemctl start qemu-guest-agent

# Autoriser SSH root (pour la validation automatique)
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
systemctl restart sshd

# Nettoyer
apt clean
history -c

# Eteindre la VM
shutdown -h now
```

### 3.5 - Convertir en template
Dans Proxmox UI :
- Clic droit sur la VM `9001 (tpl-debian-lab)`
- **Convert to Template**
- Confirme

La VM devient un template (icone change). Tu ne peux plus la demarrer, 
mais tu peux la **cloner** a l'infini.

### 3.6 - Tester le clonage
- Clic droit sur le template > **Clone**
  - VM ID : `20001`
  - Name : `test-lab-01`
  - Mode : **Full Clone**
  - Clique **Clone**
- Demarre la VM clonee
- Verifie que tu peux te connecter en SSH
- Supprime-la apres le test


---


## ETAPE 4 : Connecter Guacamole a une VM (5 minutes)

### 4.1 - Ajouter une connexion dans Guacamole
- Va sur Guacamole : `http://IP_CONTENEUR:8080/guacamole`
- **Settings** (en haut a droite) > **Connections** > **New Connection**
  - Name : `Test Lab Debian`
  - Protocol : **SSH**
  - **Parameters** :
    - Hostname : `IP_DE_LA_VM_CLONEE`
    - Port : `22`
    - Username : `etudiant`
    - Password : `etudiant`
  - Clique **Save**

### 4.2 - Tester la connexion
- Retourne a l'accueil Guacamole
- Clique sur "Test Lab Debian"
- Tu dois voir un terminal SSH dans ton navigateur !
- Tape des commandes pour verifier que ca marche


---


## ETAPE 5 : Me donner les infos pour l'integration AI2Lean

Une fois que tout fonctionne, envoie-moi ces informations :

```
PROXMOX_HOST=94.187.145.238
PROXMOX_PORT=20850
PROXMOX_USER=ai2lean@pve
PROXMOX_TOKEN_NAME=ai2lean-token
PROXMOX_TOKEN_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PROXMOX_NODE=nom-de-ton-node  (visible dans Proxmox UI, menu gauche)
PROXMOX_TEMPLATE_ID=9001

GUACAMOLE_URL=http://94.187.145.238:20851
GUACAMOLE_USER=guacadmin
GUACAMOLE_PASSWORD=ton_nouveau_mot_de_passe
```

Avec ces infos, je pourrai integrer dans AI2Lean :
- Bouton "Demarrer le lab" qui clone automatiquement la VM
- Lien Guacamole genere automatiquement
- Timer + destruction automatique
- Validation + notation IA


---


## RESUME - Check-list

- [ ] Token API Proxmox cree et teste
- [ ] Guacamole installe dans un conteneur LXC
- [ ] Guacamole accessible depuis internet (NAT)
- [ ] Template VM Debian cree (ID 9001)
- [ ] Clonage teste avec succes
- [ ] Connexion Guacamole vers VM testee
- [ ] Infos envoyees pour integration AI2Lean


---


## ESTIMATION RESSOURCES (32 Go RAM)

| Composant            | RAM utilisee |
|---------------------|-------------|
| Proxmox host        | ~2 Go       |
| Conteneur Guacamole | ~2 Go       |
| **Disponible labs** | **~28 Go**  |

| Type de lab          | RAM par VM | VMs simultanees possibles |
|---------------------|-----------|--------------------------|
| Linux basique (SSH) | 1 Go      | ~25 etudiants            |
| Linux avance (GUI)  | 2 Go      | ~12 etudiants            |
| Windows Server      | 4 Go      | ~6 etudiants             |
| Multi-VM (pfsense)  | 3 Go      | ~8 etudiants             |

Pour les tests, 1-2 VMs en parallele c'est largement suffisant.
