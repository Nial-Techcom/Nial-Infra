export type Role = 'admin' | 'technician' | 'viewer';
export type DeviceType = 'firewall' | 'switch' | 'router' | 'server' | 'access_point' | 'client';
export type DeviceRole = 'core' | 'distribution' | 'access' | 'dmz' | 'backup';
export type MgmtProtocol = 'SSH' | 'HTTPS' | 'SNMP' | 'TELNET';
export type LinkMode = 'access' | 'trunk';
export type Vendor = 'cisco' | 'huawei' | 'arista';
export type AlertType = 'critical' | 'warning' | 'info';
export type Locale = 'en' | 'fr';

export const DEVICE_TYPES: DeviceType[] = ['firewall', 'switch', 'router', 'server', 'access_point', 'client'];
export const DEVICE_ROLES: DeviceRole[] = ['core', 'distribution', 'access', 'dmz', 'backup'];
export const MGMT_PROTOCOLS: MgmtProtocol[] = ['SSH', 'HTTPS', 'SNMP', 'TELNET'];
export const VENDORS: Vendor[] = ['cisco', 'huawei', 'arista'];
export const ROLES: Role[] = ['admin', 'technician', 'viewer'];

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
}

export interface Site {
  id: string;
  clientId: string;
  name: string;
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
  devices: Device[];
  links: Link[];
}
