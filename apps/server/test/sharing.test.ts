import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mailerHooks } from '../src/mailer';
import { setupApp } from './helpers';

type Ctx = Awaited<ReturnType<typeof setupApp>>;
const B = '/api/v1';
let c: Ctx;
const sent: { to: string; subject: string; text: string; html: string }[] = [];
let alice = '', bob = '', clientId = '', inviteToken = '';

beforeAll(async () => {
  c = await setupApp();
  mailerHooks.createTransport = () => ({ sendMail: async (m: any) => { sent.push(m); } });
  const st = await c.api.put(`${B}/admin/settings`).set(c.as(c.tokens.admin)).send({ publicUrl: 'https://nf.example.com/', smtp: { host: 'smtp.test', port: 587, secure: false, user: 'u', password: 'smtp-secret', from: 'Nial-Infra <no-reply@test.io>' } });
  expect(st.status).toBe(200);
  const reg = async (email: string, name: string) => (await c.api.post(`${B}/auth/register`).send({ email, name, password: 'longpassword' })).body.token as string;
  alice = await reg('alice@test.io', 'Alice');
  bob = await reg('bob@test.io', 'Bob');
});
afterAll(async () => { await c.pool.end(); });

describe('every user owns and shares their own clients', () => {
  it('a normal user creates a client and becomes its owner', async () => {
    const r = await c.api.post(`${B}/clients`).set(c.as(alice)).send({ name: 'Alice SARL' });
    expect(r.status).toBe(201);
    expect(r.body.client).toMatchObject({ name: 'Alice SARL', isOwner: true, myRole: 'technician' });
    clientId = r.body.client.id;
    const list = (await c.api.get(`${B}/clients`).set(c.as(alice))).body.clients;
    expect(list).toHaveLength(1);
    expect(list[0].isOwner).toBe(true);
    expect((await c.api.get(`${B}/clients`).set(c.as(bob))).body.clients).toEqual([]);
    expect((await c.api.post(`${B}/sites`).set(c.as(alice)).send({ clientId, name: 'Siège' })).status).toBe(201);
  });

  it('names only have to be unique among your own clients (nobody learns other users\' names)', async () => {
    expect((await c.api.post(`${B}/clients`).set(c.as(alice)).send({ name: 'alice sarl' })).status).toBe(409);
    const r = await c.api.post(`${B}/clients`).set(c.as(bob)).send({ name: 'Alice SARL' });
    expect(r.status).toBe(201);
    expect((await c.api.delete(`${B}/clients/${r.body.client.id}`).set(c.as(bob))).status).toBe(200);
  });

  it('others cannot see, share or change it', async () => {
    expect((await c.api.get(`${B}/clients/${clientId}/members`).set(c.as(bob))).status).toBe(404);
    expect((await c.api.post(`${B}/clients/${clientId}/invitations`).set(c.as(bob)).send({ email: 'x@test.io', role: 'viewer' })).status).toBe(404);
    expect((await c.api.patch(`${B}/clients/${clientId}`).set(c.as(bob)).send({ name: 'hack' })).status).toBe(404);
    expect((await c.api.delete(`${B}/clients/${clientId}`).set(c.as(bob))).status).toBe(404);
  });

  it('sharing sends a mail naming the sender and the permission, and refuses sharing with yourself', async () => {
    expect((await c.api.post(`${B}/clients/${clientId}/invitations`).set(c.as(alice)).send({ email: 'alice@test.io', role: 'viewer' })).status).toBe(400);
    const r = await c.api.post(`${B}/clients/${clientId}/invitations`).set(c.as(alice)).send({ email: 'Bob@Test.io', role: 'viewer' });
    expect(r.status).toBe(201);
    expect(r.body.emailSent).toBe(true);
    const m = sent[sent.length - 1]!;
    expect(m.to).toBe('bob@test.io');
    expect(m.subject).toContain('Alice');
    expect(m.text).toContain('Alice vous invite');
    expect(m.text).toContain('lecture seule');
    inviteToken = m.text.match(/invite=([\w-]+)/)![1]!;
    const pv = (await c.api.get(`${B}/invitations/preview?token=${inviteToken}`)).body;
    expect(pv).toMatchObject({ clientName: 'Alice SARL', invitedByName: 'Alice', role: 'viewer' });
  });

  it('the invited person accepts and gets read-only access', async () => {
    expect((await c.api.post(`${B}/invitations/accept`).set(c.as(bob)).send({ token: inviteToken })).status).toBe(200);
    const list = (await c.api.get(`${B}/clients`).set(c.as(bob))).body.clients;
    expect(list[0]).toMatchObject({ id: clientId, myRole: 'viewer', isOwner: false });
    expect((await c.api.get(`${B}/clients/${clientId}/topology`).set(c.as(bob))).status).toBe(200);
    const dev = { clientId, type: 'switch', name: 'sw', model: 'X', portCount: 8, portPrefix: 'Gi0/' };
    expect((await c.api.post(`${B}/devices`).set(c.as(bob)).send(dev)).status).toBe(403);
    // Not the owner: cannot share, rename, delete or add sites.
    expect((await c.api.get(`${B}/clients/${clientId}/members`).set(c.as(bob))).status).toBe(403);
    expect((await c.api.patch(`${B}/clients/${clientId}`).set(c.as(bob)).send({ name: 'x' })).status).toBe(403);
    expect((await c.api.delete(`${B}/clients/${clientId}`).set(c.as(bob))).status).toBe(403);
    expect((await c.api.post(`${B}/sites`).set(c.as(bob)).send({ clientId, name: 'S2' })).status).toBe(403);
  });

  it('the owner switches the permission to edit, and the invitee can then modify', async () => {
    const m = (await c.api.get(`${B}/clients/${clientId}/members`).set(c.as(alice))).body.members;
    expect(m.map((x: any) => [x.email, x.role, x.isOwner])).toEqual([['alice@test.io', 'technician', true], ['bob@test.io', 'viewer', false]]);
    const bobId = m.find((x: any) => x.email === 'bob@test.io').userId;
    expect((await c.api.patch(`${B}/clients/${clientId}/members/${bobId}`).set(c.as(alice)).send({ role: 'technician' })).status).toBe(200);
    const dev = { clientId, type: 'switch', name: 'sw', model: 'X', portCount: 8, portPrefix: 'Gi0/' };
    expect((await c.api.post(`${B}/devices`).set(c.as(bob)).send(dev)).status).toBe(201);
    // Edit rights still do not include managing the client itself.
    expect((await c.api.post(`${B}/clients/${clientId}/invitations`).set(c.as(bob)).send({ email: 'z@test.io', role: 'viewer' })).status).toBe(403);
  });

  it('the owner cannot be demoted or removed; a member can leave; the owner can revoke an invitation', async () => {
    const m = (await c.api.get(`${B}/clients/${clientId}/members`).set(c.as(alice))).body.members;
    const aliceId = m.find((x: any) => x.isOwner).userId;
    const bobId = m.find((x: any) => x.email === 'bob@test.io').userId;
    expect((await c.api.patch(`${B}/clients/${clientId}/members/${aliceId}`).set(c.as(alice)).send({ role: 'viewer' })).status).toBe(400);
    expect((await c.api.delete(`${B}/clients/${clientId}/members/${aliceId}`).set(c.as(alice))).status).toBe(400);
    expect((await c.api.delete(`${B}/clients/${clientId}/members/${aliceId}`).set(c.as(bob))).status).toBe(403);
    expect((await c.api.delete(`${B}/clients/${clientId}/members/${bobId}`).set(c.as(bob))).status).toBe(200); // leaves
    expect((await c.api.get(`${B}/clients`).set(c.as(bob))).body.clients).toEqual([]);
    const inv = (await c.api.post(`${B}/clients/${clientId}/invitations`).set(c.as(alice)).send({ email: 'carl@test.io', role: 'viewer' })).body.invitation;
    expect((await c.api.delete(`${B}/invitations/${inv.id}`).set(c.as(bob))).status).toBe(404);
    expect((await c.api.delete(`${B}/invitations/${inv.id}`).set(c.as(alice))).status).toBe(200);
  });

  it('admins get no access to anybody\'s clients, and the owner can delete theirs', async () => {
    const adm = c.as(c.tokens.admin);
    expect((await c.api.get(`${B}/clients`).set(adm)).body.clients.map((x: any) => x.id)).not.toContain(clientId);
    for (const p of [
      c.api.get(`${B}/clients/${clientId}/members`), c.api.get(`${B}/clients/${clientId}/topology`), c.api.get(`${B}/sites?clientId=${clientId}`),
      c.api.get(`${B}/devices?clientId=${clientId}`), c.api.patch(`${B}/clients/${clientId}`).send({ name: 'x' }), c.api.delete(`${B}/clients/${clientId}`),
      c.api.post(`${B}/clients/${clientId}/invitations`).send({ email: 'spy@test.io', role: 'technician' }), c.api.post(`${B}/sites`).send({ clientId, name: 'spy' }),
      c.api.get(`${B}/export/csv?clientId=${clientId}`),
    ]) expect((await p.set(adm)).status).toBe(404);
    // no unscoped listing across clients either
    expect((await c.api.get(`${B}/devices`).set(adm)).status).toBe(400);
    expect((await c.api.get(`${B}/sites`).set(adm)).status).toBe(400);
    expect((await c.api.get(`${B}/links`).set(adm)).status).toBe(400);
    expect((await c.api.patch(`${B}/clients/${clientId}`).set(c.as(alice)).send({ name: 'Alice SA' })).status).toBe(200);
    expect((await c.api.delete(`${B}/clients/${clientId}`).set(c.as(alice))).status).toBe(200);
    expect((await c.api.get(`${B}/clients`).set(c.as(alice))).body.clients).toEqual([]);
  });

  it('deleting an account passes its shared clients to a member, and removes unshared ones', async () => {
    const mk = async (tok: string, name: string) => (await c.api.post(`${B}/clients`).set(c.as(tok)).send({ name })).body.client.id as string;
    const shared = await mk(alice, 'Partagé'), alone = await mk(alice, 'Seul');
    const inv = await c.api.post(`${B}/clients/${shared}/invitations`).set(c.as(alice)).send({ email: 'bob@test.io', role: 'viewer' });
    const tok = inv.body.link.match(/invite=([\w-]+)/)[1];
    await c.api.post(`${B}/invitations/accept`).set(c.as(bob)).send({ token: tok });
    const aliceId = (await c.api.get(`${B}/auth/me`).set(c.as(alice))).body.user.id;
    expect((await c.api.delete(`${B}/users/${aliceId}`).set(c.as(c.tokens.admin))).status).toBe(200);
    const list = (await c.api.get(`${B}/clients`).set(c.as(bob))).body.clients;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: shared, isOwner: true, myRole: 'technician' });
    expect((await c.pool.query('SELECT 1 FROM clients WHERE id=$1', [alone])).rowCount).toBe(0);
  });
});
