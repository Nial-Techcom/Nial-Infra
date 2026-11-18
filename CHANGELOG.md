# Changelog

## 1.4.0 — 2026-11-18 — comptes simplifiés et verrouillage

- **Tout nouvel inscrit est un utilisateur normal** : il n'a accès ni à l'Administration ni à la liste des utilisateurs, voit uniquement **ses propres clients** et ceux qu'on lui **partage**, et peut en créer (son premier écran lui propose de créer son premier client).
- **L'administrateur ne gère plus les rôles** (pour éviter les erreurs) : dans « Utilisateurs » il voit seulement le **nom et l'e-mail**. Il ne peut plus définir de mot de passe ni de rôle à la place de quelqu'un ; il peut **renvoyer un lien de réinitialisation du mot de passe** (envoyé uniquement par e-mail à la personne, jamais affiché à l'admin ; le SMTP doit être configuré), **supprimer** un compte, et **verrouiller / déverrouiller** un compte.
- **Verrouiller un compte** : connexion refusée (« Compte verrouillé ») et sessions ouvertes coupées immédiatement, sans rien supprimer ; le déverrouiller rétablit l'accès. Un admin ne peut pas verrouiller son propre compte, et un compte verrouillé ne reçoit pas de mail de réinitialisation.
- Migration `004_user_lock` automatique. API : `POST /users/:id/lock|unlock|send-reset` ; `GET /users` ne renvoie plus de rôle ; `PATCH /users/:id` ne modifie que le nom.

## 1.3.0 — 2026-11-17 — partage de clients

- **Chaque utilisateur a ses propres clients** : tout compte peut créer ses clients (il en est le *propriétaire*), les renommer, les supprimer et gérer leurs sites. Les noms ne doivent être uniques que parmi ses propres clients.
- **Partager un client** (bouton « Partager » à côté du client, web et desktop) : on saisit l'e-mail de la personne et on choisit **Peut modifier** ou **Lecture seule**. La personne reçoit un e-mail indiquant *qui* partage *quel* client et avec quels droits ; en acceptant (avec son compte ou en en créant un), le client est **ajouté à ses données**. Le propriétaire peut changer les droits, retirer l'accès ou annuler l'invitation à tout moment.
- Une personne avec qui un client est partagé peut le **quitter** elle-même. Seuls le propriétaire et les administrateurs peuvent partager, renommer ou supprimer un client ; un client partagé en modification n'ouvre pas ces droits.
- Mobile : tout le monde peut créer un client ; les clients partagés sont repérés (« lecture seule » / « partagé avec toi »). Le partage lui-même se fait depuis le web ou le desktop.
- Migration `003_client_owner` automatique (les clients existants n'ont pas de propriétaire : ils restent gérés par les administrateurs). Les e-mails nécessitent le SMTP configuré (Administration → E-mail) ; sinon le lien d'invitation est affiché pour être envoyé à la main.

## 1.2.0 — 2026-11-16 — licences

- **Licence obligatoire** : chaque serveur démarre avec **14 jours d'essai**, puis l'API répond `402` tant qu'aucune licence valide n'est installée (connexion, `/health` et écrans de licence restent accessibles ; **aucune donnée n'est supprimée**).
- Licence = texte signé **Ed25519** lié à l'identifiant d'installation ; vérification hors ligne par la clé publique embarquée + **vérification en ligne** auprès du serveur de licences (révocation possible, tolérance de 30 jours si ce serveur est injoignable).
- Administration → onglet **Licence** (web, desktop) et écran de blocage (web, desktop, mobile) : demande par e-mail à contact@nial-tech.com avec l'identifiant d'installation, installation de la licence reçue.
- Le serveur de licences est un **projet séparé et privé** (`Nial-Infra-Licensing`). Voir `docs/LICENSING.md`.

## 1.1.0 — 2026-11-10 — version de sécurité

### Ajouts de dernière minute
- Les applications (web, PC, mobile) ne fonctionnent **pas hors ligne** : si le serveur ne répond pas, un écran bloquant « Serveur injoignable » s'affiche et l'app reprend toute seule dès qu'il revient. Aucune donnée n'est conservée sur l'appareil.
- `scripts/update.sh` : mise à jour automatique du serveur (sauvegarde, retour arrière automatique, programmation nocturne).

### Sécurité (voir SECURITY.md pour le détail)
- nodemailer 6 → 10.5 (20+ CVE), Electron 33 → 45, electron-builder 25 → 26, Node 20 → 22 LTS dans les images Docker.
- Anti force brute **par compte** ; les anciennes sessions sont coupées à tout changement de mot de passe.
- En production, refus de créer l'admin avec le mot de passe d'exemple.
- nginx : CSP stricte et en-têtes de sécurité, `X-Forwarded-For` non falsifiable ; API en `no-store`, plafond global de requêtes.
- SMTP : TLS obligatoire sur le port 587 ; Electron : IPC vérifié, permissions refusées ; alerte sur `http://` public ; journal d'audit des mots de passe consultés.
- 2ᵉ passe : refus des secrets d'exemple en production, zod 4, durcissement de `update.sh` et de Docker.
- 19 nouveaux tests de sécurité (IDOR sur 23 routes, jetons falsifiés, injection SQL, CSV, limites).

### Nouveautés (depuis 1.0.0)
- Mot de passe oublié, création de compte, invitations par e-mail à un client, rôles par client.
- Panneau Administration : SMTP, adresse publique, catalogue d'équipements.
- Vue Baies (rack) et vue Schéma sur les mêmes données ; câbles Ethernet (noir) et fibre (orange).

### Mise à jour
Suis `docs/UPDATE.md`. Aucune migration supplémentaire par rapport à 1.0.x + comptes/baies : la migration `002` s'applique seule. Si tu utilises `create-admin`, le mot de passe doit maintenant faire 10 caractères minimum. Après la mise à jour, tout le monde devra se reconnecter une fois si le mot de passe a changé entre-temps.

## 1.0.0
Première version : API PostgreSQL, web, desktop (Windows/macOS), mobile (Android/iOS).
