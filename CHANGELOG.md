# Changelog

## 1.1.0 — 2026-11-10 — version de sécurité

### Sécurité (voir SECURITY.md pour le détail)
- nodemailer 6 → 10.5 (20+ CVE), Electron 33 → 45, electron-builder 25 → 26, Node 20 → 22 LTS dans les images Docker.
- Anti force brute **par compte** ; les anciennes sessions sont coupées à tout changement de mot de passe.
- En production, refus de créer l'admin avec le mot de passe d'exemple.
- nginx : CSP stricte et en-têtes de sécurité, `X-Forwarded-For` non falsifiable ; API en `no-store`, plafond global de requêtes.
- SMTP : TLS obligatoire sur le port 587 ; Electron : IPC vérifié, permissions refusées ; alerte sur `http://` public ; journal d'audit des mots de passe consultés.
- 13 nouveaux tests de sécurité (IDOR sur 23 routes, jetons falsifiés, injection SQL, CSV, limites).

### Nouveautés (depuis 1.0.0)
- Mot de passe oublié, création de compte, invitations par e-mail à un client, rôles par client.
- Panneau Administration : SMTP, adresse publique, catalogue d'équipements.
- Vue Baies (rack) et vue Schéma sur les mêmes données ; câbles Ethernet (noir) et fibre (orange).

### Mise à jour
Suis `docs/UPDATE.md`. Aucune migration supplémentaire par rapport à 1.0.x + comptes/baies : la migration `002` s'applique seule. Si tu utilises `create-admin`, le mot de passe doit maintenant faire 10 caractères minimum. Après la mise à jour, tout le monde devra se reconnecter une fois si le mot de passe a changé entre-temps.

## 1.0.0
Première version : API PostgreSQL, web, desktop (Windows/macOS), mobile (Android/iOS).
