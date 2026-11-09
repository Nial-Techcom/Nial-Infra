# Installer le serveur NetForge de A à Z sur un LXC Proxmox neuf

Objectif : partir d'un Proxmox, finir avec NetForge qui tourne en permanence, joignable par le site web, l'app Windows/Mac et l'app mobile.
Durée : environ 20 minutes. **Fais les étapes dans l'ordre et vérifie le ✅ avant de continuer.**

```
Proxmox ──► LXC « netforge » ──► Docker ──► [ PostgreSQL + API + site web (nginx) ]
                                                       ▲
                      web · Windows · macOS · Android · iPhone  (même adresse)
```

*Pourquoi un LXC ?* C'est une petite machine Linux isolée, légère (pas de VM complète), que Proxmox sauvegarde et restaure d'un clic. *Pourquoi Docker dedans ?* Il apporte la base, l'API et le site avec les bonnes versions en une commande, sans polluer le système.

---

## Partie A — Créer le conteneur dans Proxmox

### A1. Télécharger le modèle Debian
Dans l'interface web Proxmox : ton stockage (souvent `local`) → **CT Templates** → **Templates** → choisis **debian-12-standard** (ou 13 si dispo) → **Download**.

✅ Il apparaît dans la liste des CT Templates.

### A2. Créer le conteneur
Bouton **Create CT** (en haut à droite). Onglet par onglet :

| Onglet | Réglage | Pourquoi |
|---|---|---|
| General | Hostname `netforge`, mot de passe root fort, **Unprivileged container coché** | Un conteneur non privilégié est plus sûr : si quelqu'un s'échappe de Docker, il n'est pas root sur Proxmox |
| Template | Le modèle Debian téléchargé | |
| Disks | **8 Go** (16 si tu veux garder beaucoup de sauvegardes) | Docker + base + images |
| CPU | **2 cœurs** | La construction des images est plus rapide |
| Memory | **2048 Mo**, swap **512 Mo** | La construction du site web consomme ~1,5 Go ; à 1 Go elle peut planter |
| Network | Bridge `vmbr0`, IPv4 **Static** (ex. `192.168.1.50/24`, passerelle de ton routeur) | Une IP fixe : les apps pointeront toujours vers la même adresse |
| DNS | Laisse par défaut | |

Termine par **Finish**, **sans** cocher « Start after created ».

### A3. Activer ce dont Docker a besoin (avant le 1er démarrage)
Sélectionne le CT → **Options** → **Features** → Edit → coche **Nesting** et **keyctl** → OK.
*Pourquoi ?* Docker crée lui-même des conteneurs à l'intérieur du LXC ; sans « nesting » il refuse de démarrer.

Ensuite **Options → Start at boot → Yes**. *Pourquoi ?* Si Proxmox redémarre (coupure de courant), NetForge revient tout seul.

> Équivalent en ligne de commande, sur l'hôte Proxmox (remplace `105` par l'ID du CT) :
> `pct set 105 --features nesting=1,keyctl=1 --onboot 1`

### A4. Démarrer et ouvrir la console
Bouton **Start**, puis **Console**. Connecte-toi avec `root` et le mot de passe choisi.

✅ Vérifications dans la console :
```bash
ping -c 2 deb.debian.org      # doit répondre : le conteneur a Internet
hostname -I                   # doit afficher l'IP choisie (ex. 192.168.1.50)
```
Si le ping échoue, la passerelle ou le DNS de l'onglet Network est faux : corrige dans **Network** / **DNS** du CT.

---

## Partie B — Installer NetForge (dans la console du LXC)

### B1. Mettre le système à jour
```bash
apt update && apt full-upgrade -y
apt install -y git curl
```
*Pourquoi ?* Un système neuf a souvent des paquets périmés ; on installe aussi `git` pour récupérer le projet.

### B2. Récupérer le projet
Le dépôt est privé : Git te demandera ton identifiant GitHub et, **comme mot de passe, un jeton**.
Pour le créer : GitHub → ta photo → *Settings* → *Developer settings* → *Personal access tokens* → *Tokens (classic)* → *Generate new token*, coche **`repo`**, copie-le.

```bash
git clone --branch server https://github.com/Flunch4456/NetForge.git
cd NetForge
```
✅ `ls` affiche `docker-compose.yml`, `apps`, `scripts`…

### B3. Lancer l'installeur
```bash
./scripts/install-lxc.sh
```
Il fait tout, avec une explication à chaque étape :
1. installe les paquets de base ;
2. installe **Docker** et **Compose** (script officiel) ;
3. te demande l'e-mail admin, un mot de passe (vide = il en génère un) et le port, puis **crée le `.env`** avec des secrets aléatoires (`chmod 600` : lisible seulement par root) ;
4. construit et démarre NetForge, puis attend que le serveur réponde.

La construction prend **3 à 8 minutes** la première fois : c'est normal.

✅ À la fin : `NetForge fonctionne. Ouvre http://192.168.1.50:3000`.

### B4. ⚠️ Sauvegarder la clé de chiffrement — maintenant
```bash
grep ENCRYPTION_KEY .env
```
Copie cette ligne dans ton gestionnaire de mots de passe. **Si elle est perdue, les mots de passe des équipements enregistrés sont définitivement illisibles**, même avec une sauvegarde de la base.

