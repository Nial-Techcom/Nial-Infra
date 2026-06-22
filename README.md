================================================================================
                    🌐 NETFORGE - INFRASTRUCTURE TOPOLOGY DESIGNER
                                   Version 3.0.0
================================================================================

Repository: https://github.com/your-org/netforge
License: MIT
Contact: contact@nial-tech.com

================================================================================
TABLE DES MATIÈRES / TABLE OF CONTENTS
================================================================================

1. English Version
2. Version Française
3. Technical Specifications (for AI Code Generation)

================================================================================
                              ENGLISH VERSION
================================================================================

1. PROJECT OVERVIEW
-------------------
NetForge is a full-stack web application for designing complete network
infrastructure schemas. It bridges the gap between logical diagrams and
physical cabling plans by integrating VLAN configuration, port mapping,
Tagging (Tagged/Untagged), and device management metadata directly into
the visual canvas.

Primary Use Case: Managed Service Providers (MSPs) and enterprise IT teams
managing multiple clients and sites.

2. FEATURES (COMPLETE LIST)
---------------------------

2.1 Device Library & Drag-and-Drop
----------------------------------
- Drag devices from the sidebar onto an infinite canvas.
- Supported device types:
  * Firewalls (Palo Alto, FortiGate, Cisco ASA, pfSense)
  * Switches (Core, Distribution, Access, PoE)
  * Routers (Edge, MPLS)
  * Servers (Physical, Virtual Machines)
  * Access Points (WiFi, Indoor/Outdoor)
  * Clients (PCs, Printers, IP Phones)
- Custom device creation (define custom port counts).

2.2 Intelligent Cable Configuration
-----------------------------------
When a cable is drawn between two devices, a configuration modal opens
automatically:

Parameter          | Options                    | Description
-------------------|----------------------------|-----------------------------------------
Source Port        | Dynamic list from device   | Physical port number (e.g., Gi1/0/1)
Destination Port   | Dynamic list from device   | Physical port number
Mode               | Access / Trunk             | Access = 1 VLAN, Trunk = multiple VLANs
Native VLAN        | Integer (if Trunk)         | VLAN that flows without 802.1Q tag
Tagged VLANs       | Multi-select (if Trunk)    | VLANs that are 802.1Q tagged
Access VLAN        | Integer (if Access)        | Single VLAN for the port

2.3 Device Properties (Double-Click)
------------------------------------
Double-click any device to open the Properties Modal with 3 tabs:

Tab 1: Identity & Context
--------------------------
Field           | Description
----------------|----------------------------------------------
Name            | Custom device name (e.g., "SW-CORE-Paris")
Client          | Dropdown linked to Client/Site management
Model           | Hardware model (e.g., "Cisco C9300-48P")
Serial Number   | Asset tracking for warranty
Role            | Core, Distribution, Access, DMZ, Backup

Tab 2: Management & Access
---------------------------
Field           | Description
----------------|----------------------------------------------
Management IP   | IP address + subnet mask (e.g., 192.168.1.254/24)
Gateway         | Default gateway for management network
Management Port | Physical port for management (e.g., MGMT, ETH0)
Protocol        | SSH, HTTPS, SNMP, Telnet (checkboxes)
Credentials     | Username + Password (AES-256 encrypted)

Tab 3: VLAN Mapping
--------------------
Field           | Description
----------------|----------------------------------------------
Management VLAN | VLAN ID dedicated to device management

2.4 Multi-Client & Multi-Site Management
----------------------------------------
- Hierarchical tree in sidebar: Client -> Site -> Devices
- Filter canvas to show only devices from selected client.
- All devices inherit client context automatically.

2.5 Real-Time Validation Engine
-------------------------------
The backend continuously validates the schema and displays alerts:

Alert Type     | Example
---------------|----------------------------------------------
🔴 Critical    | PC connected in Trunk mode
🟠 Warning     | Native VLAN mismatch between two ends of a trunk
🔵 Info        | Device missing management IP

2.6 Global Search (Ctrl+P / Cmd+P)
----------------------------------
- Search by: Device name, IP address, Port number, Client name.
- Auto-zooms to the matching element on the canvas.

2.7 Export Capabilities
-----------------------
Export          | Format      | Content
----------------|-------------|----------------------------------------------
Cabling Matrix  | CSV / PDF   | Full port mapping: Device, Port, Connected To,
                |             | Mode, VLANs
