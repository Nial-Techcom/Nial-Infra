# Installer le serveur NetForge

> Tu as un conteneur LXC Proxmox tout neuf ? Suis plutôt **[docs/INSTALL-LXC.md](docs/INSTALL-LXC.md)** : de la création du conteneur jusqu'au premier écran, avec un script qui fait le gros du travail.

Le serveur est le **centre de tout** : le site web, l'app Windows/macOS et l'app Android/iPhone lisent et écrivent tous dans lui. On l'installe **une seule fois**, puis on y connecte les apps (étape 8).

Chaque étape explique pourquoi on la fait. Vérifie le ✅ avant de passer à la suivante.

---

## 0. Ce qu'il te faut

| Besoin | Pourquoi |
|---|---|
| Une machine Linux qui reste allumée (VM, LXC Proxmox, Raspberry Pi, VPS) — Debian 12/13 ou Ubuntu 22.04+ | Le serveur doit répondre à tout moment, même quand ton PC est éteint |
| 1 Go de RAM, 2 Go de disque | PostgreSQL + l'API + nginx sont légers |
| Accès `root` ou `sudo` | Pour installer Docker |
| (Optionnel) un nom de domaine | Pour accéder en HTTPS depuis l'extérieur (étape 7) |

Tout fonctionne avec **Docker** : une seule commande lance la base de données, l'API et le site, sans rien installer à la main. *Pourquoi Docker ?* Chaque pièce vient avec ses bonnes versions ; si ça casse, on supprime le conteneur et on recommence sans abîmer la machine.

## 1. Installer Docker

Sur Debian, `docker-compose-v2` n'est pas toujours dans les dépôts. Utilise le script officiel, qui installe Docker **et** le plugin Compose :

```bash
apt update && apt install -y curl git
curl -fsSL https://get.docker.com | sh
```

✅ Vérification :
```bash
docker --version
docker compose version
```
Les deux doivent afficher une version.

> **LXC Proxmox** : dans les options du conteneur, active *Nesting* (Options → Features → `nesting=1`, et `keyctl=1`), sinon Docker ne démarre pas.

## 2. Récupérer NetForge

Le dépôt est privé, donc Git demande un identifiant : utilise ton nom d'utilisateur GitHub et, comme mot de passe, un **jeton** (GitHub → Settings → Developer settings → Personal access tokens, droit `repo`).

```bash
git clone --branch server https://github.com/Flunch4456/NetForge.git
cd NetForge
```
*Pourquoi la branche `server` ?* C'est celle dédiée au serveur ; elle contient le serveur et le site web.

✅ Vérification : `ls` montre `docker-compose.yml`, `apps`, `INSTALLATION.md`.

## 3. Écrire la configuration

```bash
cp .env.example .env
nano .env
```

Remplis chaque ligne. Pour les secrets, génère-les au hasard :

```bash
openssl rand -hex 24        # pour POSTGRES_PASSWORD (lettres et chiffres seulement : il est placé dans une URL)
openssl rand -base64 32     # lance-le 2 fois : JWT_SECRET puis ENCRYPTION_KEY
```

| Variable | Rôle | Attention |
|---|---|---|
| `POSTGRES_PASSWORD` | Mot de passe de la base | Ne le change plus après le 1er lancement |
| `JWT_SECRET` | Signe les connexions | Le changer déconnecte tout le monde (sans gravité) |
| `ENCRYPTION_KEY` | Chiffre les mots de passe des équipements | ⚠️ **Si tu la perds, ces mots de passe sont perdus pour toujours.** Copie-la dans un gestionnaire de mots de passe |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Premier compte administrateur | Créé tout seul au premier démarrage (8 caractères minimum) |
| `WEB_PORT` | Port d'accès (3000 par défaut) | Change-le si 3000 est déjà pris |

## 4. Démarrer

```bash
docker compose up -d --build
```
Le premier lancement construit les images (3 à 8 minutes). *Pourquoi `-d` ?* Le serveur tourne en arrière-plan et redémarre tout seul après un redémarrage de la machine.

✅ Vérifications :
```bash
docker compose ps                                    # 3 services : postgres (healthy), server, web
curl http://localhost:3000/api/v1/health             # doit répondre {"status":"ok"...}
```
Ouvre ensuite `http://IP-DU-SERVEUR:3000` dans un navigateur et connecte-toi avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> `IP-DU-SERVEUR` : `hostname -I` sur la machine. Depuis un autre appareil, utilise cette IP, pas `localhost`.

### Si ça ne démarre pas
```bash
docker compose logs --tail 50 server
```
Le message dit presque toujours quelle variable manque.

## 5. Créer les comptes

Dans le site : menu en haut à droite → **Utilisateurs** → ajoute les autres personnes avec un rôle :
- **Admin** : tout
- **Technicien** : modifie les schémas, voit les mots de passe d'équipements
- **Lecteur** : regarde et exporte seulement

*Pourquoi plusieurs rôles ?* Pour que quelqu'un puisse consulter le réseau sans pouvoir le casser.

