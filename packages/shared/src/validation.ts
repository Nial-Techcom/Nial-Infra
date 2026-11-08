import type { Alert, Device, Link } from './types';
import { isValidIPv4, parseIpCidr } from './net';

export interface ValidationInput {
  devices: Pick<Device, 'id' | 'name' | 'type' | 'mgmtIp'>[];
  links: Pick<
    Link,
    'id' | 'sourceId' | 'sourcePort' | 'destId' | 'destPort' | 'mode' | 'nativeVlan' | 'destNativeVlan' | 'taggedVlans' | 'accessVlan'
  >[];
}

const MESSAGES: Record<string, string> = {
  R001: 'A client device ({device}) cannot be connected in Trunk mode.',
  R002: 'Native VLAN mismatch on trunk {source} <-> {dest} ({a} vs {b}).',
  R003: 'Switch {source} is linked to switch {dest} in Access mode; use a Trunk.',
  R004: 'Device {device} has no management IP.',
  R005: 'Source and destination ports are identical ({device} {port}).',
  R006: 'Trunk {source} <-> {dest} has no tagged VLANs.',
  R007: 'Access link {source} <-> {dest} has no VLAN defined.',
  R008: 'Port {port} of {device} is used by {count} links.',
  R009: 'Management IP {ip} is used by several devices ({devices}).',
  R010: 'Link {source} <-> {dest} loops back on the same device.',
  R011: 'Management IP of {device} is not a valid IPv4 address.',
  R012: 'Link refers to a device that does not exist.',
};

const ORDER = { critical: 0, warning: 1, info: 2 } as const;

function msg(code: string, params: Record<string, string | number>): string {
  return (MESSAGES[code] ?? code).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

/**
 * Pure validation engine. The same function runs on the server (/validate),
 * in the web/desktop UI (real-time) and on mobile, so everyone sees identical alerts.
 */
export function validateTopology({ devices, links }: ValidationInput): Alert[] {
  const alerts: Alert[] = [];
  const byId = new Map(devices.map((d) => [d.id, d]));
  const push = (a: Omit<Alert, 'message'>) => alerts.push({ ...a, message: msg(a.code, a.params) });

  for (const l of links) {
    const s = byId.get(l.sourceId);
    const d = byId.get(l.destId);
    if (!s || !d) {
      push({ id: `R012:${l.id}`, rule: 'R012', type: 'critical', code: 'R012', params: {}, linkId: l.id });
      continue;
    }
    const sp = { source: s.name, dest: d.name };

    // R001 - client device in trunk mode
    if (l.mode === 'trunk') {
      for (const end of [s, d]) {
        if (end.type === 'client') {
          push({ id: `R001:${l.id}:${end.id}`, rule: 'R001', type: 'critical', code: 'R001', params: { device: end.name }, deviceId: end.id, linkId: l.id });
        }
      }
    }
    // R002 - native VLAN mismatch
    if (l.mode === 'trunk' && l.nativeVlan != null && l.destNativeVlan != null && l.nativeVlan !== l.destNativeVlan) {
      push({ id: `R002:${l.id}`, rule: 'R002', type: 'warning', code: 'R002', params: { ...sp, a: l.nativeVlan, b: l.destNativeVlan }, linkId: l.id });
    }
    // R003 - switch to switch in access mode
    if (l.mode === 'access' && s.type === 'switch' && d.type === 'switch') {
      push({ id: `R003:${l.id}`, rule: 'R003', type: 'warning', code: 'R003', params: sp, linkId: l.id });
    }
    // R005 / R010 - same port / self loop
    if (l.sourceId === l.destId) {
      if (l.sourcePort === l.destPort) {
        push({ id: `R005:${l.id}`, rule: 'R005', type: 'critical', code: 'R005', params: { device: s.name, port: l.sourcePort }, deviceId: s.id, linkId: l.id });
      } else {
        push({ id: `R010:${l.id}`, rule: 'R010', type: 'warning', code: 'R010', params: sp, deviceId: s.id, linkId: l.id });
      }
    }
    // R006 - trunk without tagged VLANs
    if (l.mode === 'trunk' && (l.taggedVlans?.length ?? 0) === 0) {
      push({ id: `R006:${l.id}`, rule: 'R006', type: 'warning', code: 'R006', params: sp, linkId: l.id });
    }
    // R007 - access without VLAN
    if (l.mode === 'access' && l.accessVlan == null) {
      push({ id: `R007:${l.id}`, rule: 'R007', type: 'critical', code: 'R007', params: sp, linkId: l.id });
    }
  }

  // R008 - a physical port used by several links
  const portUse = new Map<string, string[]>();
  for (const l of links) {
    const ends: Array<readonly [string, string]> = [[l.sourceId, l.sourcePort]];
    // A link looping on the exact same port is reported by R005; count it once here.
    if (!(l.sourceId === l.destId && l.sourcePort === l.destPort)) ends.push([l.destId, l.destPort]);
    for (const [dev, port] of ends) {
      const k = `${dev}\u0000${port}`;
      portUse.set(k, [...(portUse.get(k) ?? []), l.id]);
    }
  }
  for (const [k, ids] of portUse) {
    if (ids.length < 2) continue;
    const [devId, port] = k.split('\u0000') as [string, string];
    const dev = byId.get(devId);
    if (!dev) continue;
    push({ id: `R008:${devId}:${port}`, rule: 'R008', type: 'critical', code: 'R008', params: { device: dev.name, port, count: ids.length }, deviceId: devId, linkId: ids[0] });
  }

  // R004 / R011 / R009 - management IP checks
  const ipOwners = new Map<string, typeof devices>();
  for (const dev of devices) {
    if (dev.type === 'client') continue;
    if (!dev.mgmtIp) {
      push({ id: `R004:${dev.id}`, rule: 'R004', type: 'info', code: 'R004', params: { device: dev.name }, deviceId: dev.id });
      continue;
    }
    const parsed = parseIpCidr(dev.mgmtIp);
    if (!parsed || !isValidIPv4(parsed.ip)) {
      push({ id: `R011:${dev.id}`, rule: 'R011', type: 'warning', code: 'R011', params: { device: dev.name }, deviceId: dev.id });
      continue;
    }
    ipOwners.set(parsed.ip, [...(ipOwners.get(parsed.ip) ?? []), dev]);
  }
  for (const [ip, owners] of ipOwners) {
    if (owners.length < 2) continue;
    const names = owners.map((o) => o.name).join(', ');
    for (const o of owners) {
      push({ id: `R009:${ip}:${o.id}`, rule: 'R009', type: 'critical', code: 'R009', params: { ip, devices: names }, deviceId: o.id });
    }
  }

  return alerts.sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.id.localeCompare(b.id));
}

export function summarizeAlerts(alerts: Alert[]): Record<Alert['type'], number> {
  return alerts.reduce(
    (acc, a) => ({ ...acc, [a.type]: acc[a.type] + 1 }),
    { critical: 0, warning: 0, info: 0 } as Record<Alert['type'], number>,
  );
}