Diagram         | PNG / SVG   | High-resolution visual schema
Configuration   | Text        | Cisco/Huawei/Arista CLI config blocks
Script          |             | (VLANs, interfaces, trunks)

2.8 Multi-Language Support (i18n)
---------------------------------
- Full interface available in: English & Français.
- Language toggle in the header.
- All labels, tooltips, and error messages are translated.

2.9 User Roles & Permissions (RBAC)
-----------------------------------
Role         | Permissions
-------------|------------------------------------------------
Admin        | Full CRUD on all clients/devices/links,
             | manage users
Technician   | View & edit devices/links,
             | view credentials (with 2FA optional)
Viewer       | Read-only access to schemas and exports

2.10 Collaboration & Versioning
--------------------------------
- Real-time collaboration (via WebSocket - optional phase 2).
- Version history: every save creates a revision (rollback possible).

3. QUICK START (INSTALLATION)
-----------------------------

Prerequisites:
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

Installation Steps:
--------------------
# 1. Clone the repository
git clone https://github.com/your-org/netforge.git
cd netforge

# 2. Copy environment variables
cp .env.example .env

# 3. Start with Docker Compose
docker-compose up -d

# 4. Run database migrations
cd backend
npx prisma migrate dev --name init

# 5. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api/v1

Manual Installation (without Docker):
-------------------------------------
# Backend
cd backend
npm install
npm run start:dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev

4. TESTING
----------
# Backend unit tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test

# E2E tests (Cypress)
npm run test:e2e

5. CONTRIBUTING / COLLABORATION
-------------------------------
We welcome contributors! However, to ensure quality and roadmap alignment,
please follow these steps:

1. Contact us first at contact@nial-tech.com to discuss your contribution.
2. Fork the repository.
3. Create a feature branch (git checkout -b feature/amazing-feature).
4. Commit your changes (git commit -m 'Add some amazing feature').
5. Push to your branch (git push origin feature/amazing-feature).
6. Open a Pull Request with a detailed description.

Note: All contributions must include:
- Unit tests for new features.
- Documentation updates (this README & i18n files).
- No breaking changes without prior discussion.

6. CONTACT
----------
Project Lead / Maintainer:
Email: contact@nial-tech.com
Website: https://nial-tech.com (coming soon)

For bug reports, feature requests, or partnership inquiries,
please use the email above.

7. LICENSE
----------
This project is licensed under the MIT License - see the LICENSE file
for details.


================================================================================
                            VERSION FRANÇAISE
================================================================================

1. PRÉSENTATION DU PROJET
-------------------------
NetForge est une application web full-stack permettant de concevoir des
schémas d'infrastructure réseau complets. Elle fait le lien entre le schéma
logique et le plan de câblage physique en intégrant la configuration VLAN,
le mapping des ports, le Tagging (Tagged/Untagged) et les métadonnées de
gestion directement sur le canvas visuel.

Cas d'usage principal: Sociétés d'infogérance (MSP) et équipes IT internes
gérant plusieurs clients et sites.

2. FONCTIONNALITÉS (LISTE COMPLÈTE)
-----------------------------------

2.1 Bibliothèque d'équipements & Drag-and-Drop
----------------------------------------------
- Glissez-déposez des équipements depuis la barre latérale vers le canvas
  infini.
- Types d'équipements supportés:
  * Pare-feux (Palo Alto, FortiGate, Cisco ASA, pfSense)
  * Commutateurs (Core, Distribution, Accès, PoE)
  * Routeurs (Edge, MPLS)
  * Serveurs (Physiques, Machines Virtuelles)
  * Bornes WiFi (Intérieur/Extérieur)
  * Clients (PCs, Imprimantes, Téléphones IP)
- Création d'équipements personnalisés (définir le nombre de ports).

2.2 Configuration intelligente des câbles
-----------------------------------------
Lorsqu'un câble est tracé entre deux équipements, une fenêtre modale
s'ouvre automatiquement:

Paramètre          | Options                    | Description
-------------------|----------------------------|-----------------------------------------
Port Source        | Liste dynamique            | Numéro de port physique (ex: Gi1/0/1)
Port Destination   | Liste dynamique            | Numéro de port physique
Mode               | Accès / Trunk              | Accès = 1 VLAN, Trunk = plusieurs VLANs
VLAN Native        | Nombre entier (si Trunk)   | VLAN qui circule sans tag 802.1Q
VLANs Tagged       | Multi-sélection (si Trunk) | VLANs tagués 802.1Q
VLAN d'Accès       | Nombre entier (si Accès)   | VLAN unique pour le port

