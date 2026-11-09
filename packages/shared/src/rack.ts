import type { Device, Link, Rack } from './types';

type RackDevice = Pick<Device, 'id' | 'rackId' | 'rackPos' | 'rackUnits'>;

/** Units (1 = bottom) taken by a device mounted in a rack. */
export function deviceSpan(d: Pick<Device, 'rackPos' | 'rackUnits'>): [number, number] | null {
  if (d.rackPos == null) return null;
  return [d.rackPos, d.rackPos + Math.max(1, d.rackUnits) - 1];
}

/** True when `units` units starting at `pos` fit in the rack without overlapping another device. */
export function canPlace(rack: Pick<Rack, 'id' | 'units'>, devices: RackDevice[], deviceId: string, pos: number, units: number): boolean {
  const top = pos + units - 1;
  if (!Number.isInteger(pos) || pos < 1 || units < 1 || top > rack.units) return false;
  return !devices.some((d) => {
    if (d.id === deviceId || d.rackId !== rack.id) return false;
    const s = deviceSpan(d);
    return s ? pos <= s[1] && top >= s[0] : false;
  });
}

/** Lowest free position that fits `units`, or null when the rack is full. */
export function firstFreePos(rack: Pick<Rack, 'id' | 'units'>, devices: RackDevice[], deviceId: string, units: number): number | null {
  for (let p = 1; p + units - 1 <= rack.units; p++) if (canPlace(rack, devices, deviceId, p, units)) return p;
  return null;
}

export function usedUnits(rack: Pick<Rack, 'id'>, devices: RackDevice[]): number {
  return devices.filter((d) => d.rackId === rack.id && d.rackPos != null).reduce((n, d) => n + Math.max(1, d.rackUnits), 0);
}

export interface Connection {
  link: Link;
  /** Port on the inspected device. */
  localPort: string;
  remote: Device;
  remotePort: string;
  /** Rack of the remote device (null when it is not racked). */
  remoteRack: Rack | null;
  /** True when the other end sits in a different rack, or in no rack at all. */
  crossRack: boolean;
}

/** Every cable of a device, with where the other end lives, so a rack view can show "plugged into rack B". */
export function connectionsOf(device: Pick<Device, 'id' | 'rackId'>, devices: Device[], links: Link[], racks: Rack[]): Connection[] {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const rackById = new Map(racks.map((r) => [r.id, r]));
  const out: Connection[] = [];
  for (const l of links) {
    const outgoing = l.sourceId === device.id;
    if (!outgoing && l.destId !== device.id) continue;
    const remote = byId.get(outgoing ? l.destId : l.sourceId);
    if (!remote) continue;
    out.push({
      link: l,
      localPort: outgoing ? l.sourcePort : l.destPort,
      remote,
      remotePort: outgoing ? l.destPort : l.sourcePort,
      remoteRack: remote.rackId ? rackById.get(remote.rackId) ?? null : null,
      crossRack: remote.rackId !== device.rackId,
    });
  }
  return out.sort((a, b) => a.localPort.localeCompare(b.localPort, undefined, { numeric: true }));
}
