/** Small, dependency-free networking helpers. */

export function isValidIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && String(Number(p)) === p);
}

export interface ParsedIp {
  ip: string;
  prefix: number | null;
}

/** Parse "192.168.1.1" or "192.168.1.1/24". Returns null when invalid. */
export function parseIpCidr(value: string | null | undefined): ParsedIp | null {
  if (!value) return null;
  const [ip, p, ...rest] = value.trim().split('/');
  if (rest.length || !ip || !isValidIPv4(ip)) return null;
  if (p === undefined) return { ip, prefix: null };
  if (!/^\d{1,2}$/.test(p)) return null;
  const prefix = Number(p);
  if (prefix < 0 || prefix > 32) return null;
  return { ip, prefix };
}

export function prefixToMask(prefix: number): string {
  const bits = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return [bits >>> 24, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255].join('.');
}

export function isValidVlan(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4094;
}

/** "10, 20,30-32" -> [10,20,30,31,32]. Invalid tokens are ignored. */
export function parseVlanList(input: string): number[] {
  const out = new Set<number>();
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const m = token.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (!isValidVlan(a) || !isValidVlan(b) || b < a || b - a > 4093) continue;
    for (let v = a; v <= b; v++) out.add(v);
  }
  return [...out].sort((x, y) => x - y);
}

/** Collapse [10,11,12,20] into ranges [[10,12],[20,20]]. */
export function toRanges(vlans: number[]): Array<[number, number]> {
  const sorted = [...new Set(vlans)].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const v of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else ranges.push([v, v]);
  }
  return ranges;
}

/** [10,11,12,20] -> "10-12,20" */
export function formatVlanList(vlans: number[]): string {
  return toRanges(vlans)
    .map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`))
    .join(',');
}
