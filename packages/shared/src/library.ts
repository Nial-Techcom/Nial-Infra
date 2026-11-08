import type { DeviceRole, DeviceType } from './types';

export interface DevicePreset {
  key: string;
  type: DeviceType;
  label: string;
  model: string;
  portCount: number;
  portPrefix: string;
  role?: DeviceRole;
}

/** Device library shown in the palette (web, desktop, mobile). */
export const DEVICE_LIBRARY: DevicePreset[] = [
  { key: 'fw-paloalto', type: 'firewall', label: 'Palo Alto PA-440', model: 'PA-440', portCount: 8, portPrefix: 'ethernet1/', role: 'dmz' },
  { key: 'fw-fortigate', type: 'firewall', label: 'FortiGate 60F', model: 'FortiGate 60F', portCount: 10, portPrefix: 'port', role: 'dmz' },
  { key: 'fw-asa', type: 'firewall', label: 'Cisco ASA 5506', model: 'ASA 5506-X', portCount: 8, portPrefix: 'GigabitEthernet1/', role: 'dmz' },
  { key: 'fw-pfsense', type: 'firewall', label: 'pfSense', model: 'pfSense', portCount: 6, portPrefix: 'igb', role: 'dmz' },
  { key: 'sw-core', type: 'switch', label: 'Switch Core', model: 'Cisco C9500-24Y4C', portCount: 24, portPrefix: 'Te1/0/', role: 'core' },
  { key: 'sw-distribution', type: 'switch', label: 'Switch Distribution', model: 'Cisco C9300-24T', portCount: 24, portPrefix: 'Gi1/0/', role: 'distribution' },
  { key: 'sw-access', type: 'switch', label: 'Switch Access', model: 'Cisco C9200-48T', portCount: 48, portPrefix: 'Gi1/0/', role: 'access' },
  { key: 'sw-poe', type: 'switch', label: 'Switch PoE', model: 'Cisco C9300-48P', portCount: 48, portPrefix: 'Gi1/0/', role: 'access' },
  { key: 'rt-edge', type: 'router', label: 'Router Edge', model: 'Cisco ISR 4331', portCount: 3, portPrefix: 'Gi0/0/', role: 'core' },
  { key: 'rt-mpls', type: 'router', label: 'Router MPLS', model: 'Cisco ASR 1001-X', portCount: 6, portPrefix: 'Te0/0/', role: 'core' },
  { key: 'srv-physical', type: 'server', label: 'Server (physical)', model: 'Rack server', portCount: 4, portPrefix: 'eth' },
  { key: 'srv-vm', type: 'server', label: 'Server (VM)', model: 'Virtual machine', portCount: 1, portPrefix: 'eth' },
  { key: 'ap-indoor', type: 'access_point', label: 'Wi-Fi AP indoor', model: 'AP indoor', portCount: 2, portPrefix: 'eth', role: 'access' },
  { key: 'ap-outdoor', type: 'access_point', label: 'Wi-Fi AP outdoor', model: 'AP outdoor', portCount: 2, portPrefix: 'eth', role: 'access' },
  { key: 'cl-pc', type: 'client', label: 'PC', model: 'Workstation', portCount: 1, portPrefix: 'eth' },
  { key: 'cl-printer', type: 'client', label: 'Printer', model: 'Network printer', portCount: 1, portPrefix: 'eth' },
  { key: 'cl-phone', type: 'client', label: 'IP phone', model: 'IP phone', portCount: 2, portPrefix: 'eth' },
];

export const DEVICE_ICONS: Record<DeviceType, string> = {
  firewall: '🔥',
  switch: '🔀',
  router: '🌐',
  server: '🖥️',
  access_point: '📶',
  client: '💻',
};

/** Colour used for each device type (hex, readable on light and dark). */
export const DEVICE_COLORS: Record<DeviceType, string> = {
  firewall: '#ef4444',
  switch: '#3b82f6',
  router: '#8b5cf6',
  server: '#10b981',
  access_point: '#f59e0b',
  client: '#64748b',
};

export function devicePorts(d: { portCount: number; portPrefix: string; mgmtPort?: string | null }): string[] {
  const ports = Array.from({ length: Math.max(0, d.portCount) }, (_, i) => `${d.portPrefix}${i + 1}`);
  if (d.mgmtPort && !ports.includes(d.mgmtPort)) ports.push(d.mgmtPort);
  return ports;
}