2.3 Propriétés des équipements (Double-clic)
--------------------------------------------
Double-cliquez sur un équipement pour ouvrir la Fenêtre modale avec
3 onglets:

Onglet 1: Identité & Contexte
------------------------------
Champ           | Description
----------------|----------------------------------------------
Nom             | Nom personnalisé (ex: "SW-CORE-Paris")
Client          | Liste déroulante liée à la gestion multi-clients
Modèle          | Modèle constructeur (ex: "Cisco C9300-48P")
Numéro de série | Suivi des actifs pour la garantie
Rôle            | Core, Distribution, Accès, DMZ, Backup

Onglet 2: Management & Accès
-----------------------------
Champ           | Description
----------------|----------------------------------------------
IP de management| Adresse IP + masque (ex: 192.168.1.254/24)
Passerelle      | Passerelle par défaut du réseau de management
Port de gestion | Port physique dédié (ex: MGMT, ETH0)
Protocole       | SSH, HTTPS, SNMP, Telnet (cases à cocher)
Identifiants    | Nom d'utilisateur + Mot de passe (chiffré AES-256)

Onglet 3: Mapping VLAN
-----------------------
Champ           | Description
----------------|----------------------------------------------
VLAN de gestion | ID du VLAN dédié à la gestion de l'équipement

2.4 Gestion multi-clients & multi-sites
---------------------------------------
- Arborescence hiérarchique dans la barre latérale: Client -> Site ->
  Équipements
- Filtrage du canvas pour afficher uniquement les équipements du client
  sélectionné.
- Tous les équipements héritent automatiquement du contexte client.

2.5 Moteur de validation en temps réel
--------------------------------------
Le backend valide en continu le schéma et affiche des alertes:

Type d'alerte    | Exemple
-----------------|----------------------------------------------
🔴 Critique      | PC connecté en mode Trunk
🟠 Attention     | Mismatch de VLAN Native entre deux extrémités
🔵 Information   | Équipement sans IP de management

2.6 Recherche globale (Ctrl+P / Cmd+P)
--------------------------------------
- Recherche par: Nom d'équipement, Adresse IP, Numéro de port,
  Nom du client.
- Zoom automatique sur l'élément correspondant dans le canvas.

2.7 Capacités d'export
----------------------
Export          | Format      | Contenu
----------------|-------------|----------------------------------------------
Matrice de      | CSV / PDF   | Mapping complet des ports: Équipement, Port,
câblage         |             | Connecté à, Mode, VLANs
Schéma          | PNG / SVG   | Visuel haute résolution
Script de       | Texte       | Blocs de config Cisco/Huawei/Arista
configuration   |             | (VLANs, interfaces, trunks)

2.8 Support multilingue (i18n)
------------------------------
- Interface complète disponible en: Français & Anglais.
- Bouton de bascule des langues dans l'en-tête.
- Tous les libellés, infobulles et messages d'erreur sont traduits.

2.9 Rôles utilisateurs & Permissions (RBAC)
-------------------------------------------
Rôle         | Permissions
-------------|------------------------------------------------
Admin        | CRUD complet sur tous les clients/équipements/
             | liens, gestion des utilisateurs
Technicien   | Visualisation & modification des équipements/
             | liens, visualisation des identifiants
             | (2FA optionnel)
Lecteur      | Accès en lecture seule aux schémas et exports

2.10 Collaboration & Gestion de versions
----------------------------------------
- Collaboration en temps réel (via WebSocket - phase 2 optionnelle).
- Historique des versions: chaque sauvegarde crée une révision
  (possibilité de rollback).

3. DÉMARRAGE RAPIDE (INSTALLATION)
----------------------------------

Prérequis:
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (ou utiliser Docker)

Étapes d'installation:
----------------------
# 1. Cloner le dépôt
git clone https://github.com/your-org/netforge.git
cd netforge

# 2. Copier les variables d'environnement
cp .env.example .env

# 3. Démarrer avec Docker Compose
docker-compose up -d

# 4. Exécuter les migrations de base de données
cd backend
npx prisma migrate dev --name init

# 5. Accéder à l'application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000/api/v1

Installation manuelle (sans Docker):
------------------------------------
# Backend
cd backend
npm install
npm run start:dev

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev

