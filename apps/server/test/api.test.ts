import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as store from '../src/store';
import { setupApp } from './helpers';

type Ctx = Awaited<ReturnType<typeof setupApp>>;
let c: Ctx;
const B = '/api/v1';
const grantTech = async (cid: string) => {
  const u = await c.pool.query("SELECT id FROM users WHERE email='technician@test.io'");
  await store.members.set(c.pool, cid, u.rows[0].id, 'technician');
  return cid;
};
let clientId: string, sw1: string, sw2: string, pc: string;

beforeAll(async () => { c = await setupApp(); });
afterAll(async () => { await c.pool.end(); });

describe('auth', () => {
  it('health is public', async () => { expect((await c.api.get(`${B}/health`)).body.status).toBe('ok'); });
  it('rejects bad credentials with a generic message', async () => {
    const r = await c.api.post(`${B}/auth/login`).send({ email: 'admin@test.io', password: 'nope' });
    expect(r.status).toBe(401);
    const r2 = await c.api.post(`${B}/auth/login`).send({ email: 'ghost@test.io', password: 'nope' });
    expect(r2.body.error).toBe(r.body.error);
  });
  it('requires a valid token', async () => {
    expect((await c.api.get(`${B}/clients`)).status).toBe(401);
    expect((await c.api.get(`${B}/clients`).set({ Authorization: 'Bearer abc' })).status).toBe(401);
    const none = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIn0.';
    expect((await c.api.get(`${B}/clients`).set({ Authorization: `Bearer ${none}` })).status).toBe(401);
  });
  it('returns the current user', async () => {
    const r = await c.api.get(`${B}/auth/me`).set(c.as(c.tokens.tech));
    expect(r.body.user.role).toBe('technician');
    expect(JSON.stringify(r.body)).not.toContain('password');
  });
});

describe('RBAC', () => {
  it('only admins create clients', async () => {
    expect((await c.api.post(`${B}/clients`).set(c.as(c.tokens.viewer)).send({ name: 'X' })).status).toBe(403);
    expect((await c.api.post(`${B}/clients`).set(c.as(c.tokens.tech)).send({ name: 'X' })).status).toBe(403);
    const r = await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'ACME' });
    expect(r.status).toBe(201);
    clientId = r.body.client.id;
    // Technicians and viewers only see clients they are members of.
    for (const [email, role] of [['technician@test.io', 'technician'], ['viewer@test.io', 'viewer']] as const) {
      const u = await c.pool.query('SELECT id FROM users WHERE email=$1', [email]);
      await store.members.set(c.pool, clientId, u.rows[0].id, role);
    }
  });
  it('client names are unique case-insensitively', async () => {
    expect((await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'acme' })).status).toBe(409);
  });
  it('viewers are read-only', async () => {
    expect((await c.api.get(`${B}/clients`).set(c.as(c.tokens.viewer))).status).toBe(200);
    expect((await c.api.post(`${B}/devices`).set(c.as(c.tokens.viewer)).send({ clientId, name: 'S', type: 'switch' })).status).toBe(403);
  });
});

