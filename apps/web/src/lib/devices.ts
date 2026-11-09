import type { Device, DevicePreset, DeviceType, LibraryItem } from '@netforge/shared';
import type { ReactFlowInstance } from 'reactflow';
import { useTopology } from '../store/topology';

const PREFIX: Record<DeviceType, string> = { firewall: 'FW', switch: 'SW', router: 'RT', server: 'SRV', access_point: 'AP', client: 'PC' };

export function uniqueName(type: DeviceType, existing: Device[]): string {
  const names = new Set(existing.map((d) => d.name));
  for (let i = 1; ; i++) {
    const n = `${PREFIX[type]}-${String(i).padStart(2, '0')}`;
    if (!names.has(n)) return n;
  }
}

export async function createFromPreset(preset: Pick<DevicePreset, 'type' | 'model' | 'portCount' | 'portPrefix'> & { role?: DevicePreset['role'] | null; rackUnits?: number }, pos: { x: number; y: number }, name?: string, rack?: { rackId: string; rackPos?: number }) {
  const s = useTopology.getState();
  if (!s.clientId) return null;
  return s.addDevice({
    clientId: s.clientId, siteId: s.activeSiteId, name: name ?? uniqueName(preset.type, s.devices), type: preset.type, model: preset.model,
    portCount: preset.portCount, portPrefix: preset.portPrefix, role: preset.role ?? null, x: Math.round(pos.x), y: Math.round(pos.y),
    rackUnits: preset.rackUnits ?? 1, ...(rack ? { rackId: rack.rackId, rackPos: rack.rackPos } : {}),
  });
}

/** Flow coordinates of the visible canvas centre, slightly staggered so successive clicks do not overlap. */
export function canvasCenter(rf: ReactFlowInstance, stagger = 0) {
  const el = document.querySelector('.react-flow');
  const r = el?.getBoundingClientRect();
  const p = rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 600) / 2, y: (r?.top ?? 0) + (r?.height ?? 400) / 2 });
  return { x: p.x - 90 + (stagger % 6) * 24, y: p.y - 40 + (stagger % 6) * 24 };
}

/** Built-in presets plus the models the admin added to the catalog; the key is what drag & drop carries. */
export function findPreset(key: string, library: LibraryItem[], builtin: DevicePreset[]) {
  if (key.startsWith('lib:')) return library.find((i) => `lib:${i.id}` === key);
  return builtin.find((p) => p.key === key);
}