4. TESTS
--------
# Tests unitaires backend
cd backend
npm run test

# Tests frontend
cd frontend
npm run test

# Tests E2E (Cypress)
npm run test:e2e

5. CONTRIBUTION / COLLABORATION
-------------------------------
Nous accueillons les contributeurs avec plaisir ! Cependant, pour garantir
la qualité et l'alignement avec la feuille de route, veuillez suivre ces
étapes:

1. Contactez-nous d'abord à contact@nial-tech.com pour discuter de votre
   contribution.
2. Forkez le dépôt.
3. Créez une branche de fonctionnalité
   (git checkout -b feature/ma-super-fonctionnalite).
4. Committez vos changements
   (git commit -m 'Ajout d'une super fonctionnalité').
5. Pushez vers votre branche
   (git push origin feature/ma-super-fonctionnalite).
6. Ouvrez une Pull Request avec une description détaillée.

Note: Toutes les contributions doivent inclure:
- Des tests unitaires pour les nouvelles fonctionnalités.
- Des mises à jour de la documentation (ce README et les fichiers i18n).
- Pas de changement cassant sans discussion préalable.

6. CONTACT
----------
Chef de projet / Mainteneur:
Email: contact@nial-tech.com
Site web: https://nial-tech.com (bientôt disponible)

Pour les rapports de bugs, les demandes de fonctionnalités ou les
partenariats, veuillez utiliser l'email ci-dessus.

7. LICENCE
----------
Ce projet est sous licence MIT - voir le fichier LICENSE pour plus de
détails.


================================================================================
         TECHNICAL SPECIFICATIONS (FOR AI CODE GENERATION)
================================================================================

1. TECHNOLOGY STACK
-------------------

Frontend:
- Framework: React 18+ (TypeScript)
- Canvas: React Flow 11+
- State: Zustand
- UI: Tailwind CSS + Shadcn/ui
- i18n: i18next + react-i18next
- HTTP: Axios

Backend:
- Runtime: Node.js 20+ (TypeScript)
- Framework: Express.js 4+
- ORM: Prisma 5+
- Database: PostgreSQL 15+
- Validation: Zod
- Encryption: Node.js crypto (AES-256-GCM)
- Auth: JWT + bcryptjs

DevOps:
- Containerization: Docker + Docker Compose
- Proxy: Nginx (production)

2. DATABASE SCHEMA (PRISMA)
---------------------------

model Client {
  id        String   @id @default(cuid())
  name      String   @unique
  site      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  devices   Device[]
}

model Device {
  id           String   @id @default(cuid())
  clientId     String
  client       Client   @relation(fields: [clientId], references: [id])
  name         String
  type         String   // "firewall" | "switch" | "router" | "server" |
                        // "access_point" | "client"
  model        String?
  serial       String?
  role         String?  // "core" | "distribution" | "access" | "dmz" | "backup"
  mgmtIp       String?
  mgmtGateway  String?
  mgmtPort     String?
  mgmtProtocol String?  // "SSH" | "HTTPS" | "SNMP" | "TELNET"
  credentials  EncryptedCredentials?
  x            Float    @default(0)
  y            Float    @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  links        Link[]   @relation("source")
  linksDest    Link[]   @relation("destination")
}

model EncryptedCredentials {
  id        String   @id @default(cuid())
  username  String
  password  String   // AES-256-GCM encrypted
  deviceId  String   @unique
  device    Device   @relation(fields: [deviceId], references: [id])
}

model Link {
  id          String   @id @default(cuid())
  sourceId    String
  source      Device   @relation("source", fields: [sourceId], references: [id])
  sourcePort  String
  destId      String
  dest        Device   @relation("destination", fields: [destId], references: [id])
  destPort    String
  mode        String   // "access" | "trunk"
  nativeVlan  Int?
  taggedVlans Int[]
  accessVlan  Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

3. API ENDPOINTS
----------------

Base URL: /api/v1

Method | Endpoint              | Body                           | Response
-------|-----------------------|--------------------------------|---------------------------
GET    | /clients              | -                              | { clients: Client[] }
POST   | /clients              | { name, site }                 | { client: Client }
DELETE | /clients/:id          | -                              | { success: true }
GET    | /devices?clientId=xxx | -                              | { devices: Device[] }
POST   | /devices              | { clientId, name, type,        | { device: Device }
       |                       |   model?, serial?, role?,      |
       |                       |   mgmtIp?, mgmtGateway?,       |
       |                       |   mgmtPort?, mgmtProtocol?,    |
       |                       |   mgmtUsername?, mgmtPassword?,|
       |                       |   x, y }                       |
PUT    | /devices/:id          | Same as POST (all optional)    | { device: Device }
DELETE | /devices/:id          | -                              | { success: true }
GET    | /links?deviceId=xxx   | -                              | { links: Link[] }
POST   | /links                | { sourceId, sourcePort,        | { link: Link }
       |                       |   destId, destPort, mode,      |
       |                       |   nativeVlan?, taggedVlans?,   |
       |                       |   accessVlan? }                |
PUT    | /links/:id            | Same as POST (all optional)    | { link: Link }
DELETE | /links/:id            | -                              | { success: true }
POST   | /validate             | { clientId }                   | { alerts: Alert[] }
GET    | /export/csv?clientId=xxx | -                           | CSV file
GET    | /export/pdf?clientId=xxx | -                           | PDF file
GET    | /export/config?deviceId=xxx | -                       | Text file

Alert Interface:
-----------------
interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  message: string;
  deviceId?: string;
  linkId?: string;
}

4. i18n IMPLEMENTATION (MULTI-LANGUAGE)
---------------------------------------

Translation Structure (JSON):
-----------------------------
// public/locales/en/common.json
{
  "app": {
    "title": "NetForge - Infrastructure Designer",
    "description": "Design your network infrastructure with VLANs, Trunks, and Tagging"
  },
  "sidebar": {
    "clients": "Clients",
    "devices": "Device Library",
    "search": "Search..."
  },
  "modals": {
    "device": {
      "identity": "Identity",
      "management": "Management & Access",
      "vlanMapping": "VLAN Mapping"
    },
    "cable": {
      "sourcePort": "Source Port",
      "destPort": "Destination Port",
      "mode": "Mode",
      "nativeVlan": "Native VLAN (Untagged)",
      "taggedVlans": "Tagged VLANs",
      "accessVlan": "Access VLAN"
    }
  },
  "alerts": {
    "critical": "Critical",
    "warning": "Warning",
    "info": "Info"
  },
  "exports": {
    "csv": "Export CSV",
    "pdf": "Export PDF",
    "png": "Export PNG",
    "svg": "Export SVG",
    "config": "Export Config Script"
  }
}

i18next Configuration:
----------------------
// frontend/src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { translation: require('../public/locales/en/common.json') },
      fr: { translation: require('../public/locales/fr/common.json') },
    },
  });

