# Changelog

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
