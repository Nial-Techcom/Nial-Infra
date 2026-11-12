# Sécurité — NetForge

## Signaler une faille

Ouvre un *Security advisory* privé sur GitHub (onglet **Security → Report a vulnerability**) plutôt qu'une issue publique. Merci de ne pas publier la faille avant qu'elle soit corrigée.

## Audit de sécurité — version 1.1.0 (10 novembre 2026, 2ᵉ passe le 12 novembre)

Audit complet : dépendances (`npm audit`), revue du code serveur / web / desktop / mobile / Docker, et tests d'attaque automatisés (`apps/server/test/api.test.ts`, section *security*).

### Failles corrigées

| # | Gravité | Où | Problème | Correctif | Test |
|---|---|---|---|---|---|
| 1 | **Haute** | Serveur (nodemailer 6) | 20+ CVE : injection de commandes SMTP, contournement du domaine destinataire, DoS de l'analyseur d'adresses, fuite d'identifiants SMTP entre transports | Mise à jour vers **nodemailer 10.5** | suite d'e-mails |
| 2 | **Haute** | Desktop (Electron 33, plus maintenu) | Chromium/Electron non corrigé (contournement d'intégrité ASAR, usurpation IPC…) | **Electron 45.2** + electron-builder 26.18 | — |
| 3 | **Haute** | Serveur, Docker (Node 20, fin de vie) | Plus de correctifs de sécurité | Images **Node 22 LTS**, `nginx:stable-alpine` | — |
| 4 | **Haute** | Authentification | Attaque par force brute répartie sur plusieurs IP (la limite n'existait que par IP) | **Pause par compte** après 10 échecs / 15 min (`ACCOUNT_LOCK_LIMIT`), compteur remis à zéro au succès, mémoire bornée | `locks an account…`, `LoginThrottle` |
| 5 | **Haute** | Sessions | Un changement de mot de passe (ou une réinitialisation par l'admin) **ne coupait pas les anciennes sessions** : un jeton volé restait valable 12 h | Chaque jeton porte la « version du mot de passe » ; tout changement invalide **tous** les anciens jetons, sans fenêtre de temps. Le changement de mot de passe renvoie un nouveau jeton | `changing your password revokes…`, `an admin resetting…` |
| 6 | Moyenne | Installation | L'exemple `.env` livrait `ADMIN_PASSWORD=change-me-admin-password` : un serveur démarré sans le changer avait un **admin au mot de passe public** | En production, le serveur **refuse** de créer l'admin avec ce mot de passe d'exemple ou moins de 10 caractères | `does not create a production admin…` |
| 7 | Moyenne | nginx / web | Pas d'en-têtes de sécurité | **CSP stricte** (pas de script inline ni d'origine tierce), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, version nginx masquée | test navigateur (aucune violation CSP) |
| 8 | Moyenne | nginx | `X-Forwarded-For` **ajouté** à ce que le client envoyait : usurpation d'IP pour contourner les limites ; derrière un second proxy, tous les visiteurs partageaient une IP | L'en-tête est **remplacé**, `real_ip` configuré pour les proxys privés | — |
| 9 | Moyenne | API | Réponses (jetons, identifiants, schémas) pouvant être mises en cache | `Cache-Control: no-store` sur toute l'API | `API answers are never cacheable` |
| 10 | Moyenne | SMTP | Un attaquant réseau pouvait retirer le STARTTLS (port 587) et lire le mot de passe SMTP | **TLS obligatoire** sur le port 587 | — |
| 11 | Basse | API | Pas de plafond global de requêtes ; un identifiant mal formé donnait une erreur 500 de la base | Plafond **1000 req/min/IP** (`API_RATE_LIMIT`) ; identifiant invalide → 400 | `a malformed id is a 400` |
| 12 | Basse | Desktop | Le processus principal acceptait des messages IPC de n'importe quelle page ; permissions Chromium non restreintes | Vérification de l'émetteur de chaque message IPC, **toutes les permissions refusées**, `<webview>` bloqué | — |
| 13 | Basse | Mobile / Desktop | Connexion `http://` à un serveur sur Internet sans avertissement (mot de passe en clair) | **Alerte** à la saisie de l'adresse ; sauvegarde Android désactivée (`allowBackup: false`) | `isInsecureRemoteUrl` |
| 14 | Basse | Journal | Aucune trace de la consultation des mots de passe d'équipements | Ligne `[audit]` (qui, quel équipement, quand) dans les journaux | — |
| 15 | Basse | E-mails | Nom de client pouvant contenir des retours à la ligne dans l'objet | Retours à la ligne supprimés | — |
| 16 | **Haute** | Configuration | Les valeurs d'exemple du `.env.example` (`JWT_SECRET=generate-a-random-…`, mot de passe PostgreSQL `change-me-…`) étaient **acceptées en production** : un serveur démarré sans les changer signait ses sessions avec une clé publique | En production, le serveur **refuse de démarrer** avec un secret d'exemple, trop court, trop répétitif (`aaaa…`), une clé de chiffrement quasi nulle ou le mot de passe de base d'exemple. `update.sh` refuse aussi de tourner si le `.env` contient encore `change-me` / `generate-` | `production secrets` (6 cas) |
| 17 | **Haute** | Dépendance (zod 3) | CVE « consommation mémoire sur grandes collections » | **zod 4.6.7** (typecheck, 87 tests, builds web et mobile vérifiés) | suite complète |
| 18 | Moyenne | `update.sh` | Fichier de verrou prévisible dans `/tmp` (attaque par lien symbolique en root) ; cron root lançant un script modifiable par d'autres ; dépôt `http://` accepté ; port du `.env` non validé ; sauvegardes pas en 700 | Verrou dans `/var/lock` (liens refusés), `--auto` refuse un script non root/modifiable, `origin` doit être en https/ssh, port numérique, dossier de sauvegarde 700, journal 600 | essais scriptés |
| 19 | Basse | Docker | Conteneurs avec privilèges par défaut | `no-new-privileges` partout, `cap_drop: ALL` pour le serveur | — |

### Vérifié sans faille (tests de non-régression ajoutés)

- **Isolation entre clients (IDOR)** : 23 routes testées avec un technicien d'un client A contre les données d'un client B → toutes refusées (403/404) et rien n'est modifié.
- **JWT** : jeton sans signature (`alg: none`), mauvais secret, mauvais algorithme, rôle falsifié → refusés. Le rôle est relu en base à chaque requête.
- **Injection SQL** : requêtes paramétrées partout (les seuls noms de colonnes dynamiques viennent d'une liste fixe).
- **Injection de formules CSV** (`=`, `+`, `-`, `@`) neutralisée.
- **Corps trop gros / JSON invalide / listes énormes** : refusés proprement (413 / 400).
- **XSS** : aucun `innerHTML`, `eval` ni `dangerouslySetInnerHTML` dans le web, le desktop et le mobile.
- **Jetons d'invitation et de réinitialisation** : aléatoires (256 bits), stockés hachés, à usage unique, avec expiration ; réponse identique que l'adresse existe ou non ; liens construits depuis l'adresse publique configurée, jamais depuis l'en-tête `Host`.
- **Secrets** : mots de passe hachés (bcrypt coût 12), identifiants d'équipements et mot de passe SMTP chiffrés (AES-256-GCM), jamais renvoyés ni exportés.

### Risques connus et acceptés

| Sujet | Pourquoi on l'accepte | Mesure |
|---|---|---|
| Outils de build **Expo SDK 52** (`tar`, `xmldom`, `postcss`, `image-size`… signalés par `npm audit`) | Ils ne tournent que sur la machine de compilation (GitHub Actions) sur **notre propre** projet, jamais dans l'app livrée ni sur le serveur. Les corriger demande le saut Expo 52 → 58 (React Native majeur), risqué pour la stabilité | À planifier dans une version dédiée ; les APK/IPA ne contiennent pas ces paquets |
| `vite` / `vitest` / `esbuild` (serveur de **développement**) | Non embarqués dans la production | N'expose pas le serveur de dev sur Internet |
| La création de compte révèle qu'une adresse est déjà prise (409) | Inhérent à l'inscription sans vérification e-mail ; limité par le plafond de tentatives | Décocher « création de compte libre » dans Administration |
| Actions GitHub tierces (`softprops`, `docker/*`) référencées par version et non par empreinte | Éditeurs reconnus ; l'épinglage par SHA demande un accès GitHub que je n'avais pas | À faire avec Dependabot |
| Mise à jour automatique = confiance dans la branche `server` du dépôt | C'est le principe de l'auto-update ; protège ta branche (Settings → Branches) et active l'authentification 2FA GitHub | `update.sh --check` pour relire avant d'appliquer |
| `http://` autorisé sur réseau local | Nécessaire pour un serveur maison sans HTTPS | Alerte pour toute adresse publique ; HTTPS conseillé (INSTALLATION.md §7) |

## Check-list d'un serveur sain

1. HTTPS devant NetForge (INSTALLATION.md §7) et `PUBLIC_URL` en `https://…`.
2. `JWT_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` : aléatoires, jamais ceux de l'exemple. **Sauvegarde `ENCRYPTION_KEY`** (sans elle, les mots de passe d'équipements sont perdus).
3. Ne publie **pas** le port 5432 (PostgreSQL) ni le 5000 (API) : seul le port du site web doit être joignable.
4. Mets à jour régulièrement : `docs/UPDATE.md`.
5. Désactive la création de compte libre si tu n'en as pas besoin.