Si tu as perdu l'accès admin :
```bash
docker compose exec server node apps/server/dist/cli-create-admin.js ton@mail.fr "NouveauMotDePasse"
```

## 6. (Optionnel) Charger le réseau de démo

Pour voir quelque chose tout de suite, depuis une machine avec Node 20 :
```bash
npm install && npm run build:shared
npm run seed:demo -- http://IP-DU-SERVEUR:3000 ton@mail.fr "MotDePasse"
```
Un client « Demo … » apparaît, avec 2 alertes volontaires à corriger pour t'entraîner (voir `docs/TUTORIAL.md`).

## 7. Accès depuis l'extérieur en HTTPS (optionnel mais conseillé)

Sans HTTPS, les mots de passe circulent en clair. Si tu as un domaine :

1. Crée un enregistrement DNS (ex. `netforge.tondomaine.fr`) vers ton IP ou ton tunnel (Cloudflare).
2. Configure ton reverse proxy (Zoraxy, Nginx Proxy Manager, Caddy…) pour envoyer le domaine vers `http://IP-DU-SERVEUR:3000`, avec certificat HTTPS.
3. Dans `.env`, ajoute le domaine pour le site web :
   ```
   CORS_ORIGINS=https://netforge.tondomaine.fr
   ```
4. Applique : `docker compose up -d`.

*Pourquoi `CORS_ORIGINS` ?* Le navigateur n'accepte de parler à l'API que depuis les adresses déclarées. Les apps Windows/Mac et mobile n'en ont pas besoin.

Ne publie que le port du site (`WEB_PORT`) : la base et l'API ne sont **pas** exposées, tout passe par nginx.

## 8. Connecter les applications

Toutes utilisent la **même adresse** : celle de l'étape 4 (`http://IP:3000`) ou de l'étape 7 (`https://netforge.tondomaine.fr`).

| App | Comment | Où mettre l'adresse |
|---|---|---|
| **Web** | Ouvre l'adresse dans un navigateur | — |
| **Windows** | Installe le `.exe` ou le `.msi` (Releases, tag `windows-v…`) | Champ « Server URL » à la connexion |
| **macOS** | Ouvre le `.dmg` (Releases `apple-v…`), clic droit → Ouvrir la 1ʳᵉ fois | Champ « Server URL » |
| **Android** | Installe l'`.apk` (Releases `android-v…`) | Champ « URL du serveur » |
| **iPhone** | Installe l'`.ipa` non signé avec SideStore ou LiveContainer (Releases `apple-v…`) | Champ « URL du serveur » |

⚠️ Sur le téléphone, n'écris **jamais** `localhost` : ça désignerait le téléphone lui-même. Utilise l'IP du serveur (même Wi-Fi) ou ton domaine.

✅ Vérification finale : crée un équipement sur le site web, ouvre l'app mobile, tire pour actualiser : il apparaît. C'est la preuve que tout passe par le serveur.

## 9. Sauvegardes

À faire régulièrement (cron) :
```bash
docker compose exec -T postgres pg_dump -U netforge netforge | gzip > netforge-$(date +%F).sql.gz
```
Garde aussi une copie de **`.env`** (surtout `ENCRYPTION_KEY`) : sans elle, la sauvegarde ne permet pas de relire les mots de passe d'équipements.

Restaurer :
```bash
gunzip -c netforge-2026-11-08.sql.gz | docker compose exec -T postgres psql -U netforge netforge
```
*Pourquoi sauvegarder la base et pas le conteneur ?* Le conteneur se refait en une commande ; les données seules sont irremplaçables.

## 10. Mettre à jour

```bash
cd NetForge
git pull
docker compose up -d --build
```
Les données restent (stockées dans le volume `postgres_data`). Les migrations de base se font automatiquement au démarrage.

## 11. Check-list sécurité

- [ ] Secrets générés au hasard, `.env` jamais publié sur GitHub (il est dans `.gitignore`)
- [ ] `ENCRYPTION_KEY` copiée dans un endroit sûr
- [ ] Mot de passe admin changé après la première connexion (menu utilisateur → Changer le mot de passe)
- [ ] HTTPS activé si le serveur est accessible depuis Internet
- [ ] Sauvegarde automatique en place
- [ ] Machine à jour (`apt update && apt upgrade`)

## 12. Problèmes fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| Page blanche ou « Cannot reach the server » | Mauvaise adresse ou port bloqué | `curl http://IP:3000/api/v1/health` depuis le même réseau |
| Le conteneur `server` redémarre en boucle | Variable manquante ou trop courte | `docker compose logs server` |
| Docker ne démarre pas dans un LXC | Nesting désactivé | Voir l'encadré de l'étape 1 |
| Le mobile n'arrive pas à se connecter | `localhost`, autre Wi-Fi, ou pare-feu | Utilise l'IP du serveur, même réseau |
| Mot de passe d'équipement illisible | `ENCRYPTION_KEY` modifiée | Remets l'ancienne clé dans `.env` puis `docker compose up -d` |
| Le site web marche mais pas depuis le domaine | `CORS_ORIGINS` manquant | Étape 7, point 3 |
