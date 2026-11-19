import type { Request } from 'express';

/**
 * Security journal: one JSON line per sensitive event on stdout (`docker compose logs server`).
 * Never logs passwords, tokens or reset/invitation links; e-mail addresses only where needed to trace an account.
 */
export function audit(event: string, req: Request | null, fields: Record<string, string | number | boolean | null | undefined> = {}) {
  console.info(JSON.stringify({ t: new Date().toISOString(), event, ip: req?.ip, actor: req?.user?.id, ...fields }));
}
