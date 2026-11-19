import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mailerHooks } from '../src/mailer';
import { setupApp } from './helpers';

const B = '/api/v1';
let c: Awaited<ReturnType<typeof setupApp>>;
const sent: { to: string; subject: string; text: string }[] = [];
let uid = '', utoken = '';

beforeAll(async () => {
  c = await setupApp();
  mailerHooks.createTransport = () => ({ sendMail: async (m: any) => { sent.push(m); } });
  const reg = await c.api.post(`${B}/auth/register`).send({ email: 'sam@test.io', name: 'Sam', password: 'longpassword' });
  utoken = reg.body.token;
  uid = reg.body.user.id;
});
afterAll(async () => { await c.pool.end(); });

describe('plain users and the admin\'s limited view of accounts', () => {
  it('a new sign-up is a normal user: own space, no Administration', async () => {
    expect((await c.api.get(`${B}/clients`).set(c.as(utoken))).body.clients).toEqual([]);
    for (const p of [c.api.get(`${B}/users`), c.api.get(`${B}/admin/settings`), c.api.post(`${B}/users/${uid}/lock`), c.api.post(`${B}/users/${uid}/send-reset`), c.api.get(`${B}/license`)])
      expect((await p.set(c.as(utoken))).status).toBe(403);
    expect((await c.api.post(`${B}/clients`).set(c.as(utoken)).send({ name: 'Mon client' })).status).toBe(201);
  });

  it('the admin sees name and e-mail only: no role, no password', async () => {
    const users = (await c.api.get(`${B}/users`).set(c.as(c.tokens.admin))).body.users;
    const sam = users.find((u: any) => u.email === 'sam@test.io');
    expect(Object.keys(sam).sort()).toEqual(['createdAt', 'email', 'id', 'locked', 'name']);
    expect(sam.locked).toBe(false);
  });

  it('the admin cannot change roles or passwords, whatever is sent', async () => {
    const r = await c.api.patch(`${B}/users/${uid}`).set(c.as(c.tokens.admin)).send({ name: 'Sam B', role: 'admin', password: 'hacked-password' });
    expect(r.status).toBe(200);
    expect(r.body.user.name).toBe('Sam B');
    expect((await c.api.get(`${B}/users`).set(c.as(utoken))).status).toBe(403); // still not an admin
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'hacked-password' })).status).toBe(401);
    const created = await c.api.post(`${B}/users`).set(c.as(c.tokens.admin)).send({ email: 'lee@test.io', name: 'Lee', password: 'longpassword', role: 'admin' });
    expect(created.status).toBe(201);
    expect((await c.api.get(`${B}/users`).set(c.as(await c.login('lee@test.io', 'longpassword')))).status).toBe(403);
  });

  it('the admin can lock and unlock an account: login refused and sessions cut at once', async () => {
    expect((await c.api.post(`${B}/users/${uid}/lock`).set(c.as(c.tokens.admin))).body.user.locked).toBe(true);
    expect((await c.api.get(`${B}/clients`).set(c.as(utoken))).status).toBe(401);
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'longpassword' })).status).toBe(423);
    // a locked account gets no reset mail either
    const n = sent.length;
    await c.api.post(`${B}/auth/forgot-password`).send({ email: 'sam@test.io' });
    await new Promise((r) => setTimeout(r, 100));
    expect(sent.length).toBe(n);
    expect((await c.api.post(`${B}/users/${uid}/unlock`).set(c.as(c.tokens.admin))).body.user.locked).toBe(false);
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'longpassword' })).status).toBe(200);
    expect((await c.api.get(`${B}/clients`).set(c.as(utoken))).status).toBe(200);
  });

  it('sends a reset link by e-mail only (never shown to the admin)', async () => {
    expect((await c.api.post(`${B}/users/${uid}/send-reset`).set(c.as(c.tokens.admin))).status).toBe(400); // no SMTP yet
    const put = await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.admin)).send({ publicUrl: 'https://nf.example.com/', smtp: { host: 'smtp.test', port: 587, secure: false, user: 'u', password: 'smtp-secret', from: 'Nial-Infra <no-reply@test.io>' } });
    expect(put.status).toBe(200);
    const r = await c.api.post(`${B}/users/${uid}/send-reset`).set(c.as(c.tokens.admin));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true });
    const mail = sent[sent.length - 1]!;
    expect(mail.to).toBe('sam@test.io');
    const token = mail.text.match(/reset=([\w-]+)/)![1]!;
    const before = (await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'longpassword' })).body.token;
    expect((await c.api.post(`${B}/auth/reset-password`).send({ token, newPassword: 'brand-new-pass1' })).status).toBe(200);
    expect((await c.api.get(`${B}/auth/me`).set(c.as(before))).status).toBe(401); // old sessions cut by the reset
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'brand-new-pass1' })).status).toBe(200);
    expect((await c.api.post(`${B}/users/nope/send-reset`).set(c.as(c.tokens.admin))).status).toBe(404);
  });

  it('forgot-password sends at most one mail per account every 5 minutes (no mail-bombing)', async () => {
    await c.api.post(`${B}/auth/register`).send({ email: 'target@test.io', name: 'Target', password: 'longpassword' });
    const n = sent.filter((m) => m.to === 'target@test.io').length;
    for (let i = 0; i < 4; i++) await c.api.post(`${B}/auth/forgot-password`).send({ email: 'target@test.io' });
    await new Promise((r) => setTimeout(r, 400));
    expect(sent.filter((m) => m.to === 'target@test.io').length).toBe(n + 1);
  });

  it('caps invitation mails per recipient and per sender (the server SMTP is not an open relay)', async () => {
    const tok = (await c.api.post(`${B}/auth/login`).send({ email: 'sam@test.io', password: 'brand-new-pass1' })).body.token; // earlier reset ended old sessions
    const cl = (await c.api.post(`${B}/clients`).set(c.as(tok)).send({ name: 'Spam test' })).body.client.id;
    const send = (email: string) => c.api.post(`${B}/clients/${cl}/invitations`).set(c.as(tok)).send({ email, role: 'viewer' });
    for (let i = 0; i < 5; i++) expect((await send('victim@test.io')).status).toBe(201);
    expect((await send('victim@test.io')).status).toBe(429);
    for (let i = 0; i < 24; i++) expect((await send(`ok${i}@test.io`)).status).toBe(201); // 5 + 24 = 29 so far this account's day
    expect((await send('one-more@test.io')).status).toBe(201); // the 30th
    expect((await send('over@test.io')).status).toBe(429);
  });
});
