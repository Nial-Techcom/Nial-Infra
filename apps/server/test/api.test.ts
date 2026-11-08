import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp } from './helpers';

type Ctx = Awaited<ReturnType<typeof setupApp>>;
let c: Ctx;
const B = '/api/v1';
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
    const other = (await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Other' })).body.client.id;
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
    expect((await c.api.get(`${B}/links?deviceId=${d}`).set(c.as(c.tokens.tech))).body.links).toHaveLength(0);
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
    const target = (await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Imported' })).body.client.id;
    const imp = await c.api.post(`${B}/clients/${target}/import`).set(c.as(c.tokens.tech)).send(exp.body);
    expect(imp.status).toBe(201);
    const topo = (await c.api.get(`${B}/clients/${target}/topology`).set(c.as(c.tokens.viewer))).body;
    expect(topo.devices).toHaveLength(exp.body.devices.length);
    expect(topo.links).toHaveLength(exp.body.links.length);
    expect(new Set(topo.devices.map((d: any) => d.id)).has(sw1)).toBe(false);
  });
  it('rejects a malformed import atomically', async () => {
    const target = (await c.api.post(`${B}/clients`).set(c.as(c.tokens.admin)).send({ name: 'Bad import' })).body.client.id;
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
