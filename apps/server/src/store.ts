import type { Client, Device, DeviceType, Link, Revision, Site, User } from '@netforge/shared';
import type { Db } from './db';
import { decrypt, encrypt } from './crypto';
import { HttpError } from './errors';

type Row = Record<string, any>;
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/* ------------------------------- mappers ------------------------------- */
export const mapUser = (r: Row): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, createdAt: iso(r.created_at) });
export const mapClient = (r: Row): Client => ({ id: r.id, name: r.name, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
export const mapSite = (r: Row): Site => ({ id: r.id, clientId: r.client_id, name: r.name });
export const mapDevice = (r: Row, revealUsername = true): Device => ({
  id: r.id, clientId: r.client_id, siteId: r.site_id, name: r.name, type: r.type, model: r.model, serial: r.serial, role: r.role,
  mgmtIp: r.mgmt_ip, mgmtGateway: r.mgmt_gateway, mgmtPort: r.mgmt_port, mgmtProtocols: r.mgmt_protocols ?? [], mgmtVlan: r.mgmt_vlan,
  portCount: r.port_count, portPrefix: r.port_prefix, x: r.x, y: r.y,
  credentialsUsername: revealUsername ? r.cred_username : null,
  hasCredentials: r.cred_password_enc != null,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
export const mapLink = (r: Row): Link => ({
  id: r.id, clientId: r.client_id, sourceId: r.source_id, sourcePort: r.source_port, destId: r.dest_id, destPort: r.dest_port, mode: r.mode,
  nativeVlan: r.native_vlan, destNativeVlan: r.dest_native_vlan, taggedVlans: r.tagged_vlans ?? [], accessVlan: r.access_vlan,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

const notFound = (what: string) => new HttpError(404, `${what} not found`);

/* ------------------------------ users ------------------------------ */
export const users = {
  async list(db: Db) { return (await db.query('SELECT * FROM users ORDER BY created_at')).rows.map(mapUser); },
  async count(db: Db) { return Number((await db.query('SELECT count(*) FROM users')).rows[0].count); },
  async get(db: Db, id: string) { const r = (await db.query('SELECT * FROM users WHERE id=$1', [id])).rows[0]; return r ? mapUser(r) : null; },
  async getWithHash(db: Db, email: string) { return (await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()])).rows[0] as Row | undefined; },
  async hashOf(db: Db, id: string) { return (await db.query('SELECT password_hash FROM users WHERE id=$1', [id])).rows[0]?.password_hash as string | undefined; },
  async create(db: Db, u: { email: string; name: string; passwordHash: string; role: string }) {
    return mapUser((await db.query('INSERT INTO users (email,name,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING *', [u.email.toLowerCase(), u.name, u.passwordHash, u.role])).rows[0]);
  },
  async update(db: Db, id: string, u: { name?: string; passwordHash?: string; role?: string }) {
    const r = (await db.query('UPDATE users SET name=COALESCE($2,name), password_hash=COALESCE($3,password_hash), role=COALESCE($4,role) WHERE id=$1 RETURNING *', [id, u.name ?? null, u.passwordHash ?? null, u.role ?? null])).rows[0];
    if (!r) throw notFound('User');
    return mapUser(r);
  },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM users WHERE id=$1', [id])).rowCount! > 0; },
  async adminCount(db: Db) { return Number((await db.query("SELECT count(*) FROM users WHERE role='admin'")).rows[0].count); },
};

/* ----------------------------- clients ----------------------------- */
export const clients = {
  async list(db: Db) { return (await db.query('SELECT * FROM clients ORDER BY lower(name)')).rows.map(mapClient); },
  async get(db: Db, id: string) { const r = (await db.query('SELECT * FROM clients WHERE id=$1', [id])).rows[0]; return r ? mapClient(r) : null; },
  async create(db: Db, name: string) { return mapClient((await db.query('INSERT INTO clients (name) VALUES ($1) RETURNING *', [name])).rows[0]); },
  async rename(db: Db, id: string, name: string) {
    const r = (await db.query('UPDATE clients SET name=$2, updated_at=now() WHERE id=$1 RETURNING *', [id, name])).rows[0];
    if (!r) throw notFound('Client');
    return mapClient(r);
  },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM clients WHERE id=$1', [id])).rowCount! > 0; },
};

/* ------------------------------ sites ------------------------------ */
export const sites = {
  async list(db: Db, clientId?: string) {
    const r = clientId ? await db.query('SELECT * FROM sites WHERE client_id=$1 ORDER BY lower(name)', [clientId]) : await db.query('SELECT * FROM sites ORDER BY client_id, lower(name)');
    return r.rows.map(mapSite);
  },
  async get(db: Db, id: string) { const r = (await db.query('SELECT * FROM sites WHERE id=$1', [id])).rows[0]; return r ? mapSite(r) : null; },
  async create(db: Db, clientId: string, name: string) {
    if (!(await clients.get(db, clientId))) throw notFound('Client');
    return mapSite((await db.query('INSERT INTO sites (client_id,name) VALUES ($1,$2) RETURNING *', [clientId, name])).rows[0]);
  },
  async rename(db: Db, id: string, name: string) {
    const r = (await db.query('UPDATE sites SET name=$2 WHERE id=$1 RETURNING *', [id, name])).rows[0];
    if (!r) throw notFound('Site');
    return mapSite(r);
  },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM sites WHERE id=$1', [id])).rowCount! > 0; },
};

/* ----------------------------- devices ----------------------------- */
const TYPE_DEFAULTS: Record<DeviceType, { portCount: number; portPrefix: string }> = {
  switch: { portCount: 24, portPrefix: 'Gi1/0/' },
  firewall: { portCount: 8, portPrefix: 'eth' },
  router: { portCount: 4, portPrefix: 'Gi0/0/' },
  server: { portCount: 2, portPrefix: 'eth' },
  access_point: { portCount: 1, portPrefix: 'eth' },
  client: { portCount: 1, portPrefix: 'eth' },
};

const DEVICE_COLUMNS: Record<string, string> = {
  siteId: 'site_id', name: 'name', type: 'type', model: 'model', serial: 'serial', role: 'role', mgmtIp: 'mgmt_ip', mgmtGateway: 'mgmt_gateway',
  mgmtPort: 'mgmt_port', mgmtProtocols: 'mgmt_protocols', mgmtVlan: 'mgmt_vlan', portCount: 'port_count', portPrefix: 'port_prefix', x: 'x', y: 'y',
};

async function assertSiteInClient(db: Db, siteId: string | null | undefined, clientId: string) {
  if (!siteId) return;
  const s = await sites.get(db, siteId);
  if (!s || s.clientId !== clientId) throw new HttpError(400, 'Site does not belong to this client');
}

export const devices = {
  async list(db: Db, clientId?: string) {
    const r = clientId ? await db.query('SELECT * FROM devices WHERE client_id=$1 ORDER BY created_at, id', [clientId]) : await db.query('SELECT * FROM devices ORDER BY created_at, id');
    return r.rows;
  },
  async getRow(db: Db, id: string) { return (await db.query('SELECT * FROM devices WHERE id=$1', [id])).rows[0] as Row | undefined; },

  async create(db: Db, input: Record<string, any>, key: Buffer) {
    if (!(await clients.get(db, input.clientId))) throw notFound('Client');
    await assertSiteInClient(db, input.siteId, input.clientId);
    const d = TYPE_DEFAULTS[input.type as DeviceType];
    const cols: Record<string, unknown> = {
      client_id: input.clientId, site_id: input.siteId ?? null, name: input.name, type: input.type, model: input.model ?? null, serial: input.serial ?? null,
      role: input.role ?? null, mgmt_ip: input.mgmtIp ?? null, mgmt_gateway: input.mgmtGateway ?? null, mgmt_port: input.mgmtPort ?? null,
      mgmt_protocols: input.mgmtProtocols ?? [], mgmt_vlan: input.mgmtVlan ?? null, port_count: input.portCount ?? d.portCount, port_prefix: input.portPrefix ?? d.portPrefix,
      x: input.x ?? 0, y: input.y ?? 0, cred_username: input.mgmtUsername ?? null,
      cred_password_enc: input.mgmtPassword ? encrypt(input.mgmtPassword, key) : null,
    };
    const names = Object.keys(cols);
    const r = await db.query(`INSERT INTO devices (${names.join(',')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(cols));
    return r.rows[0] as Row;
  },

  async update(db: Db, id: string, input: Record<string, any>, key: Buffer) {
    const existing = await devices.getRow(db, id);
    if (!existing) throw notFound('Device');
    if ('siteId' in input) await assertSiteInClient(db, input.siteId, existing.client_id);
    const sets: string[] = [];
    const vals: unknown[] = [id];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    for (const [k, col] of Object.entries(DEVICE_COLUMNS)) if (k in input && input[k] !== undefined) add(col, input[k] === '' ? null : input[k]);
    if ('mgmtUsername' in input && input.mgmtUsername !== undefined) add('cred_username', input.mgmtUsername || null);
    // password: undefined keeps the stored one, null/'' clears it, a string replaces it.
    if ('mgmtPassword' in input && input.mgmtPassword !== undefined) add('cred_password_enc', input.mgmtPassword ? encrypt(input.mgmtPassword, key) : null);
    if (!sets.length) return existing;
    const r = await db.query(`UPDATE devices SET ${sets.join(',')}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return r.rows[0] as Row;
  },

  async remove(db: Db, id: string) { return (await db.query('DELETE FROM devices WHERE id=$1', [id])).rowCount! > 0; },

  async credentials(db: Db, id: string, key: Buffer) {
    const r = await devices.getRow(db, id);
    if (!r) throw notFound('Device');
    return { username: r.cred_username as string | null, password: r.cred_password_enc ? decrypt(r.cred_password_enc, key) : null };
  },
};

/* ------------------------------ links ------------------------------ */
function normalizeLink(l: Record<string, any>) {
  const mode = l.mode as 'access' | 'trunk';
  const tagged = [...new Set<number>(l.taggedVlans ?? [])].sort((a, b) => a - b);
  return mode === 'access'
    ? { mode, nativeVlan: null, destNativeVlan: null, taggedVlans: [] as number[], accessVlan: l.accessVlan ?? null }
    : { mode, nativeVlan: l.nativeVlan ?? null, destNativeVlan: l.destNativeVlan ?? null, taggedVlans: tagged, accessVlan: null };
}

async function endpoints(db: Db, sourceId: string, destId: string) {
  const s = await devices.getRow(db, sourceId);
  const d = await devices.getRow(db, destId);
  if (!s || !d) throw new HttpError(400, 'Source or destination device does not exist');
  if (s.client_id !== d.client_id) throw new HttpError(400, 'Both devices must belong to the same client');
  return s.client_id as string;
}

export const links = {
  async list(db: Db, q: { clientId?: string; deviceId?: string }) {
    if (q.deviceId) return (await db.query('SELECT * FROM links WHERE source_id=$1 OR dest_id=$1 ORDER BY created_at, id', [q.deviceId])).rows.map(mapLink);
    if (q.clientId) return (await db.query('SELECT * FROM links WHERE client_id=$1 ORDER BY created_at, id', [q.clientId])).rows.map(mapLink);
    return (await db.query('SELECT * FROM links ORDER BY created_at, id')).rows.map(mapLink);
  },
  async get(db: Db, id: string) { const r = (await db.query('SELECT * FROM links WHERE id=$1', [id])).rows[0]; return r ? mapLink(r) : null; },
  async create(db: Db, input: Record<string, any>) {
    const clientId = await endpoints(db, input.sourceId, input.destId);
    const n = normalizeLink(input);
    const r = await db.query(
      `INSERT INTO links (client_id,source_id,source_port,dest_id,dest_port,mode,native_vlan,dest_native_vlan,tagged_vlans,access_vlan) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [clientId, input.sourceId, input.sourcePort, input.destId, input.destPort, n.mode, n.nativeVlan, n.destNativeVlan, n.taggedVlans, n.accessVlan],
    );
    return mapLink(r.rows[0]);
  },
  async update(db: Db, id: string, input: Record<string, any>) {
    const existing = await links.get(db, id);
    if (!existing) throw notFound('Link');
    // Merge with the stored link so partial updates stay consistent.
    const merged = { ...existing, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
    const clientId = await endpoints(db, merged.sourceId, merged.destId);
    if (clientId !== existing.clientId) throw new HttpError(400, 'A link cannot move to another client');
    const n = normalizeLink(merged);
    const r = await db.query(
      `UPDATE links SET source_id=$2,source_port=$3,dest_id=$4,dest_port=$5,mode=$6,native_vlan=$7,dest_native_vlan=$8,tagged_vlans=$9,access_vlan=$10,updated_at=now() WHERE id=$1 RETURNING *`,
      [id, merged.sourceId, merged.sourcePort, merged.destId, merged.destPort, n.mode, n.nativeVlan, n.destNativeVlan, n.taggedVlans, n.accessVlan],
    );
    return mapLink(r.rows[0]);
  },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM links WHERE id=$1', [id])).rowCount! > 0; },
};

/* ----------------------------- topology ----------------------------- */
export async function loadTopology(db: Db, clientId: string, revealUsername: boolean) {
  const client = await clients.get(db, clientId);
  if (!client) throw notFound('Client');
  // Sequential on purpose: `db` may be a single transaction connection, which cannot run queries in parallel.
  const s = await sites.list(db, clientId);
  const d = await devices.list(db, clientId);
  const l = await links.list(db, { clientId });
  return { client, sites: s, devices: d.map((r) => mapDevice(r, revealUsername)), links: l };
}

/* ---------------------------- revisions ---------------------------- */
export interface Snapshot {
  sites: Site[];
  devices: Array<Omit<Device, 'credentialsUsername' | 'hasCredentials'>>;
  links: Link[];
}

const mapRevision = (r: Row): Revision => ({ id: r.id, clientId: r.client_id, authorId: r.author_id, authorName: r.author_name ?? null, note: r.note, createdAt: iso(r.created_at) });

export const revisions = {
  async list(db: Db, clientId: string) {
    const r = await db.query('SELECT r.id,r.client_id,r.author_id,r.note,r.created_at,u.name AS author_name FROM revisions r LEFT JOIN users u ON u.id=r.author_id WHERE r.client_id=$1 ORDER BY r.created_at DESC LIMIT 100', [clientId]);
    return r.rows.map(mapRevision);
  },
  async create(db: Db, clientId: string, authorId: string | null, note: string) {
    const t = await loadTopology(db, clientId, false);
    const snapshot: Snapshot = {
      sites: t.sites,
      devices: t.devices.map(({ credentialsUsername: _u, hasCredentials: _h, ...d }) => d),
      links: t.links,
    };
    const r = await db.query('INSERT INTO revisions (client_id,author_id,note,snapshot) VALUES ($1,$2,$3,$4) RETURNING *', [clientId, authorId, note, JSON.stringify(snapshot)]);
    return mapRevision(r.rows[0]);
  },
  async getRaw(db: Db, id: string) { return (await db.query('SELECT * FROM revisions WHERE id=$1', [id])).rows[0] as Row | undefined; },

  /** Replaces the client's schema by a snapshot. Stored credentials of devices that still exist are preserved. */
  async restore(db: Db, id: string, authorId: string | null) {
    const rev = await revisions.getRaw(db, id);
    if (!rev) throw notFound('Revision');
    const clientId = rev.client_id as string;
    const snap = rev.snapshot as Snapshot;
    await revisions.create(db, clientId, authorId, 'Automatic backup before restore');
    const creds = new Map<string, { u: string | null; p: string | null }>(
      (await db.query('SELECT id,cred_username,cred_password_enc FROM devices WHERE client_id=$1', [clientId])).rows.map((r) => [r.id, { u: r.cred_username, p: r.cred_password_enc }]),
    );
    await db.query('DELETE FROM links WHERE client_id=$1', [clientId]);
    await db.query('DELETE FROM devices WHERE client_id=$1', [clientId]);
    await db.query('DELETE FROM sites WHERE client_id=$1', [clientId]);
    for (const s of snap.sites) await db.query('INSERT INTO sites (id,client_id,name) VALUES ($1,$2,$3)', [s.id, clientId, s.name]);
    for (const d of snap.devices) {
      const c = creds.get(d.id);
      await db.query(
        `INSERT INTO devices (id,client_id,site_id,name,type,model,serial,role,mgmt_ip,mgmt_gateway,mgmt_port,mgmt_protocols,mgmt_vlan,port_count,port_prefix,x,y,cred_username,cred_password_enc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [d.id, clientId, d.siteId, d.name, d.type, d.model, d.serial, d.role, d.mgmtIp, d.mgmtGateway, d.mgmtPort, d.mgmtProtocols, d.mgmtVlan, d.portCount, d.portPrefix, d.x, d.y, c?.u ?? null, c?.p ?? null],
      );
    }
    for (const l of snap.links) {
      await db.query(
        `INSERT INTO links (id,client_id,source_id,source_port,dest_id,dest_port,mode,native_vlan,dest_native_vlan,tagged_vlans,access_vlan) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [l.id, clientId, l.sourceId, l.sourcePort, l.destId, l.destPort, l.mode, l.nativeVlan, l.destNativeVlan, l.taggedVlans, l.accessVlan],
      );
    }
    return clientId;
  },
};