### B5. Premier écran
Depuis ton PC (même réseau) : ouvre `http://192.168.1.50:3000` et connecte-toi avec l'e-mail et le mot de passe admin. Tu dois voir l'écran NetForge vide, avec la bibliothèque d'équipements à gauche.

Change tout de suite le mot de passe : menu en haut à droite → **Changer le mot de passe**.

> **Je préfère tout faire à la main ?** Les mêmes étapes sont détaillées dans [INSTALLATION.md](../INSTALLATION.md).

---

## Partie C — Vérifier que tout est solide

```bash
docker compose ps                                     # postgres, server, web : « running » (postgres « healthy »)
curl http://localhost:3000/api/v1/health              # {"status":"ok"}
docker compose logs --tail 20 server                  # pas de ligne « error »
```

**Test du redémarrage** (le plus important) : dans Proxmox, **Shutdown** puis **Start** le CT, attends 1 minute, rouvre le site. S'il répond, NetForge survit aux coupures. *Pourquoi ?* Les conteneurs ont `restart: unless-stopped` et le CT démarre au boot : c'est ce qu'on vient de prouver.

---

## Partie D — Connecter les apps

Toutes utilisent la même adresse : `http://192.168.1.50:3000` (ou ton domaine, partie E).

| App | Où l'obtenir | Où saisir l'adresse |
|---|---|---|
| Web | Navigateur | — |
| Windows | `.exe` / `.msi` dans les Releases (tag `windows-v…`) | « Server URL » à la connexion |
| macOS | `.dmg` (tag `apple-v…`), clic droit → Ouvrir | « Server URL » |
| Android | `.apk` (tag `android-v…`) | « URL du serveur » |
| iPhone | `.ipa` (tag `apple-v…`) via SideStore ou LiveContainer | « URL du serveur » |

⚠️ Sur téléphone, jamais `localhost` : mets l'IP du LXC (même Wi-Fi) ou ton domaine.

✅ Test final : crée un équipement sur le site web, ouvre l'app mobile, tire pour actualiser : il apparaît.

---

## Partie E — (Optionnel) Accès depuis Internet avec ton domaine

Sans HTTPS, ne l'expose **pas** : les mots de passe passeraient en clair.

1. Dans Cloudflare, crée un enregistrement pour `netforge.tondomaine.fr`.
2. Dans ton reverse proxy (Zoraxy…), ajoute une règle : `netforge.tondomaine.fr` → `http://192.168.1.50:3000`, avec certificat HTTPS.
3. Dans le LXC :
   ```bash
   cd ~/NetForge
   echo 'CORS_ORIGINS=https://netforge.tondomaine.fr' >> .env
   docker compose up -d
   ```
   *Pourquoi ?* Le navigateur n'autorise le site à parler à l'API que depuis les adresses déclarées. Les apps Windows/Mac et mobiles n'en ont pas besoin.
4. Dans les apps, mets `https://netforge.tondomaine.fr` comme adresse.

Seul le port du site (3000) est ouvert : la base et l'API ne sont pas exposées directement.

---

## Partie F — Sauvegardes et mises à jour

### Sauvegarde Proxmox (la plus simple)
Datacenter → **Backup** → Add : choisis le CT `netforge`, une planification (ex. chaque nuit), mode *Snapshot*. Ça sauvegarde tout : système, Docker, base, `.env`.

### Sauvegarde de la base seule (plus légère, à copier ailleurs)
```bash
cd ~/NetForge
docker compose exec -T postgres pg_dump -U netforge netforge | gzip > ~/netforge-$(date +%F).sql.gz
```
Restaurer :
```bash
gunzip -c ~/netforge-2026-11-08.sql.gz | docker compose exec -T postgres psql -U netforge netforge
```

### Mettre à jour NetForge
```bash
cd ~/NetForge && git pull && docker compose up -d --build
```
Les données sont dans un volume Docker : elles restent. Les migrations s'appliquent toutes seules. Tuto détaillé : [UPDATE.md](UPDATE.md).

---

## Partie G — Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `docker: command not found` | Installation interrompue | Relance `./scripts/install-lxc.sh` (il reprend où il en était) |
| Docker refuse de démarrer, erreur « sysctl » ou « permission denied » | Nesting/keyctl absents, ou Proxmox trop ancien | Vérifie A3 puis redémarre le CT ; sinon sur l'hôte : `apt update && apt full-upgrade`, redémarre l'hôte |
| La construction s'arrête sur « Killed » | Pas assez de RAM | Monte le CT à 2048 Mo (A2) et relance `docker compose up -d --build` |
| Le site ne répond pas depuis mon PC | Pare-feu ou mauvaise IP | `curl http://localhost:3000/api/v1/health` dans le LXC : si ça marche, le souci est réseau |
| Le conteneur `server` redémarre en boucle | Variable manquante dans `.env` | `docker compose logs --tail 50 server` |
| J'ai perdu le mot de passe admin | | `docker compose exec server node apps/server/dist/cli-create-admin.js mail@x.fr "NouveauMotDePasse"` |
| `git clone` demande un mot de passe qui échoue | GitHub n'accepte plus le mot de passe de compte | Utilise un jeton (B2) |

**Commandes utiles** : `docker compose ps` (état) · `docker compose logs -f` (journaux en direct) · `docker compose restart` · `docker compose down` (arrêt, **sans** perdre les données).
