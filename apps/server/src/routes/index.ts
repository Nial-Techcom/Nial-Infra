import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import {
  buildShmnlt, cablingMatrixCsv, changePasswordSchema, clientSchema, deviceCreateSchema, deviceUpdateSchema, generateClientConfig,
  generateDeviceConfig, linkCreateSchema, linkUpdateSchema, loginSchema, parseIpCidr, revisionCreateSchema, shmnltSchema, siteSchema,
  siteUpdateSchema, userCreateSchema, userUpdateSchema, validateSchema, validateTopology, VENDORS, type Vendor,
} from '@netforge/shared';
import type { Config } from '../config';
import { adminOnly, authenticate, canWrite, signToken } from '../auth';
import { tx } from '../db';
import { ah, HttpError } from '../errors';
import { writeCablingPdf } from '../pdf';
import * as store from '../store';

const DUMMY_HASH = bcrypt.hashSync('netforge-timing-equalizer', 4);
const param = (req: Request, name: string) => String(req.params[name]);
const safeFile = (s: string) => s.replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60) || 'netforge';
const seesUsername = (req: Request) => req.user?.role !== 'viewer';

export function buildRouter(pool: Pool, cfg: Config): Router {
  const r = Router();
  const auth = authenticate(pool, cfg);
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: cfg.loginRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later' } });

  r.get('/health', ah(async (_req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }));

  /* ---------------------------------- auth ---------------------------------- */
  r.post('/auth/login', loginLimiter, ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const row = await store.users.getWithHash(pool, email);
    const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'Invalid email or password');
    const user = store.mapUser(row);
    res.json({ token: signToken(user, cfg), user });
  }));
  r.get('/auth/me', auth, (req, res) => { res.json({ user: req.user }); });
  r.post('/auth/change-password', auth, ah(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const hash = await store.users.hashOf(pool, req.user!.id);
    if (!hash || !(await bcrypt.compare(currentPassword, hash))) throw new HttpError(400, 'Current password is incorrect');
    await store.users.update(pool, req.user!.id, { passwordHash: await bcrypt.hash(newPassword, cfg.bcryptRounds) });
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
  r.get('/clients', auth, ah(async (_req, res) => { res.json({ clients: await store.clients.list(pool) }); }));
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
  r.get('/clients/:id/topology', auth, ah(async (req, res) => { res.json(await store.loadTopology(pool, param(req, 'id'), seesUsername(req))); }));

  r.get('/clients/:id/export', auth, ah(async (req, res) => {
    const t = await store.loadTopology(pool, param(req, 'id'), false);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}.shmnlt"`);
    res.json(buildShmnlt(t.client.name, t.sites, t.devices, t.links));
  }));

  r.post('/clients/:id/import', auth, canWrite, ah(async (req, res) => {
    const clientId = param(req, 'id');
    const file = shmnltSchema.parse(req.body);
    const ids = new Set(file.devices.map((d) => d.id));
    if (file.links.some((l) => !ids.has(l.sourceId) || !ids.has(l.destId))) throw new HttpError(400, 'A link refers to an unknown device');
    const result = await tx(pool, async (db) => {
      if (!(await store.clients.get(db, clientId))) throw new HttpError(404, 'Client not found');
      const siteByName = new Map((await store.sites.list(db, clientId)).map((s) => [s.name, s.id]));
      const fileSite = new Map(file.sites.map((s) => [s.id, s.name]));
      const idMap = new Map<string, string>();
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
    if (!(await store.clients.get(pool, param(req, 'id')))) throw new HttpError(404, 'Client not found');
    res.json({ revisions: await store.revisions.list(pool, param(req, 'id')) });
  }));
  r.post('/clients/:id/revisions', auth, canWrite, ah(async (req, res) => {
    const { note } = revisionCreateSchema.parse(req.body ?? {});
    res.status(201).json({ revision: await store.revisions.create(pool, param(req, 'id'), req.user!.id, note ?? '') });
  }));
  r.post('/revisions/:id/restore', auth, canWrite, ah(async (req, res) => {
    await tx(pool, (db) => store.revisions.restore(db, param(req, 'id'), req.user!.id));
    res.json({ success: true });
  }));

  /* --------------------------------- sites --------------------------------- */
  r.get('/sites', auth, ah(async (req, res) => { res.json({ sites: await store.sites.list(pool, req.query.clientId ? String(req.query.clientId) : undefined) }); }));
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
    const rows = await store.devices.list(pool, req.query.clientId ? String(req.query.clientId) : undefined);
    res.json({ devices: rows.map((d) => store.mapDevice(d, seesUsername(req))) });
  }));
  r.post('/devices', auth, canWrite, ah(async (req, res) => {
    const row = await store.devices.create(pool, deviceCreateSchema.parse(req.body), cfg.encryptionKey);
    res.status(201).json({ device: store.mapDevice(row) });
  }));
  r.put('/devices/:id', auth, canWrite, ah(async (req, res) => {
    const row = await store.devices.update(pool, param(req, 'id'), deviceUpdateSchema.parse(req.body), cfg.encryptionKey);
    res.json({ device: store.mapDevice(row) });
  }));
  r.delete('/devices/:id', auth, canWrite, ah(async (req, res) => {
    if (!(await store.devices.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Device not found');
    res.json({ success: true });
  }));
  r.get('/devices/:id/credentials', auth, canWrite, ah(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await store.devices.credentials(pool, param(req, 'id'), cfg.encryptionKey));
  }));

  /* --------------------------------- links --------------------------------- */
  r.get('/links', auth, ah(async (req, res) => {
    res.json({ links: await store.links.list(pool, { clientId: req.query.clientId ? String(req.query.clientId) : undefined, deviceId: req.query.deviceId ? String(req.query.deviceId) : undefined }) });
  }));
  r.post('/links', auth, canWrite, ah(async (req, res) => { res.status(201).json({ link: await store.links.create(pool, linkCreateSchema.parse(req.body)) }); }));
  r.put('/links/:id', auth, canWrite, ah(async (req, res) => { res.json({ link: await store.links.update(pool, param(req, 'id'), linkUpdateSchema.parse(req.body)) }); }));
  r.delete('/links/:id', auth, canWrite, ah(async (req, res) => {
    if (!(await store.links.remove(pool, param(req, 'id')))) throw new HttpError(404, 'Link not found');
    res.json({ success: true });
  }));

  /* ---------------------------- validation & exports ---------------------------- */
  r.post('/validate', auth, ah(async (req, res) => {
    const { clientId } = validateSchema.parse(req.body);
    const t = await store.loadTopology(pool, clientId, false);
    res.json({ alerts: validateTopology(t) });
  }));

  r.get('/export/csv', auth, ah(async (req, res) => {
    const t = await store.loadTopology(pool, String(req.query.clientId ?? ''), false);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}-cabling.csv"`);
    res.send('﻿' + cablingMatrixCsv(t.devices, t.links));
  }));

  r.get('/export/pdf', auth, ah(async (req, res) => {
    const t = await store.loadTopology(pool, String(req.query.clientId ?? ''), false);
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
    const t = await store.loadTopology(pool, clientId, false);
    const text = deviceId ? generateDeviceConfig(vendor, t.devices.find((d) => d.id === deviceId)!, t.devices, t.links) : generateClientConfig(vendor, t.devices, t.links);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile(t.client.name)}-${vendor}.txt"`);
    res.send(text);
  }));

  return r;
}
