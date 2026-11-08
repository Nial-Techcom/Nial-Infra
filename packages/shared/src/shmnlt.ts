import { z } from 'zod';
import type { Device, Link, Site } from './types';
import { DEVICE_ROLES, DEVICE_TYPES, MGMT_PROTOCOLS } from './types';

/**
 * `.shmnlt` is NetForge's portable JSON topology format (one client).
 * Credentials are never exported.
 */
const vlan = z.number().int().min(1).max(4094);

export const shmnltSchema = z.object({
  format: z.literal('shmnlt'),
  version: z.literal(1),
  exportedAt: z.string().optional(),
  client: z.object({ name: z.string().min(1).max(100) }),
  sites: z.array(z.object({ id: z.string(), name: z.string().min(1).max(100) })).max(500).default([]),
  devices: z
    .array(
      z.object({
        id: z.string().min(1),
        siteId: z.string().nullable().optional(),
        name: z.string().min(1).max(100),
        type: z.enum(DEVICE_TYPES as [string, ...string[]]),
        model: z.string().max(200).nullable().optional(),
        serial: z.string().max(200).nullable().optional(),
        role: z.enum(DEVICE_ROLES as [string, ...string[]]).nullable().optional(),
        mgmtIp: z.string().max(50).nullable().optional(),
        mgmtGateway: z.string().max(50).nullable().optional(),
        mgmtPort: z.string().max(50).nullable().optional(),
        mgmtProtocols: z.array(z.enum(MGMT_PROTOCOLS as [string, ...string[]])).optional(),
        mgmtVlan: vlan.nullable().optional(),
        portCount: z.number().int().min(0).max(512).optional(),
        portPrefix: z.string().max(30).optional(),
        x: z.number().finite().optional(),
        y: z.number().finite().optional(),
      }),
    )
    .max(5000),
  links: z
    .array(
      z.object({
        id: z.string().optional(),
        sourceId: z.string().min(1),
        sourcePort: z.string().min(1).max(50),
        destId: z.string().min(1),
        destPort: z.string().min(1).max(50),
        mode: z.enum(['access', 'trunk']),
        nativeVlan: vlan.nullable().optional(),
        destNativeVlan: vlan.nullable().optional(),
        taggedVlans: z.array(vlan).optional(),
        accessVlan: vlan.nullable().optional(),
      }),
    )
    .max(20000),
});

export type ShmnltFile = z.infer<typeof shmnltSchema>;

export function buildShmnlt(clientName: string, sites: Site[], devices: Device[], links: Link[]): ShmnltFile {
  return {
    format: 'shmnlt',
    version: 1,
    exportedAt: new Date().toISOString(),
    client: { name: clientName },
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    devices: devices.map((d) => ({
      id: d.id,
      siteId: d.siteId,
      name: d.name,
      type: d.type,
      model: d.model,
      serial: d.serial,
      role: d.role,
      mgmtIp: d.mgmtIp,
      mgmtGateway: d.mgmtGateway,
      mgmtPort: d.mgmtPort,
      mgmtProtocols: d.mgmtProtocols,
      mgmtVlan: d.mgmtVlan,
      portCount: d.portCount,
      portPrefix: d.portPrefix,
      x: d.x,
      y: d.y,
    })),
    links: links.map((l) => ({
      id: l.id,
      sourceId: l.sourceId,
      sourcePort: l.sourcePort,
      destId: l.destId,
      destPort: l.destPort,
      mode: l.mode,
      nativeVlan: l.nativeVlan,
      destNativeVlan: l.destNativeVlan,
      taggedVlans: l.taggedVlans,
      accessVlan: l.accessVlan,
    })),
  };
}

export function parseShmnlt(text: string): ShmnltFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file');
  }
  const res = shmnltSchema.safeParse(raw);
  if (!res.success) {
    const first = res.error.issues[0];
    throw new Error(`Invalid .shmnlt file: ${first?.path.join('.')} ${first?.message}`);
  }
  const ids = new Set(res.data.devices.map((d) => d.id));
  for (const l of res.data.links) {
    if (!ids.has(l.sourceId) || !ids.has(l.destId)) throw new Error('Invalid .shmnlt file: a link refers to an unknown device');
  }
  return res.data;
}
