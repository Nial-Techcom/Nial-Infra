<div align="center">

# 🛜 Nial-Infra

**Concepteur de topologie d'infrastructure réseau — VLANs, trunks, tagging, câblage et gestion des équipements sur un seul canvas.**
*Network infrastructure topology designer — VLANs, trunks, tagging, cabling and device management on one canvas.*

Web · Desktop (Windows/macOS/Linux) · Mobile (iOS/Android)

</div>

---

## Les 3 applications / The 3 apps

Une seule API, trois clients qui partagent le même moteur de validation, les mêmes exports et les mêmes traductions (FR/EN).

| App | Dossier | Techno | Usage |
|---|---|---|---|
| **API** | `apps/server` | Node 20, Express, PostgreSQL, JWT, AES-256-GCM | Données centralisées, RBAC, exports PDF, historique |
| **Web** | `apps/web` | React, TypeScript, React Flow, Zustand, Tailwind | Conception complète sur canvas (glisser-déposer) |
| **Desktop** | `apps/desktop` | Electron (réutilise l'UI web) | App installable, fichiers `.shmnlt` natifs, URL serveur configurable |
| **Mobile** | `apps/mobile` | React Native, Expo | Consulter/éditer sur le terrain : schéma, équipements, câbles, alertes, exports |
| **Partagé** | `packages/shared` | TypeScript, Zod | Types, validation (12 règles), exports CSV/CLI/.shmnlt, i18n, client API |

`legacy-prototype/` contient l'ancien prototype HTML/JS (v4) et la spec d'origine, gardés pour référence.

🖥️ **Installer le serveur sur un LXC Proxmox neuf : [docs/INSTALL-LXC.md](docs/INSTALL-LXC.md)** (de A à Z, avec script) · version générique : [INSTALLATION.md](INSTALLATION.md)

🔑 **Licence** : chaque serveur a 14 jours d'essai, puis une licence (demande à contact@nial-tech.com depuis Administration → Licence) : [docs/LICENSING.md](docs/LICENSING.md)

📘 **Nouveau ici ? Lis le [tutoriel pas à pas](docs/TUTORIAL.md)** (installation, démo, VLANs, alertes, desktop, mobile).

## Fonctionnalités

- Bibliothèque d'équipements (pare-feux, switchs, routeurs, serveurs, bornes Wi-Fi, clients) + équipements personnalisés
- Câbles **Ethernet (noir)** et **fibre (orange)** ; ports source/destination, mode Access/Trunk, VLAN natif (par extrémité), VLANs tagués, VLAN d'accès
- Fiche équipement à 3 onglets : identité, management (IP, passerelle, protocoles, identifiants **chiffrés AES-256-GCM**), VLAN de management
- Multi-clients / multi-sites, filtrage par site
- Validation temps réel (règles R001–R012) : trunk sur un PC, mismatch de VLAN natif, switch↔switch en access, IP de management manquante/dupliquée/invalide, port utilisé deux fois…
- Recherche globale `Ctrl+P` (nom, IP, port, client)
- Exports : matrice de câblage CSV/PDF, schéma PNG/SVG (web/desktop), scripts CLI Cisco/Huawei/Arista, fichier `.shmnlt`
- **Vue Baies** (rack 42 U, placement par glisser-déposer, câbles vers une autre baie signalés) et **vue Schéma** : mêmes données, deux affichages
- Historique des versions avec restauration
- Comptes : création de compte, **mot de passe oublié**, **invitation par e-mail** à un client (un nouveau compte ne voit aucun client sans invitation)
- Rôles : **Admin** (tout, SMTP, catalogue d'équipements), **Technicien** / **Lecteur** **par client**
- Interface FR/EN, thème clair/sombre

## Démarrage rapide (Docker)

```bash
cp .env.example .env        # puis remplir les secrets (openssl rand -base64 32)
docker compose up -d --build
# Web : http://localhost:3000   (compte = ADMIN_EMAIL / ADMIN_PASSWORD du .env)
```

L'app desktop et l'app mobile se connectent à la même adresse (`http://<ip-du-serveur>:3000`) : l'API est exposée sous `/api/v1` derrière nginx.

## Développement

```bash
npm install
npm run build:shared                       # le package partagé doit être construit une fois

# API (PostgreSQL requis)
export DATABASE_URL=postgresql://user:pass@localhost:5432/nial_infra
export JWT_SECRET=...  ENCRYPTION_KEY=$(openssl rand -base64 32)
npm run dev:server
npm run create-admin -w @nial-infra/server -- admin@example.com "MotDePasse8+"

npm run dev:web                            # http://localhost:3000 (proxy /api -> :5000)

# Desktop : npm run build -w @nial-infra/desktop && npm run start -w @nial-infra/desktop
#           npm run dist -w @nial-infra/desktop   -> installeurs dans apps/desktop/release
# Mobile  : cd apps/mobile && npx expo start   (Expo Go ou émulateur)
#           (sur téléphone, l'URL du serveur doit être l'IP de la machine, pas localhost)
```

### Tests

```bash
npm test -w @nial-infra/shared                                   # moteur de validation, exports, parsing
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/nial_infra_test npm test -w @nial-infra/server
npm run typecheck                                              # tous les workspaces
```
Sans `TEST_DATABASE_URL`, les tests serveur démarrent un PostgreSQL embarqué (impossible en root).

## API (`/api/v1`)

`POST /auth/login|register|forgot-password|reset-password` · `GET /auth/me|config` · `/invitations/preview|accept` · `/clients/:id/members|invitations` · `/admin/settings` (+ `/smtp-test`) · `/library` · `/racks` · `/users` · `/clients` (+ `/topology`, `/export`, `/import`, `/revisions`) · `/sites` · `/devices` (+ `/:id/credentials`) · `/links` · `POST /validate` · `GET /export/csv|pdf|config`.
Détails des schémas : `packages/shared/src/schemas.ts`. Toutes les routes sauf `/auth/*` (login, register, forgot/reset, config), `/invitations/preview` et `/health` demandent `Authorization: Bearer <jwt>`.

## Sécurité

Voir [SECURITY.md](SECURITY.md) pour l’audit et les correctifs.

Mots de passe hachés (bcrypt), JWT (révoqués après un reset de mot de passe), droits vérifiés **par client** côté serveur, jetons d'invitation/reset aléatoires stockés hachés (usage unique, 7 j / 1 h), mot de passe SMTP chiffré, liens d'e-mail construits depuis l'adresse publique configurée (jamais depuis l'en-tête Host), limitation de débit sur le login, `helmet`, CORS en liste blanche, identifiants des équipements chiffrés (AES-256-GCM) et jamais exportés dans les `.shmnlt`. Le mot de passe d'un équipement n'est renvoyé que par `GET /devices/:id/credentials` (admin/technicien).

## Contact & licence

contact@nial-tech.com · Licence MIT (voir `LICENSE`).
Spec technique d'origine : `legacy-prototype/README-spec-original.md`.
