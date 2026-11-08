import { z } from 'zod';
import { DEVICE_ROLES, DEVICE_TYPES, MGMT_PROTOCOLS, ROLES } from './types';
import { parseIpCidr } from './net';

const vlan = z.number().int().min(1).max(4094);
const ipField = z
  .string()
  .trim()
  .refine((v) => parseIpCidr(v) !== null, 'Invalid IPv4 address (use 10.0.0.1 or 10.0.0.1/24)');
const optionalText = (max = 200) => z.string().trim().max(max).nullable().optional();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES as [string, ...string[]]),
});

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(200),
    role: z.enum(ROLES as [string, ...string[]]),
  })
  .partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const clientSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const siteSchema = z.object({ clientId: z.string().min(1), name: z.string().trim().min(1).max(100) });
export const siteUpdateSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const deviceBaseSchema = z.object({
  clientId: z.string().min(1),
  siteId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(100),
  type: z.enum(DEVICE_TYPES as [string, ...string[]]),
  model: optionalText(),
  serial: optionalText(),
  role: z.enum(DEVICE_ROLES as [string, ...string[]]).nullable().optional(),
  mgmtIp: ipField.nullable().optional().or(z.literal('').transform(() => null)),
  mgmtGateway: ipField.nullable().optional().or(z.literal('').transform(() => null)),
  mgmtPort: optionalText(50),
  mgmtProtocols: z.array(z.enum(MGMT_PROTOCOLS as [string, ...string[]])).max(4).optional(),
  mgmtVlan: vlan.nullable().optional(),
  portCount: z.number().int().min(0).max(512).optional(),
  portPrefix: z.string().trim().max(30).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  mgmtUsername: optionalText(100),
  mgmtPassword: z.string().max(200).nullable().optional(),
});
export const deviceCreateSchema = deviceBaseSchema;
export const deviceUpdateSchema = deviceBaseSchema.omit({ clientId: true }).partial();

export const linkBaseSchema = z.object({
  sourceId: z.string().min(1),
  sourcePort: z.string().trim().min(1).max(50),
  destId: z.string().min(1),
  destPort: z.string().trim().min(1).max(50),
  mode: z.enum(['access', 'trunk']),
  nativeVlan: vlan.nullable().optional(),
  destNativeVlan: vlan.nullable().optional(),
  taggedVlans: z.array(vlan).max(4094).optional(),
  accessVlan: vlan.nullable().optional(),
});
export const linkCreateSchema = linkBaseSchema;
export const linkUpdateSchema = linkBaseSchema.partial();

export const revisionCreateSchema = z.object({ note: z.string().trim().max(200).optional() });
export const validateSchema = z.object({ clientId: z.string().min(1) });
