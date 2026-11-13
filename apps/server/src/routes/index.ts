import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import {
  buildShmnlt, cablingMatrixCsv, changePasswordSchema, clientSchema, deviceCreateSchema, deviceUpdateSchema, generateClientConfig,
  generateDeviceConfig, linkCreateSchema, linkUpdateSchema, loginSchema, parseIpCidr, revisionCreateSchema, shmnltSchema, siteSchema,
  siteUpdateSchema, userCreateSchema, userUpdateSchema, validateSchema, validateTopology, VENDORS, type Vendor,
  forgotPasswordSchema, inviteAcceptSchema, inviteCreateSchema, libraryItemSchema, memberUpdateSchema, rackSchema, rackUpdateSchema,
  registerSchema, resetPasswordSchema, settingsUpdateSchema, smtpTestSchema, type AdminSettings, type MemberRole,
} from '@infra-tech/shared';
import { clientOf, requireClient } from '../access';
import { encrypt } from '../crypto';
import { baseUrl, inviteMail, resetMail, sendMail, smtpReady } from '../mailer';
import type { Config } from '../config';
import { adminOnly, authenticate, signToken } from '../auth';
import { tx } from '../db';
import { LoginThrottle } from '../throttle';
import { ah, HttpError } from '../errors';
import { writeCablingPdf } from '../pdf';
import * as store from '../store';

const DUMMY_HASH = bcrypt.hashSync('infra-tech-timing-equalizer', 4);
const param = (req: Request, name: string) => String(req.params[name]);
const safeFile = (s: string) => s.replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60) || 'infra-tech';
const q = (req: Request, name: string) => (req.query[name] ? String(req.query[name]) : undefined);