describe('devices', () => {
  it('technicians create devices; defaults depend on the type', async () => {
    const r = await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: "SW-1 ' OR 1=1 --", type: 'switch', mgmtIp: '10.0.0.1/24', mgmtUsername: 'admin', mgmtPassword: 'S3cret!', x: 10, y: 20 });
    expect(r.status).toBe(201);
    sw1 = r.body.device.id;
    expect(r.body.device).toMatchObject({ portCount: 24, portPrefix: 'Gi1/0/', hasCredentials: true, credentialsUsername: 'admin', name: "SW-1 ' OR 1=1 --" });
    expect(JSON.stringify(r.body)).not.toContain('S3cret');
    sw2 = (await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'SW-2', type: 'switch', mgmtIp: '10.0.0.2' })).body.device.id;
    pc = (await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'PC-1', type: 'client' })).body.device.id;
  });
  it('stores the password encrypted and decrypts it only for admin/technician', async () => {
    const raw = (await c.pool.query('SELECT cred_password_enc FROM devices WHERE id=$1', [sw1])).rows[0].cred_password_enc as string;
    expect(raw.startsWith('v1:')).toBe(true);
    expect(raw).not.toContain('S3cret');
    expect((await c.api.get(`${B}/devices/${sw1}/credentials`).set(c.as(c.tokens.tech))).body).toEqual({ username: 'admin', password: 'S3cret!' });
    expect((await c.api.get(`${B}/devices/${sw1}/credentials`).set(c.as(c.tokens.viewer))).status).toBe(403);
  });
  it('hides credential usernames from viewers', async () => {
    const list = (await c.api.get(`${B}/devices?clientId=${clientId}`).set(c.as(c.tokens.viewer))).body.devices;
    const d = list.find((x: any) => x.id === sw1);
    expect(d.credentialsUsername).toBeNull();
    expect(d.hasCredentials).toBe(true);
  });
  it('keeps the password on update unless told otherwise', async () => {
    await c.api.put(`${B}/devices/${sw1}`).set(c.as(c.tokens.tech)).send({ name: 'SW-1', x: 99 });
    expect((await c.api.get(`${B}/devices/${sw1}/credentials`).set(c.as(c.tokens.admin))).body.password).toBe('S3cret!');
    await c.api.put(`${B}/devices/${sw1}`).set(c.as(c.tokens.tech)).send({ mgmtPassword: 'N3w' });
    expect((await c.api.get(`${B}/devices/${sw1}/credentials`).set(c.as(c.tokens.admin))).body.password).toBe('N3w');
    await c.api.put(`${B}/devices/${sw1}`).set(c.as(c.tokens.tech)).send({ mgmtPassword: 'S3cret!' });
  });
  it('validates input', async () => {
    expect((await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'bad', type: 'switch', mgmtIp: '999.1.1.1' })).status).toBe(400);
    expect((await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'bad', type: 'toaster' })).status).toBe(400);
    expect((await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'bad', type: 'switch', mgmtVlan: 5000 })).status).toBe(400);
    expect((await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId: 'nope', name: 'bad', type: 'switch' })).status).toBe(404);
  });
  it('rejects a site that belongs to another client', async () => {
    const other = await grantTech((await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Other' })).body.client.id);
    const site = (await c.api.post(`${B}/sites`).set(c.as(c.tokens.admin)).send({ clientId: other, name: 'HQ' })).body.site.id;
    expect((await c.api.put(`${B}/devices/${sw1}`).set(c.as(c.tokens.tech)).send({ siteId: site })).status).toBe(400);
  });
});

describe('links', () => {
  let linkId: string;
  it('creates and normalizes links', async () => {
    const r = await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: sw1, sourcePort: 'Gi1/0/1', destId: sw2, destPort: 'Gi1/0/1', mode: 'trunk', nativeVlan: 99, taggedVlans: [20, 10, 10] });
    expect(r.status).toBe(201);
    linkId = r.body.link.id;
    expect(r.body.link).toMatchObject({ clientId, taggedVlans: [10, 20], nativeVlan: 99, accessVlan: null });
  });
  it('switching to access clears trunk data', async () => {
    const r = await c.api.put(`${B}/links/${linkId}`).set(c.as(c.tokens.tech)).send({ mode: 'access', accessVlan: 10 });
    expect(r.body.link).toMatchObject({ mode: 'access', accessVlan: 10, taggedVlans: [], nativeVlan: null });
    await c.api.put(`${B}/links/${linkId}`).set(c.as(c.tokens.tech)).send({ mode: 'trunk', nativeVlan: 99, taggedVlans: [10, 20] });
  });
  it('rejects links across clients and unknown devices', async () => {
    const other = (await c.api.get(`${B}/clients`).set(c.as(c.tokens.admin))).body.clients.find((x: any) => x.name === 'Other').id;
    const od = (await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId: other, name: 'O1', type: 'switch' })).body.device.id;
    expect((await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: sw1, sourcePort: '1', destId: od, destPort: '1', mode: 'access', accessVlan: 1 })).status).toBe(400);
    expect((await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: sw1, sourcePort: '1', destId: 'ghost', destPort: '1', mode: 'access', accessVlan: 1 })).status).toBe(400);
  });
  it('deleting a device removes its links', async () => {
    const d = (await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'TMP', type: 'switch' })).body.device.id;
    await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: d, sourcePort: 'a', destId: sw2, destPort: 'b', mode: 'access', accessVlan: 5 });
    expect((await c.api.get(`${B}/links?deviceId=${d}`).set(c.as(c.tokens.tech))).body.links).toHaveLength(1);
    await c.api.delete(`${B}/devices/${d}`).set(c.as(c.tokens.tech));
    // The device is gone, so is every link that touched it.
    expect((await c.api.get(`${B}/links?clientId=${clientId}`).set(c.as(c.tokens.tech))).body.links.some((l: any) => l.sourceId === d || l.destId === d)).toBe(false);
  });
});

