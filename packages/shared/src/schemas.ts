import { z } from 'zod';
import { DEVICE_ROLES, DEVICE_TYPES, LINK_MEDIA, MEMBER_ROLES, MGMT_PROTOCOLS, ROLES } from './types';
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
  rackId: z.string().min(1).nullable().optional(),
  rackPos: z.number().int().min(1).max(100).nullable().optional(),
  rackUnits: z.number().int().min(1).max(48).optional(),
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
  medium: z.enum(LINK_MEDIA as [string, ...string[]]).optional(),
  nativeVlan: vlan.nullable().optional(),
  destNativeVlan: vlan.nullable().optional(),
  taggedVlans: z.array(vlan).max(4094).optional(),
  accessVlan: vlan.nullable().optional(),
});
export const linkCreateSchema = linkBaseSchema;
export const linkUpdateSchema = linkBaseSchema.partial();

export const revisionCreateSchema = z.object({ note: z.string().trim().max(200).optional() });
export const validateSchema = z.object({ clientId: z.string().min(1) });

/* ---------- accounts, invitations, admin settings ---------- */
const emailField = z.string().trim().toLowerCase().email().max(200);
const tokenField = z.string().trim().min(20).max(200);

export const registerSchema = z.object({
  email: emailField,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  /** Token of an invitation: lets the invited person register even when open registration is off. */
  inviteToken: tokenField.optional(),
});
export const forgotPasswordSchema = z.object({ email: emailField });
export const resetPasswordSchema = z.object({ token: tokenField, newPassword: z.string().min(8).max(200) });
export const inviteCreateSchema = z.object({ email: emailField, role: z.enum(MEMBER_ROLES as [string, ...string[]]) });
export const inviteAcceptSchema = z.object({ token: tokenField });
export const memberUpdateSchema = z.object({ role: z.enum(MEMBER_ROLES as [string, ...string[]]) });

export const settingsUpdateSchema = z.object({
  publicUrl: z.string().trim().max(200).refine((v) => v === '' || /^https?:\/\/[^\s/]+(\/.*)?$/.test(v), 'Must start with http:// or https://').optional(),
  allowRegistration: z.boolean().optional(),
  smtp: z
    .object({
      host: z.string().trim().max(200),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string().trim().max(200),
      /** undefined = keep the stored password, '' = remove it, text = replace it */
      password: z.string().max(500).optional(),
      from: z.string().trim().max(200),
    })
    .optional(),
});
export const smtpTestSchema = z.object({ to: emailField });

export const libraryItemSchema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(DEVICE_TYPES as [string, ...string[]]),
  model: z.string().trim().min(1).max(100),
  portCount: z.number().int().min(0).max(512),
  portPrefix: z.string().trim().max(30),
  role: z.enum(DEVICE_ROLES as [string, ...string[]]).nullable().optional(),
  rackUnits: z.number().int().min(1).max(48).default(1),
});

export const rackSchema = z.object({
  clientId: z.string().min(1),
  siteId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(60),
  units: z.number().int().min(1).max(60).default(42),
});
export const rackUpdateSchema = rackSchema.omit({ clientId: true }).partial();
