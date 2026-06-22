<!--
================================================================================
  _____   _   _   _____   ______   _____   _   _   _____   ______   _____
 |  __ \ | | | | |  __ \ |  ____| |  __ \ | \ | | |  __ \ |  ____| |  __ \
 | |__) || |_| | | |__) || |__    | |  | ||  \| | | |  | || |__    | |__) |
 |  _  / |  _  | |  _  / |  __|   | |  | || . ` | | |  | ||  __|   |  _  /
 | | \ \ | | | | | | \ \ | |____  | |__| || |\  | | |__| || |____  | | \ \
 |_|  \_\|_| |_| |_|  \_\|______| |_____/ |_| \_| |_____/ |______| |_|  \_\
================================================================================
                  🌐 NETFORGE - INFRASTRUCTURE TOPOLOGY DESIGNER
================================================================================
-->

<div align="center">

# 🛜 NetForge

### Infrastructure Topology Designer

**Design your network infrastructure with VLANs, Trunks, Tagging, and device management - all in one visual canvas.**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/your-org/netforge/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Made with React](https://img.shields.io/badge/Made%20with-React-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC.svg)](https://www.typescriptlang.org/)

**[Website](https://nial-tech.com)** •
**[Documentation](https://docs.netforge.io)** •
**[Report Bug](https://github.com/your-org/netforge/issues)** •
**[Request Feature](https://github.com/your-org/netforge/issues)** •
**[Contact](mailto:contact@nial-tech.com)**

</div>

---

## 📖 Table of Contents

- [English Version](#english-version)
- [Version Française](#version-française)
- [Technical Specifications](#-technical-specifications-for-ai-code-generation)

---

# English Version

## 🎯 Overview

**NetForge** is a full-stack web application for designing complete network infrastructure schemas. It bridges the gap between logical diagrams and physical cabling plans by integrating **VLAN configuration, port mapping, Tagging (Tagged/Untagged), and device management metadata** directly into the visual canvas.

### Primary Use Case
**Managed Service Providers (MSPs)** and **enterprise IT teams** managing multiple clients and sites.

---

## ✨ Features

### 1. Device Library & Drag-and-Drop
- Drag devices from the sidebar onto an infinite canvas.
- Supported device types:
  - 🔥 **Firewalls** (Palo Alto, FortiGate, Cisco ASA, pfSense)
  - 🔀 **Switches** (Core, Distribution, Access, PoE)
  - 🌐 **Routers** (Edge, MPLS)
  - 🖥️ **Servers** (Physical, Virtual Machines)
  - 📶 **Access Points** (WiFi, Indoor/Outdoor)
  - 💻 **Clients** (PCs, Printers, IP Phones)
- Custom device creation (define custom port counts).

### 2. Intelligent Cable Configuration
When a cable is drawn between two devices, a configuration modal opens automatically:

| Parameter | Options | Description |
|-----------|---------|-------------|
| **Source Port** | Dynamic list from device | Physical port number (e.g., `Gi1/0/1`) |
| **Destination Port** | Dynamic list from device | Physical port number |
| **Mode** | Access / Trunk | Access = 1 VLAN, Trunk = multiple VLANs |
| **Native VLAN (Untagged)** | Integer (if Trunk) | VLAN that flows without 802.1Q tag |
| **Tagged VLANs** | Multi-select (if Trunk) | VLANs that are 802.1Q tagged |
| **Access VLAN** | Integer (if Access) | Single VLAN for the port |

### 3. Device Properties (Double-Click)
Double-click any device to open the **Properties Modal** with 3 tabs:

<details>
<summary><b>Tab 1: Identity & Context</b></summary>

| Field | Description |
|-------|-------------|
| **Name** | Custom device name (e.g., "SW-CORE-Paris") |
| **Client** | Dropdown linked to Client/Site management |
| **Model** | Hardware model (e.g., "Cisco C9300-48P") |
| **Serial Number** | Asset tracking for warranty |
| **Role** | Core, Distribution, Access, DMZ, Backup |
</details>

<details>
<summary><b>Tab 2: Management & Access</b></summary>

| Field | Description |
|-------|-------------|
| **Management IP** | IP address + subnet mask (e.g., `192.168.1.254/24`) |
| **Gateway** | Default gateway for management network |
| **Management Port** | Physical port for management (e.g., `MGMT`, `ETH0`) |
| **Protocol** | SSH, HTTPS, SNMP, Telnet (checkboxes) |
| **Credentials** | Username + Password (AES-256 encrypted) |
</details>

<details>
<summary><b>Tab 3: VLAN Mapping</b></summary>

| Field | Description |
|-------|-------------|
| **Management VLAN** | VLAN ID dedicated to device management |
</details>

### 4. Multi-Client & Multi-Site Management
- Hierarchical tree in sidebar: `Client → Site → Devices`
- Filter canvas to show only devices from selected client.
- All devices inherit client context automatically.

### 5. Real-Time Validation Engine
The backend continuously validates the schema and displays alerts:

| Alert Type | Example |
|------------|---------|
| 🔴 **Critical** | PC connected in Trunk mode |
| 🟠 **Warning** | Native VLAN mismatch between two ends of a trunk |
| 🔵 **Info** | Device missing management IP |

### 6. Global Search (Ctrl+P / Cmd+P)
- Search by: Device name, IP address, Port number, Client name.
- Auto-zooms to the matching element on the canvas.

### 7. Export Capabilities

| Export | Format | Content |
|--------|--------|---------|
| **Cabling Matrix** | CSV / PDF | Full port mapping: Device, Port, Connected To, Mode, VLANs |
| **Diagram** | PNG / SVG | High-resolution visual schema |
| **Configuration Script** | Text | Cisco/Huawei/Arista CLI config blocks (VLANs, interfaces, trunks) |

### 8. Multi-Language Support (i18n)
- 🌍 Full interface available in: **English** & **Français**.
- Language toggle in the header.
- All labels, tooltips, and error messages are translated.

### 9. User Roles & Permissions (RBAC)

| Role | Permissions |
|------|-------------|
| **Admin** | Full CRUD on all clients/devices/links, manage users |
| **Technician** | View & edit devices/links, view credentials (with 2FA optional) |
| **Viewer** | Read-only access to schemas and exports |

### 10. Collaboration & Versioning
- Real-time collaboration (via WebSocket - optional phase 2).
- Version history: every save creates a revision (rollback possible).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

### Installation Steps

```bash
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