describe('validation and exports', () => {
  it('flags a client on a trunk', async () => {
    await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: sw2, sourcePort: 'Gi1/0/5', destId: pc, destPort: 'eth1', mode: 'trunk', taggedVlans: [10] });
    const r = await c.api.post(`${B}/validate`).set(c.as(c.tokens.viewer)).send({ clientId });
    expect(r.body.alerts.map((a: any) => a.rule)).toContain('R001');
  });
  it('exports a CSV cabling matrix', async () => {
    const r = await c.api.get(`${B}/export/csv?clientId=${clientId}`).set(c.as(c.tokens.viewer));
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain('Connected To');
    expect(r.text).toContain('SW-2');
  });
  it('exports CLI configs for the three vendors', async () => {
    const cisco = await c.api.get(`${B}/export/config?clientId=${clientId}&vendor=cisco`).set(c.as(c.tokens.viewer));
    expect(cisco.text).toContain('switchport mode trunk');
    const hw = await c.api.get(`${B}/export/config?deviceId=${sw1}&vendor=huawei`).set(c.as(c.tokens.viewer));
    expect(hw.text).toContain('port link-type trunk');
    expect((await c.api.get(`${B}/export/config?clientId=${clientId}&vendor=junos`).set(c.as(c.tokens.viewer))).status).toBe(400);
    expect((await c.api.get(`${B}/export/config`).set(c.as(c.tokens.viewer))).status).toBe(400);
  });
  it('exports a PDF', async () => {
    const r = await c.api.get(`${B}/export/pdf?clientId=${clientId}`).set(c.as(c.tokens.viewer)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect((r.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('.shmnlt import/export and revisions', () => {
  it('exports without credentials and imports into another client', async () => {
    const exp = await c.api.get(`${B}/clients/${clientId}/export`).set(c.as(c.tokens.viewer));
    expect(exp.body.format).toBe('shmnlt');
    expect(JSON.stringify(exp.body)).not.toMatch(/S3cret|credentials|admin/);
    const target = await grantTech((await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Imported' })).body.client.id);
    const imp = await c.api.post(`${B}/clients/${target}/import`).set(c.as(c.tokens.tech)).send(exp.body);
    expect(imp.status).toBe(201);
    const topo = (await c.api.get(`${B}/clients/${target}/topology`).set(c.as(c.tokens.tech))).body;
    expect(topo.devices).toHaveLength(exp.body.devices.length);
    expect(topo.links).toHaveLength(exp.body.links.length);
    expect(new Set(topo.devices.map((d: any) => d.id)).has(sw1)).toBe(false);
  });
  it('rejects a malformed import atomically', async () => {
    const target = await grantTech((await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Bad import' })).body.client.id);
    const bad = { format: 'shmnlt', version: 1, client: { name: 'x' }, devices: [{ id: 'a', name: 'A', type: 'switch' }], links: [{ sourceId: 'a', sourcePort: '1', destId: 'zz', destPort: '1', mode: 'access' }] };
    expect((await c.api.post(`${B}/clients/${target}/import`).set(c.as(c.tokens.tech)).send(bad)).status).toBe(400);
    expect((await c.api.get(`${B}/clients/${target}/topology`).set(c.as(c.tokens.tech))).body.devices).toHaveLength(0);
  });
  it('restores a revision and keeps stored credentials', async () => {
    const rev = (await c.api.post(`${B}/clients/${clientId}/revisions`).set(c.as(c.tokens.tech)).send({ note: 'before' })).body.revision;
    await c.api.delete(`${B}/devices/${sw2}`).set(c.as(c.tokens.tech));
    await c.api.put(`${B}/devices/${sw1}`).set(c.as(c.tokens.tech)).send({ name: 'RENAMED' });
    expect((await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(c.tokens.tech))).body.devices.some((d: any) => d.id === sw2)).toBe(false);
    expect((await c.api.post(`${B}/revisions/${rev.id}/restore`).set(c.as(c.tokens.viewer))).status).toBe(403);
    expect((await c.api.post(`${B}/revisions/${rev.id}/restore`).set(c.as(c.tokens.tech))).status).toBe(200);
    const topo = (await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(c.tokens.tech))).body;
    expect(topo.devices.find((d: any) => d.id === sw2)).toBeTruthy();
    expect(topo.devices.find((d: any) => d.id === sw1).name).toBe('SW-1');
    expect((await c.api.get(`${B}/devices/${sw1}/credentials`).set(c.as(c.tokens.tech))).body.password).toBe('S3cret!');
    const list = (await c.api.get(`${B}/clients/${clientId}/revisions`).set(c.as(c.tokens.viewer))).body.revisions;
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some((r: any) => r.note.includes('Automatic backup'))).toBe(true);
    expect(list[0].authorName).toBe('technician');
  });
});

describe('users', () => {
  it('admins manage users', async () => {
    const r = await c.api.post(`${B}/users`).set(c.as(c.tokens.admin)).send({ email: 'New@Test.io', name: 'New', password: 'longpassword', role: 'viewer' });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe('new@test.io');
    expect((await c.api.get(`${B}/users`).set(c.as(c.tokens.tech))).status).toBe(403);
    const token = await c.login('new@test.io', 'longpassword');
    expect((await c.api.get(`${B}/clients`).set(c.as(token))).status).toBe(200);
    await c.api.delete(`${B}/users/${r.body.user.id}`).set(c.as(c.tokens.admin));
    expect((await c.api.get(`${B}/clients`).set(c.as(token))).status).toBe(401); // deleted user loses access at once
  });
  it('protects the last admin and self-deletion', async () => {
    const me = (await c.api.get(`${B}/auth/me`).set(c.as(c.tokens.admin))).body.user;
    expect((await c.api.delete(`${B}/users/${me.id}`).set(c.as(c.tokens.admin))).status).toBe(400);
    expect((await c.api.patch(`${B}/users/${me.id}`).set(c.as(c.tokens.admin)).send({ role: 'viewer' })).status).toBe(400);
  });
  it('changes password', async () => {
    expect((await c.api.post(`${B}/auth/change-password`).set(c.as(c.tokens.viewer)).send({ currentPassword: 'wrong', newPassword: 'newpassword1' })).status).toBe(400);
    expect((await c.api.post(`${B}/auth/change-password`).set(c.as(c.tokens.viewer)).send({ currentPassword: 'password123', newPassword: 'newpassword1' })).status).toBe(200);
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'viewer@test.io', password: 'newpassword1' })).status).toBe(200);
  });
});

/* ------------------- accounts, invitations, SMTP, racks, cable media ------------------- */
import { mailerHooks } from '../src/mailer';

describe('accounts, invitations and password reset', () => {
  const sent: { to: string; subject: string; text: string }[] = [];
  const lastLink = (re: RegExp) => sent[sent.length - 1]!.text.match(re)![0];
  let inviteToken = '';
  let acme: string;

  it('captures mails instead of sending them', () => {
    mailerHooks.createTransport = () => ({ sendMail: async (m: any) => { sent.push(m); } });
  });

  it('reports registration and e-mail availability publicly', async () => {
    expect((await c.api.get(`${B}/auth/config`)).body).toEqual({ registrationEnabled: true, emailEnabled: false });
  });

  it('a new account sees no client at all', async () => {
    const r = await c.api.post(`${B}/auth/register`).send({ email: 'Newbie@Test.io', name: 'Newbie', password: 'longpassword' });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe('newbie@test.io');
    const tok = r.body.token;
    acme = (await c.api.get(`${B}/clients`).set(c.as(c.tokens.admin))).body.clients.find((x: any) => x.name === 'ACME').id;
    expect((await c.api.get(`${B}/clients`).set(c.as(tok))).body.clients).toEqual([]);
    expect((await c.api.get(`${B}/clients/${acme}/topology`).set(c.as(tok))).status).toBe(404);
    expect((await c.api.get(`${B}/devices?clientId=${acme}`).set(c.as(tok))).status).toBe(404);
    expect((await c.api.get(`${B}/devices`).set(c.as(tok))).status).toBe(400); // non-admins must name a client
    expect((await c.api.put(`${B}/devices/${sw1}`).set(c.as(tok)).send({ name: 'x' })).status).toBe(404);
    expect((await c.api.get(`${B}/export/csv?clientId=${acme}`).set(c.as(tok))).status).toBe(404);
    expect((await c.api.get(`${B}/admin/settings`).set(c.as(tok))).status).toBe(403);
  });

  it('refuses duplicate e-mails and honours the registration switch', async () => {
    expect((await c.api.post(`${B}/auth/register`).send({ email: 'newbie@test.io', name: 'Dup', password: 'longpassword' })).status).toBe(409);
    expect((await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.admin)).send({ allowRegistration: false })).status).toBe(200);
    expect((await c.api.post(`${B}/auth/register`).send({ email: 'closed@test.io', name: 'C', password: 'longpassword' })).status).toBe(403);
  });

  it('keeps the SMTP password encrypted and never returns it', async () => {
    const r = await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.admin)).send({ publicUrl: 'https://nf.example.com/', smtp: { host: 'smtp.test', port: 587, secure: false, user: 'u', password: 'smtp-secret', from: 'NetForge <no-reply@test.io>' } });
    expect(r.body.smtp).toMatchObject({ host: 'smtp.test', hasPassword: true });
    expect(r.body.publicUrl).toBe('https://nf.example.com');
    expect(JSON.stringify(r.body)).not.toContain('smtp-secret');
    const raw = (await c.pool.query("SELECT value FROM app_settings WHERE key='smtp'")).rows[0].value;
    expect(JSON.stringify(raw)).not.toContain('smtp-secret');
    // omitting the password keeps it
    const r2 = await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.admin)).send({ smtp: { host: 'smtp.test', port: 465, secure: true, user: 'u', from: 'NetForge <no-reply@test.io>' } });
    expect(r2.body.smtp).toMatchObject({ port: 465, hasPassword: true });
    expect((await c.api.get(`${B}/auth/config`)).body.emailEnabled).toBe(true);
    expect((await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.tech)).send({ allowRegistration: true })).status).toBe(403);
  });

  it('sends a test e-mail', async () => {
    expect((await c.api.post(`${B}/admin/settings/smtp-test`).set(c.as(c.tokens.admin)).send({ to: 'me@test.io' })).status).toBe(200);
    expect(sent.at(-1)!.to).toBe('me@test.io');
    mailerHooks.createTransport = () => ({ sendMail: async () => { throw new Error('connect ECONNREFUSED'); } });
    const bad = await c.api.post(`${B}/admin/settings/smtp-test`).set(c.as(c.tokens.admin)).send({ to: 'me@test.io' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain('ECONNREFUSED');
    mailerHooks.createTransport = () => ({ sendMail: async (m: any) => { sent.push(m); } });
  });

  it('invites by e-mail (admin only) and the invitee gets access', async () => {
    expect((await c.api.post(`${B}/clients/${acme}/invitations`).set(c.as(c.tokens.tech)).send({ email: 'guest@test.io', role: 'viewer' })).status).toBe(403);
    const r = await c.api.post(`${B}/clients/${acme}/invitations`).set(c.as(c.tokens.admin)).send({ email: 'Guest@Test.io', role: 'technician' });
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(true);
    expect(sent.at(-1)!.to).toBe('guest@test.io');
    expect(r.body.link).toMatch(/^https:\/\/nf\.example\.com\/\?invite=/);
    inviteToken = lastLink(/invite=([\w-]+)/).split('=')[1]!;
    // the database only holds a hash
    expect((await c.pool.query('SELECT token_hash FROM invitations')).rows.every((x) => x.token_hash !== inviteToken)).toBe(true);
    const pv = await c.api.get(`${B}/invitations/preview?token=${inviteToken}`);
    expect(pv.body).toEqual({ clientName: 'ACME', email: 'guest@test.io', role: 'technician' });
    expect((await c.api.get(`${B}/invitations/preview?token=${'x'.repeat(30)}`)).status).toBe(404);
  });

  it('registering with the invitation works even when registration is closed, only for the invited address', async () => {
    const wrong = await c.api.post(`${B}/auth/register`).send({ email: 'other@test.io', name: 'O', password: 'longpassword', inviteToken });
    expect(wrong.status).toBe(400);
    const ok = await c.api.post(`${B}/auth/register`).send({ email: 'guest@test.io', name: 'Guest', password: 'longpassword', inviteToken });
    expect(ok.status).toBe(201);
    const list = (await c.api.get(`${B}/clients`).set(c.as(ok.body.token))).body.clients;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'ACME', myRole: 'technician' });
    // single use
    expect((await c.api.get(`${B}/invitations/preview?token=${inviteToken}`)).status).toBe(404);
    // technicians of the client can edit, but cannot see other clients
    expect((await c.api.put(`${B}/devices/${sw1}`).set(c.as(ok.body.token)).send({ name: 'by-guest' })).status).toBe(200);
    const other = (await c.api.get(`${B}/clients`).set(c.as(c.tokens.admin))).body.clients.find((x: any) => x.name === 'Imported').id;
    expect((await c.api.get(`${B}/clients/${other}/topology`).set(c.as(ok.body.token))).status).toBe(404);
  });

  it('an existing account accepts an invitation while signed in, with the right address only', async () => {
    await c.api.post(`${B}/clients/${acme}/invitations`).set(c.as(c.tokens.admin)).send({ email: 'viewer@test.io', role: 'viewer' });
    const tok = lastLink(/invite=([\w-]+)/).split('=')[1]!;
    expect((await c.api.post(`${B}/invitations/accept`).set(c.as(c.tokens.tech)).send({ token: tok })).status).toBe(403);
    const ok = await c.api.post(`${B}/invitations/accept`).set(c.as(c.tokens.viewer)).send({ token: tok });
    expect(ok.body.clientId).toBe(acme);
  });

  it('lists, changes and removes members', async () => {
    const m = (await c.api.get(`${B}/clients/${acme}/members`).set(c.as(c.tokens.admin))).body;
    const guest = m.members.find((x: any) => x.email === 'guest@test.io');
    expect(guest.role).toBe('technician');
    expect((await c.api.patch(`${B}/clients/${acme}/members/${guest.userId}`).set(c.as(c.tokens.admin)).send({ role: 'viewer' })).status).toBe(200);
    expect((await c.api.delete(`${B}/clients/${acme}/members/${guest.userId}`).set(c.as(c.tokens.admin))).status).toBe(200);
    expect((await c.api.get(`${B}/clients/${acme}/members`).set(c.as(c.tokens.tech))).status).toBe(403);
  });

  it('revokes a pending invitation', async () => {
    const r = await c.api.post(`${B}/clients/${acme}/invitations`).set(c.as(c.tokens.admin)).send({ email: 'later@test.io', role: 'viewer' });
    expect((await c.api.delete(`${B}/invitations/${r.body.invitation.id}`).set(c.as(c.tokens.admin))).status).toBe(200);
    const tok = lastLink(/invite=([\w-]+)/).split('=')[1]!;
    expect((await c.api.get(`${B}/invitations/preview?token=${tok}`)).status).toBe(404);
  });

  it('forgot-password answers the same for unknown addresses and mails a one-hour link otherwise', async () => {
    await store.users.create(c.pool, { email: 'resetme@test.io', name: 'Reset', role: 'viewer', passwordHash: await (await import('bcryptjs')).default.hash('password123', 4) });
    const before = sent.length;
    const a = await c.api.post(`${B}/auth/forgot-password`).send({ email: 'ghost@test.io' });
    const b = await c.api.post(`${B}/auth/forgot-password`).send({ email: 'resetme@test.io' });
    expect(a.status).toBe(200); expect(b.body).toEqual(a.body);
    await new Promise((r) => setTimeout(r, 150));
    expect(sent.length).toBe(before + 1);
    const token = lastLink(/reset=([\w-]+)/).split('=')[1]!;
    expect((await c.api.post(`${B}/auth/reset-password`).send({ token: 'y'.repeat(40), newPassword: 'brandnewpass' })).status).toBe(400);
    const oldToken = await c.login('resetme@test.io');
    await new Promise((r) => setTimeout(r, 1100));
    expect((await c.api.post(`${B}/auth/reset-password`).send({ token, newPassword: 'brandnewpass' })).status).toBe(200);
    // single use, old password and old sessions are dead
    expect((await c.api.post(`${B}/auth/reset-password`).send({ token, newPassword: 'anotherpass1' })).status).toBe(400);
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'resetme@test.io', password: 'password123' })).status).toBe(401);
    expect((await c.api.get(`${B}/auth/me`).set(c.as(oldToken))).status).toBe(401);
    expect((await c.api.post(`${B}/auth/login`).send({ email: 'resetme@test.io', password: 'brandnewpass' })).status).toBe(200);
  });

  it('forgot-password never builds the link from the Host header', async () => {
    await c.api.post(`${B}/auth/forgot-password`).set('Host', 'evil.example').set('X-Forwarded-Host', 'evil.example').send({ email: 'technician@test.io' });
    await new Promise((r) => setTimeout(r, 150));
    expect(sent.at(-1)!.text).toContain('https://nf.example.com/?reset=');
    expect(sent.at(-1)!.text).not.toContain('evil.example');
  });
});

