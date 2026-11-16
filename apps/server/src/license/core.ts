import { createPublicKey, verify, type KeyObject } from 'node:crypto';

/**
 * Licence format shared with the (private) Nial-Infra licence server.
 *   licence file : NIAL1.<base64url(JSON payload)>.<base64url(Ed25519 signature)>
 *   check answer : { payload: base64url(JSON), sig: base64url(signature) }  (signed over "check." + payload)
 * Only the PUBLIC key lives here. The private key exists solely on the licence server.
 */
export const LICENSE_PUBLIC_KEY = 'MCowBQYDK2VwAyEA2HJJz31Txd//9w6qGsAQjf5ldJNYP5x/YO8gSpsJGh8=';

export interface LicensePayload {
  /** licence identifier */
  lid: string;
  customer: string;
  email: string;
  issuedAt: string;
  /** ISO date, or null for a perpetual licence */
  expiresAt: string | null;
  /** installation the licence is bound to */
  installationId: string;
}

export interface CheckPayload {
  lid: string;
  status: 'active' | 'revoked';
  installationId: string;
  nonce: string;
  checkedAt: string;
}

const b64u = (b: Buffer) => b.toString('base64url');
export const publicKeyFrom = (b64Der: string): KeyObject => createPublicKey({ key: Buffer.from(b64Der, 'base64'), format: 'der', type: 'spki' });

function verifyRaw(key: KeyObject, signed: string, sig: string): boolean {
  try { return verify(null, Buffer.from(signed), key, Buffer.from(sig, 'base64url')); } catch { return false; }
}

/** Returns the payload when the licence text is authentic and well-formed, otherwise null. */
export function parseLicense(text: string, key: KeyObject): LicensePayload | null {
  const parts = text.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'NIAL1') return null;
  if (!verifyRaw(key, `NIAL1.${parts[1]}`, parts[2])) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as LicensePayload;
    if (typeof p.lid !== 'string' || typeof p.installationId !== 'string' || typeof p.customer !== 'string') return null;
    if (p.expiresAt !== null && Number.isNaN(Date.parse(p.expiresAt))) return null;
    return p;
  } catch { return null; }
}

export function parseCheck(answer: { payload?: unknown; sig?: unknown }, key: KeyObject): CheckPayload | null {
  if (typeof answer?.payload !== 'string' || typeof answer?.sig !== 'string') return null;
  if (!verifyRaw(key, `check.${answer.payload}`, answer.sig)) return null;
  try { return JSON.parse(Buffer.from(answer.payload, 'base64url').toString('utf8')) as CheckPayload; } catch { return null; }
}

export { b64u };
