import { generateKeyPairSync, sign } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createPool, migrate } from '../src/db';
import { LicenseService } from '../src/license/service';
import * as store from '../src/store';
import bcrypt from 'bcryptjs';
import { KEY } from './helpers';

const kp = generateKeyPairSync('ed25519');
const PUB = kp.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const signLicense = (p: object) => { const body = `NIAL1.${b64(p)}`; return `${body}.${sign(null, Buffer.from(body), kp.privateKey).toString('base64url')}`; };
const signCheck = (p: object) => { const payload = b64(p); return { payload, sig: sign(null, Buffer.from(`check.${payload}`), kp.privateKey).toString('base64url') }; };

async function boot(over: Record<string, string> = {}, fetchImpl?: typeof fetch) {
  const cfg = loadConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL, JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: KEY, BCRYPT_ROUNDS: '4', LOGIN_RATE_LIMIT: '1000', LICENSE_PUBLIC_KEY: PUB, LICENSE_SERVER_URL: '', ...over } as NodeJS.ProcessEnv);
  const pool = createPool(cfg.databaseUrl);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  const license = new LicenseService(pool, cfg, fetchImpl);
  await license.init();
  const api = request(createApp(pool, cfg, license));
  await store.users.create(pool, { email: 'admin@test.io', name: 'admin', role: 'admin', passwordHash: await bcrypt.hash('password123', 4) });
  const token = (await api.post('/api/v1/auth/login').send({ email: 'admin@test.io', password: 'password123' })).body.token as string;
  return { pool, api, license, cfg, h: { Authorization: `Bearer ${token}` } };
}
const expire = (pool: any, days: number) => pool.query("UPDATE app_settings SET value = jsonb_set(value,'{trialStartedAt}', to_jsonb($1::text)) WHERE key='license'", [new Date(Date.now() - days * 86_400_000).toISOString()]);

describe('licensing', () => {
  it('starts a 14-day trial and works normally', async () => {
    const { api, h } = await boot();
    const st = (await api.get('/api/v1/license/status')).body;
    expect(st).toMatchObject({ state: 'trial', daysLeft: 14 });
    expect((await api.get('/api/v1/clients').set(h)).status).toBe(200);
  });

  it('blocks the API with 402 after the trial but keeps auth, health and licence reachable', async () => {
    const { api, h, pool } = await boot();
    await expire(pool, 15);
    const r = await api.get('/api/v1/clients').set(h);
    expect(r.status).toBe(402);
    expect(r.body.code).toBe('LICENSE_REQUIRED');
    expect((await api.get('/api/v1/health')).status).toBe(200);
    expect((await api.get('/api/v1/auth/me').set(h)).status).toBe(200);
    expect((await api.get('/api/v1/license').set(h)).body.license.state).toBe('blocked');
  });

  it('keeps the license endpoints admin-only', async () => {
    const { api } = await boot();
    expect((await api.get('/api/v1/license')).status).toBe(401);
    expect((await api.post('/api/v1/license').send({ license: 'x' })).status).toBe(401);
  });

  it('unlocks with a valid licence bound to the installation', async () => {
    const { api, h, pool } = await boot();
    await expire(pool, 30);
    const id = (await api.get('/api/v1/license').set(h)).body.license.installationId;
    const lic = signLicense({ lid: 'L1', customer: 'ACME', email: 'it@acme.io', issuedAt: new Date().toISOString(), expiresAt: null, installationId: id });
    const r = await api.post('/api/v1/license').set(h).send({ license: lic });
    expect(r.status).toBe(200);
    expect(r.body.license).toMatchObject({ state: 'licensed', license: { customer: 'ACME' } });
    expect((await api.get('/api/v1/clients').set(h)).status).toBe(200);
  });

  it('rejects forged, foreign and expired licences', async () => {
    const { api, h } = await boot();
    const id = (await api.get('/api/v1/license').set(h)).body.license.installationId;
    const base = { lid: 'L1', customer: 'ACME', email: 'a@b.io', issuedAt: new Date().toISOString(), expiresAt: null };
    const good = signLicense({ ...base, installationId: id });
    const [a, p, s] = good.split('.');
    const tampered = `${a}.${b64({ ...base, customer: 'EVIL', installationId: id })}.${s}`;
    expect((await api.post('/api/v1/license').set(h).send({ license: tampered })).status).toBe(400);
    expect((await api.post('/api/v1/license').set(h).send({ license: signLicense({ ...base, installationId: 'other' }) })).status).toBe(400);
    expect((await api.post('/api/v1/license').set(h).send({ license: signLicense({ ...base, installationId: id, expiresAt: '2020-01-01T00:00:00Z' }) })).status).toBe(400);
    const other = generateKeyPairSync('ed25519');
    const body = `NIAL1.${b64({ ...base, installationId: id })}`;
    const forged = `${body}.${sign(null, Buffer.from(body), other.privateKey).toString('base64url')}`;
    expect((await api.post('/api/v1/license').set(h).send({ license: forged })).status).toBe(400);
    expect(p).toBeTruthy();
  });

  it('blocks after a signed revocation from the licence server', async () => {
    let status: 'active' | 'revoked' = 'active';
    const fake = (async (_u: string, init: any) => {
      const b = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => signCheck({ lid: b.licenseId, status, installationId: b.installationId, nonce: b.nonce, checkedAt: new Date().toISOString() }) };
    }) as unknown as typeof fetch;
    const { api, h, license } = await boot({ LICENSE_SERVER_URL: 'https://lic.example' }, fake);
    const id = (await api.get('/api/v1/license').set(h)).body.license.installationId;
    await api.post('/api/v1/license').set(h).send({ license: signLicense({ lid: 'L9', customer: 'C', email: 'c@c.io', issuedAt: new Date().toISOString(), expiresAt: null, installationId: id }) });
    expect((await api.get('/api/v1/clients').set(h)).status).toBe(200);
    status = 'revoked';
    await license.checkOnline();
    const r = await api.get('/api/v1/clients').set(h);
    expect(r.status).toBe(402);
    expect(r.body.reason).toBe('revoked');
  });

  it('ignores unsigned answers and tolerates an unreachable licence server (grace period)', async () => {
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const { api, h, pool, license } = await boot({ LICENSE_SERVER_URL: 'https://lic.example' }, down);
    const id = (await api.get('/api/v1/license').set(h)).body.license.installationId;
    await api.post('/api/v1/license').set(h).send({ license: signLicense({ lid: 'L2', customer: 'C', email: 'c@c.io', issuedAt: new Date().toISOString(), expiresAt: null, installationId: id }) });
    await license.checkOnline();
    expect((await api.get('/api/v1/clients').set(h)).status).toBe(200);
    // no confirmation for longer than the grace period -> blocked
    await pool.query("UPDATE app_settings SET value = jsonb_set(value,'{verifiedAt}', to_jsonb($1::text)) WHERE key='license'", [new Date(Date.now() - 31 * 86_400_000).toISOString()]);
    (license as any).cache = null;
    const r = await api.get('/api/v1/clients').set(h);
    expect(r.status).toBe(402);
    expect(r.body.reason).toBe('unverified');
  });
});