describe('equipment catalog (admin)', () => {
  it('everybody reads, only admins write', async () => {
    const body = { label: 'Aruba 6100', type: 'switch', model: '6100 24G', portCount: 28, portPrefix: '1/1/', role: 'access', rackUnits: 1 };
    expect((await c.api.post(`${B}/library`).set(c.as(c.tokens.tech)).send(body)).status).toBe(403);
    const r = await c.api.post(`${B}/library`).set(c.as(c.tokens.admin)).send(body);
    expect(r.status).toBe(201);
    expect((await c.api.get(`${B}/library`).set(c.as(c.tokens.viewer))).body.items).toHaveLength(1);
    const u = await c.api.put(`${B}/library/${r.body.item.id}`).set(c.as(c.tokens.admin)).send({ ...body, portCount: 48 });
    expect(u.body.item.portCount).toBe(48);
    expect((await c.api.post(`${B}/library`).set(c.as(c.tokens.admin)).send({ ...body, portCount: 9999 })).status).toBe(400);
    expect((await c.api.delete(`${B}/library/${r.body.item.id}`).set(c.as(c.tokens.admin))).status).toBe(200);
  });
});

describe('racks and cable media', () => {
  let rack: string, a: string, b: string, other: string;
  it('creates a rack and mounts devices at a U position', async () => {
    const r = await c.api.post(`${B}/racks`).set(c.as(c.tokens.tech)).send({ clientId, name: 'Baie 1', units: 12 });
    expect(r.status).toBe(201);
    rack = r.body.rack.id;
    expect((await c.api.post(`${B}/racks`).set(c.as(c.tokens.viewer)).send({ clientId, name: 'Nope' })).status).toBe(403);
    expect((await c.api.post(`${B}/racks`).set(c.as(c.tokens.tech)).send({ clientId, name: 'baie 1' })).status).toBe(409);
    const d1 = await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'R-SW1', type: 'switch', rackId: rack, rackPos: 3, rackUnits: 2 });
    expect(d1.body.device).toMatchObject({ rackId: rack, rackPos: 3, rackUnits: 2 });
    a = d1.body.device.id;
    // no position given → first free slot (U1)
    const d2 = await c.api.post(`${B}/devices`).set(c.as(c.tokens.tech)).send({ clientId, name: 'R-SW2', type: 'switch', rackId: rack });
    expect(d2.body.device).toMatchObject({ rackPos: 1, rackUnits: 1 });
    b = d2.body.device.id;
  });
  it('refuses overlaps, out-of-range positions and foreign racks', async () => {
    expect((await c.api.put(`${B}/devices/${b}`).set(c.as(c.tokens.tech)).send({ rackPos: 4 })).status).toBe(409);
    expect((await c.api.put(`${B}/devices/${b}`).set(c.as(c.tokens.tech)).send({ rackPos: 12, rackUnits: 2 })).status).toBe(409);
    other = (await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Rack other' })).body.client.id;
    await grantTech(other);
    const foreign = (await c.api.post(`${B}/racks`).set(c.as(c.tokens.admin)).send({ clientId: other, name: 'F' })).body.rack.id;
    expect((await c.api.put(`${B}/devices/${b}`).set(c.as(c.tokens.tech)).send({ rackId: foreign })).status).toBe(400);
  });
  it('moves within the rack and shows up in the topology', async () => {
    expect((await c.api.put(`${B}/devices/${b}`).set(c.as(c.tokens.tech)).send({ rackPos: 6 })).body.device.rackPos).toBe(6);
    const topo = (await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(c.tokens.viewer))).body;
    expect(topo.racks).toHaveLength(1);
    expect(topo.devices.find((d: any) => d.id === a).rackPos).toBe(3);
  });
  it('cannot shrink a rack below its devices; removing a rack unmounts them', async () => {
    expect((await c.api.put(`${B}/racks/${rack}`).set(c.as(c.tokens.tech)).send({ units: 5 })).status).toBe(409);
    expect((await c.api.put(`${B}/racks/${rack}`).set(c.as(c.tokens.tech)).send({ units: 8 })).body.rack.units).toBe(8);
  });
  it('stores the cable medium, validates it, and exports it', async () => {
    const l1 = await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: a, sourcePort: 'Te1/1', destId: b, destPort: 'Te1/1', mode: 'trunk', medium: 'fiber', nativeVlan: 1, taggedVlans: [10] });
    expect(l1.body.link.medium).toBe('fiber');
    const l2 = await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: a, sourcePort: 'Gi1/0/5', destId: b, destPort: 'Gi1/0/5', mode: 'access', accessVlan: 10 });
    expect(l2.body.link.medium).toBe('ethernet');
    expect((await c.api.post(`${B}/links`).set(c.as(c.tokens.tech)).send({ sourceId: a, sourcePort: 'x', destId: b, destPort: 'y', mode: 'access', medium: 'coax' })).status).toBe(400);
    const csv = (await c.api.get(`${B}/export/csv?clientId=${clientId}`).set(c.as(c.tokens.viewer))).text;
    expect(csv).toContain('Cable');
    expect(csv).toMatch(/fiber/);
    const pdf = await c.api.get(`${B}/export/pdf?clientId=${clientId}`).set(c.as(c.tokens.viewer));
    expect(pdf.status).toBe(200);
  });
  it('restores racks and positions from a revision', async () => {
    const rev = (await c.api.post(`${B}/clients/${clientId}/revisions`).set(c.as(c.tokens.tech)).send({ note: 'racked' })).body.revision;
    await c.api.delete(`${B}/racks/${rack}`).set(c.as(c.tokens.tech));
    const after = (await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(c.tokens.tech))).body;
    expect(after.racks).toHaveLength(0);
    expect(after.devices.find((d: any) => d.id === a).rackId).toBeNull();
    await c.api.post(`${B}/revisions/${rev.id}/restore`).set(c.as(c.tokens.tech));
    const back = (await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(c.tokens.tech))).body;
    expect(back.racks).toHaveLength(1);
    expect(back.devices.find((d: any) => d.id === a)).toMatchObject({ rackPos: 3, rackUnits: 2 });
    expect(back.links.some((l: any) => l.medium === 'fiber')).toBe(true);
  });
  it('round-trips racks through .shmnlt export/import', async () => {
    const exp = (await c.api.get(`${B}/clients/${clientId}/export`).set(c.as(c.tokens.tech))).body;
    const target = await grantTech((await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Racks copy' })).body.client.id);
    expect((await c.api.post(`${B}/clients/${target}/import`).set(c.as(c.tokens.tech)).send(exp)).status).toBe(201);
    const topo = (await c.api.get(`${B}/clients/${target}/topology`).set(c.as(c.tokens.tech))).body;
    expect(topo.racks.map((x: any) => x.name)).toContain('Baie 1');
    const d = topo.devices.find((x: any) => x.name === 'R-SW1');
    expect(d).toMatchObject({ rackPos: 3, rackUnits: 2 });
    expect(d.rackId).toBe(topo.racks[0].id);
    expect(topo.links.some((l: any) => l.medium === 'fiber')).toBe(true);
  });
});
