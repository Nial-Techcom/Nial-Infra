import type { Device, Link } from './types';

export const CABLING_HEADERS = ['Device', 'Port', 'Connected To', 'Remote Port', 'Mode', 'Access VLAN', 'Native VLAN', 'Tagged VLANs'] as const;

/** RFC 4180 escaping + protection against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Full port-mapping matrix: one row per link end. */
export function buildCablingMatrix(
  devices: Pick<Device, 'id' | 'name'>[],
  links: Pick<Link, 'sourceId' | 'sourcePort' | 'destId' | 'destPort' | 'mode' | 'nativeVlan' | 'destNativeVlan' | 'taggedVlans' | 'accessVlan'>[],
): unknown[][] {
  const name = new Map(devices.map((d) => [d.id, d.name]));
  const rows: unknown[][] = [[...CABLING_HEADERS]];
  const body: unknown[][] = [];
  for (const l of links) {
    const tagged = (l.taggedVlans ?? []).join(' ');
    body.push([name.get(l.sourceId) ?? '?', l.sourcePort, name.get(l.destId) ?? '?', l.destPort, l.mode, l.accessVlan ?? '', l.nativeVlan ?? '', tagged]);
    body.push([name.get(l.destId) ?? '?', l.destPort, name.get(l.sourceId) ?? '?', l.sourcePort, l.mode, l.accessVlan ?? '', l.destNativeVlan ?? l.nativeVlan ?? '', tagged]);
  }
  body.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true }));
  return rows.concat(body);
}

export function cablingMatrixCsv(devices: Pick<Device, 'id' | 'name'>[], links: Parameters<typeof buildCablingMatrix>[1]): string {
  return toCsv(buildCablingMatrix(devices, links));
}
