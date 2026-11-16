import { randomBytes, randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { Config } from '../config';
import { HttpError } from '../errors';
import { parseCheck, parseLicense, publicKeyFrom, type LicensePayload } from './core';

const DAY = 86_400_000;
export const LICENSE_CONTACT = 'contact@nial-tech.com';

interface Stored {
  installationId: string;
  trialStartedAt: string;
  token: string | null;
  /** last successful online confirmation (or import time) */
  verifiedAt: string | null;
  revoked: boolean;
}

export type LicenseState = 'trial' | 'licensed' | 'blocked';
export type BlockReason = 'trial_expired' | 'license_expired' | 'revoked' | 'unverified' | 'invalid';

export interface LicenseStatus {
  state: LicenseState;
  reason?: BlockReason;
  installationId: string;
  trialEndsAt: string;
  /** days left of the trial (trial state) or before the licence ends / online check becomes mandatory */
  daysLeft: number | null;
  license: { id: string; customer: string; email: string; expiresAt: string | null } | null;
  verifiedAt: string | null;
  contact: string;
}

export class LicenseService {
  private key;
  private cache: { at: number; value: LicenseStatus } | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private pool: Pool, private cfg: Config, private fetchImpl: typeof fetch = fetch) {
    this.key = publicKeyFrom(cfg.licensePublicKey);
  }

  /** Creates the installation id and starts the trial clock on first start. */
  async init(): Promise<void> {
    const fresh: Stored = { installationId: randomUUID(), trialStartedAt: new Date().toISOString(), token: null, verifiedAt: null, revoked: false };
    await this.pool.query("INSERT INTO app_settings (key,value) VALUES ('license',$1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(fresh)]);
  }

  private async load(): Promise<Stored> {
    let row = (await this.pool.query("SELECT value FROM app_settings WHERE key='license'")).rows[0];
    if (!row) { await this.init(); row = (await this.pool.query("SELECT value FROM app_settings WHERE key='license'")).rows[0]; }
    return row.value as Stored;
  }

  private async save(s: Stored) {
    await this.pool.query("UPDATE app_settings SET value=$1 WHERE key='license'", [JSON.stringify(s)]);
    this.cache = null;
  }

  private compute(s: Stored, now = Date.now()): LicenseStatus {
    const trialEnds = Date.parse(s.trialStartedAt) + this.cfg.trialDays * DAY;
    const base = { installationId: s.installationId, trialEndsAt: new Date(trialEnds).toISOString(), contact: LICENSE_CONTACT, verifiedAt: s.verifiedAt };
    const blocked = (reason: BlockReason, license: LicenseStatus['license'] = null): LicenseStatus => ({ ...base, state: 'blocked', reason, daysLeft: 0, license });

    const trial = (): LicenseStatus =>
      now < trialEnds ? { ...base, state: 'trial', daysLeft: Math.max(0, Math.ceil((trialEnds - now) / DAY)), license: null } : blocked('trial_expired');

    if (!s.token) return trial();
    const p: LicensePayload | null = parseLicense(s.token, this.key);
    if (!p || p.installationId !== s.installationId) return blocked('invalid');
    const info = { id: p.lid, customer: p.customer, email: p.email, expiresAt: p.expiresAt };
    if (s.revoked) return blocked('revoked', info);
    if (p.expiresAt && Date.parse(p.expiresAt) < now) return blocked('license_expired', info);
    const graceEnds = (s.verifiedAt ? Date.parse(s.verifiedAt) : now) + this.cfg.licenseGraceDays * DAY;
    if (this.cfg.licenseServerUrl && now > graceEnds) return blocked('unverified', info);
    const ends = [p.expiresAt ? Date.parse(p.expiresAt) : Infinity, this.cfg.licenseServerUrl ? graceEnds : Infinity];
    const next = Math.min(...ends);
    return { ...base, state: 'licensed', license: info, daysLeft: Number.isFinite(next) ? Math.max(0, Math.ceil((next - now) / DAY)) : null };
  }

  async status(): Promise<LicenseStatus> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.value;
    const value = this.compute(await this.load());
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Admin imports a licence file (the text sent back by Nial-Tech). */
  async importToken(text: string): Promise<LicenseStatus> {
    const s = await this.load();
    const p = parseLicense(text, this.key);
    if (!p) throw new HttpError(400, 'Invalid licence: signature check failed');
    if (p.installationId !== s.installationId) throw new HttpError(400, 'This licence was issued for another installation');
    if (p.expiresAt && Date.parse(p.expiresAt) < Date.now()) throw new HttpError(400, 'This licence has expired');
    await this.save({ ...s, token: text.trim(), revoked: false, verifiedAt: new Date().toISOString() });
    // Confirm right away when a licence server is configured; failures are tolerated (grace period).
    await this.checkOnline().catch(() => undefined);
    return this.status();
  }

  /** Asks the licence server whether the licence is still active. Network errors are ignored (grace period). */
  async checkOnline(): Promise<void> {
    if (!this.cfg.licenseServerUrl) return;
    const s = await this.load();
    const p = s.token ? parseLicense(s.token, this.key) : null;
    if (!s.token || !p) return;
    const nonce = randomBytes(16).toString('hex');
    let answer: { payload?: unknown; sig?: unknown };
    try {
      const res = await this.fetchImpl(`${this.cfg.licenseServerUrl}/api/v1/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId: p.lid, installationId: s.installationId, nonce }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 403) return;
      answer = (await res.json()) as typeof answer;
    } catch { return; }
    const c = parseCheck(answer, this.key);
    // An answer that is unsigned, replayed or about another licence is treated as "no answer".
    if (!c || c.nonce !== nonce || c.lid !== p.lid || c.installationId !== s.installationId || Math.abs(Date.now() - Date.parse(c.checkedAt)) > 10 * 60_000) return;
    await this.save({ ...s, revoked: c.status === 'revoked', verifiedAt: c.status === 'active' ? new Date().toISOString() : s.verifiedAt });
  }

  start(): void {
    const run = () => this.checkOnline().catch((e) => console.warn('Licence check failed:', e instanceof Error ? e.message : e));
    void run();
    this.timer = setInterval(run, 6 * 3600_000);
    this.timer.unref();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); }

  /** Blocks the API with 402 once the trial/licence is over. Auth, health and licence routes stay reachable. */
  gate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.method === 'OPTIONS' || req.path === '/health' || req.path.startsWith('/auth/') || req.path === '/license' || req.path.startsWith('/license/')) return next();
        const st = await this.status();
        if (st.state !== 'blocked') return next();
        res.status(402).json({ error: 'A valid licence is required. Ask your administrator to request one from ' + LICENSE_CONTACT, code: 'LICENSE_REQUIRED', reason: st.reason });
      } catch (e) { next(e); }
    };
  }
}