export default i18n;

5. VALIDATION RULES (BACKEND ENGINE)
------------------------------------

// backend/src/services/validationEngine.ts
interface ValidationRule {
  id: string;
  check: (link: Link, devices: Device[]) => Alert | null;
}

const rules: ValidationRule[] = [
  {
    id: 'R001',
    check: (link) => {
      if (link.mode === 'trunk' && link.source.type === 'client') {
        return { type: 'critical', message: 'A client device cannot be in Trunk mode.' };
      }
      return null;
    }
  },
  {
    id: 'R002',
    check: (link) => {
      // Native VLAN mismatch on both ends
      // Check if link.nativeVlan matches on source and dest
    }
  },
  {
    id: 'R003',
    check: (link) => {
      // Switch in Access mode connected to another switch
    }
  },
  {
    id: 'R004',
    check: (link) => {
      // Device missing management IP
    }
  },
  {
    id: 'R005',
    check: (link) => {
      // Source and destination ports are identical
    }
  },
  {
    id: 'R006',
    check: (link) => {
      // Trunk with no tagged VLANs
    }
  },
  {
    id: 'R007',
    check: (link) => {
      // Access mode without VLAN defined
    }
  }
];

6. FOLDER STRUCTURE (MONOREPO)
-----------------------------

netforge/
├── frontend/
│   ├── public/
│   │   └── locales/
│   │       ├── en/
│   │       │   └── common.json
│   │       └── fr/
│   │           └── common.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── NetForgeCanvas.tsx
│   │   │   │   ├── DeviceNode.tsx
│   │   │   │   ├── CableEdge.tsx
│   │   │   │   └── DeviceTooltip.tsx
│   │   │   ├── sidebar/
│   │   │   │   ├── ClientTree.tsx
│   │   │   │   ├── DevicePalette.tsx
│   │   │   │   └── SearchBar.tsx
│   │   │   ├── modals/
│   │   │   │   ├── DevicePropertiesModal.tsx
│   │   │   │   │   ├── TabIdentity.tsx
│   │   │   │   │   ├── TabManagement.tsx
│   │   │   │   │   └── TabVlanMapping.tsx
│   │   │   │   └── CableConfigModal.tsx
│   │   │   ├── panels/
│   │   │   │   ├── AlertsPanel.tsx
│   │   │   │   └── ExportButtons.tsx
│   │   │   └── layout/
│   │   │       ├── Header.tsx
│   │   │       └── Sidebar.tsx
│   │   ├── hooks/
│   │   │   ├── useClientFilter.ts
│   │   │   ├── useValidation.ts
│   │   │   └── useSearch.ts
│   │   ├── store/
│   │   │   ├── deviceStore.ts
│   │   │   ├── linkStore.ts
│   │   │   ├── clientStore.ts
│   │   │   └── uiStore.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── encryption.ts
│   │   ├── i18n.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── clients.ts
│   │   │   ├── devices.ts
│   │   │   ├── links.ts
│   │   │   ├── export.ts
│   │   │   └── validate.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── validationEngine.ts
│   │   │   └── encryptionService.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
├── LICENSE
└── README.md