export function buildRouter(pool: Pool, cfg: Config): Router {
  const r = Router();
  const auth = authenticate(pool, cfg);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: cfg.loginRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });

  const accountThrottle = new LoginThrottle(cfg.accountLockLimit);

  r.get('/health', ah(async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }));

  /* ---------------------------------- auth ---------------------------------- */
  r.post('/auth/login', loginLimiter, ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const key = email.toLowerCase();
    const wait = accountThrottle.retryAfter(key);
    if (wait) { res.setHeader('Retry-After', String(wait)); throw new HttpError(429, 'Too many failed attempts for this account, try again later'); }
    const row = await store.users.getWithHash(pool, email);
    const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) { accountThrottle.fail(key); throw new HttpError(401, 'Invalid email or password'); }
    accountThrottle.ok(key);
    const user = store.mapUser(row);
    res.json({ token: signToken(user, cfg, store.passwordVersion(row)), user });
  }));
  r.get('/auth/me', auth, (req, res) => { res.json({ user: req.user }); });
  r.post('/auth/change-password', auth, ah(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const hash = await store.users.hashOf(pool, req.user!.id);
    if (!hash || !(await bcrypt.compare(currentPassword, hash))) throw new HttpError(400, 'Current password is incorrect');
    // Every session opened before the change stops working; the caller gets a fresh token so it stays signed in.
    await store.users.update(pool, req.user!.id, { passwordHash: await bcrypt.hash(newPassword, cfg.bcryptRounds) });
    const fresh = await store.users.getAuth(pool, req.user!.id);
    res.json({ success: true, token: signToken(req.user!, cfg, fresh?.passwordChangedAt ?? 0) });
  }));

  /* ------------------- registration, invitations, password reset ------------------- */
  const accountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: cfg.loginRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });

  r.get('/auth/config', ah(async (_req, res) => {
    const st = await store.settings.get(pool);
    res.json({ registrationEnabled: st.allowRegistration, emailEnabled: smtpReady(st.smtp) });
  }));

  r.post('/auth/register', accountLimiter, ah(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const st = await store.settings.get(pool);
    const inv = body.inviteToken ? await store.invitations.findValid(pool, body.inviteToken) : null;
    if (body.inviteToken && !inv) throw new HttpError(400, 'Invitation is invalid or expired');
    if (inv && inv.email !== body.email) throw new HttpError(400, 'This invitation was sent to another e-mail address');
    if (!inv && !st.allowRegistration) throw new HttpError(403, 'Registration is disabled');
    const user = await tx(pool, async (db) => {
      // New accounts have no access to any client: access only comes from an invitation.
      const u = await store.users.create(db, { email: body.email, name: body.name, role: 'viewer', passwordHash: await bcrypt.hash(body.password, cfg.bcryptRounds) });
      if (inv) await store.invitations.accept(db, inv, u.id);
      return u;
    });
    res.status(201).json({ token: signToken(user, cfg), user });
  }));

  r.post('/auth/forgot-password', accountLimiter, ah(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    // Same answer whether or not the address exists (no account enumeration); the mail is sent after replying.
    res.json({ success: true });
    try {
      const st = await store.settings.get(pool);
      const row = await store.users.getWithHash(pool, email);
      if (!row || !smtpReady(st.smtp)) return;
      const token = await store.passwordResets.create(pool, row.id);
      await sendMail(pool, cfg, { to: row.email, ...resetMail(`${baseUrl(st, cfg)}/?reset=${token}`) });
    } catch (e) {
      console.error('forgot-password mail failed:', (e as Error).message);
    }
  }));

  r.post('/auth/reset-password', accountLimiter, ah(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const userId = await store.passwordResets.consume(pool, token);
    if (!userId) throw new HttpError(400, 'This reset link is invalid or has expired');
    await store.users.setPassword(pool, userId, await bcrypt.hash(newPassword, cfg.bcryptRounds), true);
    res.json({ success: true });
  }));

  r.get('/invitations/preview', accountLimiter, ah(async (req, res) => {
    const inv = await store.invitations.findValid(pool, String(req.query.token ?? ''));
    if (!inv) throw new HttpError(404, 'Invitation is invalid or expired');
    res.json({ clientName: inv.clientName, email: inv.email, role: inv.role });
  }));
  r.post('/invitations/accept', auth, accountLimiter, ah(async (req, res) => {
    const { token } = inviteAcceptSchema.parse(req.body);
    const inv = await store.invitations.findValid(pool, token);
    if (!inv) throw new HttpError(404, 'Invitation is invalid or expired');
    if (inv.email !== req.user!.email.toLowerCase()) throw new HttpError(403, 'This invitation was sent to another e-mail address');
    await store.invitations.accept(pool, inv, req.user!.id);
    res.json({ clientId: inv.clientId });
  }));

  /* ------------------------- members of a client (admin) ------------------------- */
  r.get('/clients/:id/members', auth, adminOnly, ah(async (req, res) => {
    const id = param(req, 'id');
    if (!(await store.clients.get(pool, id))) throw new HttpError(404, 'Client not found');
    res.json({ members: await store.members.list(pool, id), invitations: await store.invitations.listPending(pool, id) });
  }));
  r.post('/clients/:id/invitations', auth, adminOnly, ah(async (req, res) => {
    const id = param(req, 'id');
    const client = await store.clients.get(pool, id);
    if (!client) throw new HttpError(404, 'Client not found');
    const { email, role } = inviteCreateSchema.parse(req.body);
    const { invitation, token } = await store.invitations.create(pool, id, email, role as MemberRole, req.user!.id);
    const st = await store.settings.get(pool);
    const link = `${baseUrl(st, cfg)}/?invite=${token}`;
    let emailSent = false;
    if (smtpReady(st.smtp)) {
      try { await sendMail(pool, cfg, { to: email, ...inviteMail(client.name, role, link) }); emailSent = true; } catch (e) { console.error('invitation mail failed:', (e as Error).message); }
    }
    // The link is returned to the admin so it can be passed on by hand when no mail could be sent.
    res.status(201).json({ invitation, emailSent, link });
  }));
  r.delete('/invitations/:id', auth, adminOnly, ah(async (req, res) => {
    if (!(await store.invitations.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Invitation not found');
    res.json({ success: true });
  }));
  r.patch('/clients/:id/members/:userId', auth, adminOnly, ah(async (req, res) => {
    const { role } = memberUpdateSchema.parse(req.body);
    if (!(await store.members.roleOf(pool, param(req, 'id'), param(req, 'userId')))) throw new HttpError(404, 'Member not found');
    await store.members.set(pool, param(req, 'id'), param(req, 'userId'), role as MemberRole);
    res.json({ success: true });
  }));
  r.delete('/clients/:id/members/:userId', auth, adminOnly, ah(async (req, res) => {
    if (!(await store.members.remove(pool, param(req, 'id'), param(req, 'userId')))) throw new HttpError(404, 'Member not found');
    res.json({ success: true });
  }));

  /* ------------------------------ admin settings ------------------------------ */
  const publicSettings = (st: store.StoredSettings): AdminSettings => ({
    publicUrl: st.publicUrl, allowRegistration: st.allowRegistration,
    smtp: { host: st.smtp.host, port: st.smtp.port, secure: st.smtp.secure, user: st.smtp.user, from: st.smtp.from, hasPassword: !!st.smtp.passwordEnc },
  });
  r.get('/admin/settings', auth, adminOnly, ah(async (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(publicSettings(await store.settings.get(pool))); }));
  r.put('/admin/settings', auth, adminOnly, ah(async (req, res) => {
    const u = settingsUpdateSchema.parse(req.body);
    const st = await store.settings.get(pool);
    if (u.publicUrl !== undefined) st.publicUrl = u.publicUrl.replace(/\/+$/, '');
    if (u.allowRegistration !== undefined) st.allowRegistration = u.allowRegistration;
    if (u.smtp) {
      const { password, ...rest } = u.smtp;
      st.smtp = { ...st.smtp, ...rest, passwordEnc: password === undefined ? st.smtp.passwordEnc : password === '' ? null : encrypt(password, cfg.encryptionKey) };
    }
    await store.settings.save(pool, st);
    res.json(publicSettings(st));
  }));
  r.post('/admin/settings/smtp-test', auth, adminOnly, ah(async (req, res) => {
    const { to } = smtpTestSchema.parse(req.body);
    try {
      await sendMail(pool, cfg, { to, subject: 'Infra-Tech – test SMTP', text: 'SMTP is working. / Le SMTP fonctionne.', html: '<p>SMTP is working. / Le SMTP fonctionne.</p>' });
    } catch (e) {
      throw new HttpError(400, `SMTP error: ${(e as Error).message}`.slice(0, 300));
    }
    res.json({ success: true });
  }));

  /* ------------------------------- equipment catalog ------------------------------- */
  r.get('/library', auth, ah(async (_req, res) => { res.json({ items: await store.library.list(pool) }); }));
  r.post('/library', auth, adminOnly, ah(async (req, res) => { res.status(201).json({ item: await store.library.create(pool, libraryItemSchema.parse(req.body) as any) }); }));
  r.put('/library/:id', auth, adminOnly, ah(async (req, res) => { res.json({ item: await store.library.update(pool, param(req, 'id'), libraryItemSchema.parse(req.body) as any) }); }));
  r.delete('/library/:id', auth, adminOnly, ah(async (req, res) => {
    if (!(await store.library.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Library item not found');
    res.json({ success: true });
  }));

  /* --------------------------------- users --------------------------------- */
  r.get('/users', auth, adminOnly, ah(async (_req, res) => { res.json({ users: await store.users.list(pool) }); }));
  r.post('/users', auth, adminOnly, ah(async (req, res) => {
    const u = userCreateSchema.parse(req.body);
    res.status(201).json({ user: await store.users.create(pool, { email: u.email, name: u.name, role: u.role, passwordHash: await bcrypt.hash(u.password, cfg.bcryptRounds) }) });
  }));
  r.patch('/users/:id', auth, adminOnly, ah(async (req, res) => {
    const id = param(req, 'id');
    const u = userUpdateSchema.parse(req.body);
    const target = await store.users.get(pool, id);
    if (!target) throw new HttpError(404, 'User not found');
    if (u.role && u.role !== 'admin' && target.role === 'admin' && (await store.users.adminCount(pool)) <= 1) throw new HttpError(400, 'Cannot demote the last admin');
    res.json({ user: await store.users.update(pool, id, { name: u.name, role: u.role, passwordHash: u.password ? await bcrypt.hash(u.password, cfg.bcryptRounds) : undefined }) });
  }));
  r.delete('/users/:id', auth, adminOnly, ah(async (req, res) => {
    const id = param(req, 'id');
    if (id === req.user!.id) throw new HttpError(400, 'You cannot delete your own account');
    const target = await store.users.get(pool, id);
    if (!target) throw new HttpError(404, 'User not found');
    if (target.role === 'admin' && (await store.users.adminCount(pool)) <= 1) throw new HttpError(400, 'Cannot delete the last admin');
    await store.users.remove(pool, id);
    res.json({ success: true });
  }));

  /* -------------------------------- clients -------------------------------- */
  r.get('/clients', auth, ah(async (req, res) => { res.json({ clients: await store.clients.listFor(pool, req.user!) }); }));
  r.post('/clients', auth, adminOnly, ah(async (req, res) => {
    const { name } = clientSchema.parse(req.body);
    res.status(201).json({ client: await store.clients.create(pool, name) });
  }));
  r.patch('/clients/:id', auth, adminOnly, ah(async (req, res) => {
    const { name } = clientSchema.parse(req.body);
    res.json({ client: await store.clients.rename(pool, param(req, 'id'), name) });
  }));
  r.delete('/clients/:id', auth, adminOnly, ah(async (req, res) => {
    if (!(await store.clients.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Client not found');
    res.json({ success: true });
  }));
  r.get('/clients/:id/topology', auth, ah(async (req, res) => {
    const role = await requireClient(pool, req, param(req, 'id'));
    res.json(await store.loadTopology(pool, param(req, 'id'), role !== 'viewer'));
  }));

  r.get('/clients/:id/export', auth, ah(async (req, res) => {
    await requireClient(pool, req, param(req, 'id'));
    const t = await store.loadTopology(pool, param(req, 'id'), false);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}.shmnlt"`);
    res.json(buildShmnlt(t.client.name, t.sites, t.devices, t.links, t.racks));
  }));

  r.post('/clients/:id/import', auth, ah(async (req, res) => {
    const clientId = param(req, 'id');
    await requireClient(pool, req, clientId, 'write');
    const file = shmnltSchema.parse(req.body);
    const ids = new Set(file.devices.map((d) => d.id));
    if (file.links.some((l) => !ids.has(l.sourceId) || !ids.has(l.destId))) throw new HttpError(400, 'A link refers to an unknown device');
    const result = await tx(pool, async (db) => {
      if (!(await store.clients.get(db, clientId))) throw new HttpError(404, 'Client not found');
      const siteByName = new Map((await store.sites.list(db, clientId)).map((s) => [s.name, s.id]));
      const fileSite = new Map(file.sites.map((s) => [s.id, s.name]));
      const idMap = new Map<string, string>();
      const rackMap = new Map<string, string>();
      const rackByName = new Map((await store.racks.list(db, clientId)).map((x) => [x.name, x.id]));
      for (const rk of file.racks ?? []) {
        const sname = rk.siteId ? fileSite.get(rk.siteId) : undefined;
        const siteId = sname ? siteByName.get(sname) ?? null : null;
        const existing = rackByName.get(rk.name);
        const id = existing ?? (await store.racks.create(db, { clientId, siteId, name: rk.name, units: rk.units })).id;
        rackMap.set(rk.id, id);
      }
      for (const d of file.devices) {
        let siteId: string | null = null;
        const sname = d.siteId ? fileSite.get(d.siteId) : undefined;
        if (sname) {
          if (!siteByName.has(sname)) siteByName.set(sname, (await store.sites.create(db, clientId, sname)).id);
          siteId = siteByName.get(sname)!;
        }
        const row = await store.devices.create(db, {
          clientId, siteId, name: d.name, type: d.type, model: d.model, serial: d.serial, role: d.role,
          mgmtIp: parseIpCidr(d.mgmtIp) ? d.mgmtIp : null, mgmtGateway: parseIpCidr(d.mgmtGateway) ? d.mgmtGateway : null,
          mgmtPort: d.mgmtPort, mgmtProtocols: d.mgmtProtocols, mgmtVlan: d.mgmtVlan, portCount: d.portCount, portPrefix: d.portPrefix, x: d.x, y: d.y,
          rackId: d.rackId ? rackMap.get(d.rackId) ?? null : null, rackPos: d.rackId ? d.rackPos ?? undefined : undefined, rackUnits: d.rackUnits ?? 1,
        }, cfg.encryptionKey);
        idMap.set(d.id, row.id);
      }
      for (const l of file.links) {
        await store.links.create(db, { ...l, sourceId: idMap.get(l.sourceId)!, destId: idMap.get(l.destId)! });
      }
      return { devices: file.devices.length, links: file.links.length };
    });
    res.status(201).json(result);
  }));

  /* ------------------------------- revisions ------------------------------- */
  r.get('/clients/:id/revisions', auth, ah(async (req, res) => {
    await requireClient(pool, req, param(req, 'id'));
    res.json({ revisions: await store.revisions.list(pool, param(req, 'id')) });
  }));
  r.post('/clients/:id/revisions', auth, ah(async (req, res) => {
    await requireClient(pool, req, param(req, 'id'), 'write');
    const { note } = revisionCreateSchema.parse(req.body ?? {});
    res.status(201).json({ revision: await store.revisions.create(pool, param(req, 'id'), req.user!.id, note ?? '') });
  }));
  r.post('/revisions/:id/restore', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.revision(pool, param(req, 'id')), 'write');
    await tx(pool, (db) => store.revisions.restore(db, param(req, 'id'), req.user!.id));
    res.json({ success: true });
  }));

  /* --------------------------------- sites --------------------------------- */
  r.get('/sites', auth, ah(async (req, res) => {
    const clientId = q(req, 'clientId');
    if (clientId || req.user!.role !== 'admin') await requireClient(pool, req, clientId);
    res.json({ sites: await store.sites.list(pool, clientId) });
  }));
  r.post('/sites', auth, adminOnly, ah(async (req, res) => {
    const s = siteSchema.parse(req.body);
    res.status(201).json({ site: await store.sites.create(pool, s.clientId, s.name) });
  }));
  r.patch('/sites/:id', auth, adminOnly, ah(async (req, res) => {
    res.json({ site: await store.sites.rename(pool, param(req, 'id'), siteUpdateSchema.parse(req.body).name) });
  }));
  r.delete('/sites/:id', auth, adminOnly, ah(async (req, res) => {
    if (!(await store.sites.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Site not found');
    res.json({ success: true });
  }));

  /* -------------------------------- devices -------------------------------- */
  r.get('/devices', auth, ah(async (req, res) => {
    const clientId = q(req, 'clientId');
    const role = clientId || req.user!.role !== 'admin' ? await requireClient(pool, req, clientId) : 'admin';
    const rows = await store.devices.list(pool, clientId);
    res.json({ devices: rows.map((d) => store.mapDevice(d, role !== 'viewer')) });
  }));
  r.post('/devices', auth, ah(async (req, res) => {
    const body = deviceCreateSchema.parse(req.body);
    await requireClient(pool, req, body.clientId, 'write');
    const row = await store.devices.create(pool, body, cfg.encryptionKey);
    res.status(201).json({ device: store.mapDevice(row) });
  }));
  r.put('/devices/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.device(pool, param(req, 'id')), 'write');
    const row = await store.devices.update(pool, param(req, 'id'), deviceUpdateSchema.parse(req.body), cfg.encryptionKey);
    res.json({ device: store.mapDevice(row) });
  }));
  r.delete('/devices/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.device(pool, param(req, 'id')), 'write');
    if (!(await store.devices.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Device not found');
    res.json({ success: true });
  }));
  r.get('/devices/:id/credentials', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.device(pool, param(req, 'id')), 'write');
    // Who looked at which device password, and when (stdout → docker compose logs).
    console.log(`[audit] ${new Date().toISOString()} credentials revealed device=${param(req, 'id')} by user=${req.user!.id}`);
    res.json(await store.devices.credentials(pool, param(req, 'id'), cfg.encryptionKey));
  }));

  /* --------------------------------- links --------------------------------- */
  r.get('/links', auth, ah(async (req, res) => {
    const clientId = q(req, 'clientId'), deviceId = q(req, 'deviceId');
    if (deviceId) await requireClient(pool, req, await clientOf.device(pool, deviceId));
    else if (clientId || req.user!.role !== 'admin') await requireClient(pool, req, clientId);
    res.json({ links: await store.links.list(pool, { clientId, deviceId }) });
  }));
  r.post('/links', auth, ah(async (req, res) => {
    const body = linkCreateSchema.parse(req.body);
    await requireClient(pool, req, await clientOf.device(pool, body.sourceId), 'write');
    res.status(201).json({ link: await store.links.create(pool, body) });
  }));
  r.put('/links/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.link(pool, param(req, 'id')), 'write');
    res.json({ link: await store.links.update(pool, param(req, 'id'), linkUpdateSchema.parse(req.body)) });
  }));
  r.delete('/links/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.link(pool, param(req, 'id')), 'write');
    if (!(await store.links.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Link not found');
    res.json({ success: true });
  }));

  /* --------------------------------- racks --------------------------------- */
  r.post('/racks', auth, ah(async (req, res) => {
    const body = rackSchema.parse(req.body);
    await requireClient(pool, req, body.clientId, 'write');
    res.status(201).json({ rack: await store.racks.create(pool, body) });
  }));
  r.put('/racks/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.rack(pool, param(req, 'id')), 'write');
    res.json({ rack: await store.racks.update(pool, param(req, 'id'), rackUpdateSchema.parse(req.body)) });
  }));
  r.delete('/racks/:id', auth, ah(async (req, res) => {
    await requireClient(pool, req, await clientOf.rack(pool, param(req, 'id')), 'write');
    await store.racks.remove(pool, param(req, 'id'));
    res.json({ success: true });
  }));

  /* ---------------------------- validation & exports ---------------------------- */
  r.post('/validate', auth, ah(async (req, res) => {
    const { clientId } = validateSchema.parse(req.body);
    await requireClient(pool, req, clientId);
    const t = await store.loadTopology(pool, clientId, false);
    res.json({ alerts: validateTopology(t) });
  }));

  r.get('/export/csv', auth, ah(async (req, res) => {
    await requireClient(pool, req, q(req, 'clientId'));
    const t = await store.loadTopology(pool, String(req.query.clientId), false);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}-cabling.csv"`);
    res.send('﻿' + cablingMatrixCsv(t.devices, t.links));
  }));

  r.get('/export/pdf', auth, ah(async (req, res) => {
    await requireClient(pool, req, q(req, 'clientId'));
    const t = await store.loadTopology(pool, String(req.query.clientId), false);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}-cabling.pdf"`);
    writeCablingPdf(res, t.client, t.devices, t.links, validateTopology(t));
  }));

  r.get('/export/config', auth, ah(async (req, res) => {
    const vendor = String(req.query.vendor ?? 'cisco') as Vendor;
    if (!VENDORS.includes(vendor)) throw new HttpError(400, 'Unknown vendor');
    let clientId = req.query.clientId ? String(req.query.clientId) : '';
    const deviceId = req.query.deviceId ? String(req.query.deviceId) : '';
    if (deviceId) {
      const row = await store.devices.getRow(pool, deviceId);
      if (!row) throw new HttpError(404, 'Device not found');
      clientId = row.client_id;
    }
    if (!clientId) throw new HttpError(400, 'clientId or deviceId is required');
    await requireClient(pool, req, clientId);
    const t = await store.loadTopology(pool, clientId, false);
    const text = deviceId ? generateDeviceConfig(vendor, t.devices.find((d) => d.id === deviceId)!, t.devices, t.links) : generateClientConfig(vendor, t.devices, t.links);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}-${vendor}.txt"`);
    res.send(text);
  }));

  return r;
}
