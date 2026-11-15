export type Role = 'admin' | 'technician' | 'viewer';
export type DeviceType = 'firewall' | 'switch' | 'router' | 'server' | 'access_point' | 'client';
export type DeviceRole = 'core' | 'distribution' | 'access' | 'dmz' | 'backup';
export type MgmtProtocol = 'SSH' | 'HTTPS' | 'SNMP' | 'TELNET';
export type LinkMode = 'access' | 'trunk';
/** Physical cable: black = Ethernet (copper), orange = fibre. */
export type LinkMedium = 'ethernet' | 'fiber';
export type Vendor = 'cisco' | 'huawei' | 'arista';
export type AlertType = 'critical' | 'warning' | 'info';
export type Locale = 'en' | 'fr';

export const DEVICE_TYPES: DeviceType[] = ['firewall', 'switch', 'router', 'server', 'access_point', 'client'];
export const DEVICE_ROLES: DeviceRole[] = ['core', 'distribution', 'access', 'dmz', 'backup'];
export const MGMT_PROTOCOLS: MgmtProtocol[] = ['SSH', 'HTTPS', 'SNMP', 'TELNET'];
export const VENDORS: Vendor[] = ['cisco', 'huawei', 'arista'];
export const ROLES: Role[] = ['admin', 'technician', 'viewer'];
export const LINK_MEDIA: LinkMedium[] = ['ethernet', 'fiber'];
/** Cable colours: black Ethernet, orange fibre (the rest of the UI avoids these two colours for other meanings). */
export const MEDIUM_COLORS: Record<LinkMedium, string> = { ethernet: '#111111', fiber: '#F28C28' };
/** Trunk ports/links use violet so they are never confused with the orange fibre cable. */
export const MODE_COLORS: Record<LinkMode, string> = { access: '#3b82f6', trunk: '#8b5cf6' };

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Your effective role in this client (admins are 'admin' everywhere). Only set by GET /clients. */
  myRole?: Role;
}

/** Roles a client member can have (global admins are not members, they see everything). */
export type MemberRole = 'technician' | 'viewer';
export const MEMBER_ROLES: MemberRole[] = ['technician', 'viewer'];

export interface Member {
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
}

export interface Invitation {
  id: string;
  clientId: string;
  clientName?: string;
  email: string;
  role: MemberRole;
  createdAt: string;
  expiresAt: string;
}

export interface InvitePreview {
  clientName: string;
  email: string;
  role: MemberRole;
}

export interface SmtpSettings {
  host: string;
  port: number;
  /** true = implicit TLS (port 465); false = STARTTLS when offered (port 587/25) */
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
}

export interface AdminSettings {
  smtp: SmtpSettings;
  /** Public address of Nial-Infra, used in the links sent by email (e.g. https://nial-infra.example.com) */
  publicUrl: string;
  allowRegistration: boolean;
}

export interface AuthConfig {
  registrationEnabled: boolean;
  /** true when an SMTP server is configured (the "forgot password" flow can send emails) */
  emailEnabled: boolean;
}

export interface LibraryItem {
  id: string;
  label: string;
  type: DeviceType;
  model: string;
  portCount: number;
  portPrefix: string;
  role: DeviceRole | null;
  /** Height in rack units (U). */
  rackUnits: number;
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
}

/** A rack (baie) in a client's site. Devices sit at a U position, 1 = bottom unit. */
export interface Rack {
  id: string;
  clientId: string;
  siteId: string | null;
  name: string;
  units: number;
}

export interface Device {
  id: string;
  clientId: string;
  siteId: string | null;
  name: string;
  type: DeviceType;
  model: string | null;
  serial: string | null;
  role: DeviceRole | null;
  /** IPv4 with optional prefix length, e.g. 192.168.1.254/24 */
  mgmtIp: string | null;
  mgmtGateway: string | null;
  mgmtPort: string | null;
  mgmtProtocols: MgmtProtocol[];
  mgmtVlan: number | null;
  portCount: number;
  portPrefix: string;
  /** Rack the device is mounted in (null = not racked). */
  rackId: string | null;
  /** Lowest U occupied, 1 = bottom of the rack. */
  rackPos: number | null;
  /** Height in U. */
  rackUnits: number;
  x: number;
  y: number;
  credentialsUsername: string | null;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  id: string;
  clientId: string;
  sourceId: string;
  sourcePort: string;
  destId: string;
  destPort: string;
  mode: LinkMode;
  medium: LinkMedium;
  /** Native (untagged) VLAN on the source end of a trunk. */
  nativeVlan: number | null;
  /** Native VLAN on the destination end; null means "same as source". */
  destNativeVlan: number | null;
  taggedVlans: number[];
  accessVlan: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  rule: string;
  type: AlertType;
  /** i18n key suffix: alerts.messages.<code> */
  code: string;
  params: Record<string, string | number>;
  /** English fallback message. */
  message: string;
  deviceId?: string;
  linkId?: string;
}

export interface Revision {
  id: string;
  clientId: string;
  authorId: string | null;
  authorName: string | null;
  note: string;
  createdAt: string;
}

export interface Topology {
  client: Client;
  sites: Site[];
  racks: Rack[];
  devices: Device[];
  links: Link[];
}

export type LicenseState = 'trial' | 'licensed' | 'blocked';
export type LicenseBlockReason = 'trial_expired' | 'license_expired' | 'revoked' | 'unverified' | 'invalid';

/** Public, minimal licence state (anyone can read it, so every app can show the "licence required" screen). */
export interface LicenseSummary {
  state: LicenseState;
  reason?: LicenseBlockReason;
  daysLeft: number | null;
  contact: string;
}

/** Full licence state, administrators only. */
export interface LicenseStatus extends LicenseSummary {
  installationId: string;
  trialEndsAt: string;
  license: { id: string; customer: string; email: string; expiresAt: string | null } | null;
  verifiedAt: string | null;
}