7. ENVIRONMENT VARIABLES (.env.example)
---------------------------------------

# Database
DATABASE_URL=postgresql://netforge:netforge123@postgres:5432/netforge

# Encryption (32 bytes, base64)
ENCRYPTION_KEY=your_base64_32_byte_key_here

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Server
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

8. ACCEPTANCE CRITERIA (DoD FOR AI)
-----------------------------------

- [ ] All Prisma models match the schema above.
- [ ] All API endpoints implemented with Zod validation.
- [ ] React Flow canvas renders devices and edges.
- [ ] Double-click on device opens modal with 3 tabs (all fields editable).
- [ ] Cable creation opens CableConfigModal and saves via POST.
- [ ] All 7 validation rules implemented.
- [ ] Export CSV/PDF/PNG/SVG/Config working.
- [ ] Search (Ctrl+P) works on name, IP, port.
- [ ] Credentials encrypted in DB (AES-256-GCM).
- [ ] i18n fully implemented: toggle between EN/FR, all labels translated.
- [ ] Docker Compose runs full stack.
- [ ] RBAC: Admin, Technician, Viewer roles.
- [ ] Multi-client filtering works.

9. DOCKER CONFIGURATION
-----------------------

docker-compose.yml:
-------------------
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: netforge
      POSTGRES_PASSWORD: netforge123
      POSTGRES_DB: netforge
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://netforge:netforge123@postgres:5432/netforge
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:

10. COMPONENT SPECIFICATIONS
----------------------------

10.1 DeviceNode (React Flow Custom Node)
----------------------------------------
- Appearance: Rectangle with icon (based on type), name displayed below.
- Handles: 1 source handle (right side), 1 target handle (left side).
- Interaction:
  * Single-click: Select device (show in sidebar details).
  * Double-click: Open DevicePropertiesModal.
  * Drag: Update x and y in store (debounced PUT to API).

10.2 CableEdge (React Flow Custom Edge)
---------------------------------------
- Appearance: Colored line (gray for Access, blue for Trunk).
  Thickness: 2px.
- Label on hover: Tooltip displaying:
  * Mode: Access VLAN: 10
  * or Trunk: VLAN 10,20 (Tag) / VLAN 30 (Untag)
- Interaction:
  * Click to open CableConfigModal for editing.
  * Right-click to delete.

10.3 Connection Logic (onConnect)
---------------------------------
When user drags a cable from device A to device B:
1. Check if both devices exist.
2. Open CableConfigModal immediately (before creating the edge).
3. User fills ports, mode, VLANs.
4. On submit: POST /api/v1/links -> on success, add edge to canvas.

11. SECURITY & ENCRYPTION
-------------------------
- Credentials Encryption: AES-256-GCM from Node.js crypto module.
- Key Storage: Store encryption key in .env as ENCRYPTION_KEY
  (32 bytes, base64).
- Decryption: Only decrypt when user clicks "Show password"
  with 2FA (optional).
- JWT Authentication: All API endpoints protected (except /health).
- Roles: admin, tech, viewer (stored in User model).


================================================================================
                              END OF DOCUMENT
================================================================================

For questions or support, please contact: contact@nial-tech.com