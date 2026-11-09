import { canPlace, firstFreePos, type Client, type Device, type DeviceType, type Invitation, type LibraryItem, type Link, type Member, type MemberRole, type Rack, type Revision, type Role, type Site, type User } from '@netforge/shared';
import { createHash, randomBytes } from 'node:crypto';
import { tx, type Db } from './db';
import { decrypt, encrypt } from './crypto';
import { HttpError } from './errors';

type Row = Record<string, any>;
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

/* ------------------------------- mappers ------------------------------- */
export const mapUser = (r: Row): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, createdAt: iso(r.created_at) });
export const mapClient = (r: Row): Client => ({ id: r.id, name: r.name, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
export const mapRack = (r: Row): Rack => ({ id: r.id, clientId: r.client_id, siteId: r.site_id, name: r.name, units: r.units });
export const mapSite = (r: Row): Site => ({ id: r.id, clientId: r.client_id, name: r.name });
export const mapDevice = (r: Row, revealUsername = true): Device => ({
  id: r.id, clientId: r.client_id, siteId: r.site_id, name: r.name, type: r.type, model: r.model, serial: r.serial, role: r.role,
  mgmtIp: r.mgmt_ip, mgmtGateway: r.mgmt_gateway, mgmtPort: r.mgmt_port, mgmtProtocols: r.mgmt_protocols ?? [], mgmtVlan: r.mgmt_vlan,
  portCount: r.port_count, portPrefix: r.port_prefix,
  rackId: r.rack_id ?? null, rackPos: r.rack_id ? r.rack_pos ?? null : null, rackUnits: r.rack_units ?? 1, x: r.x, y: r.y,
  credentialsUsername: revealUsername ? r.cred_username : null,
  hasCredentials: r.cred_password_enc != null,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
export const mapLink = (r: Row): Link => ({
  id: r.id, clientId: r.client_id, sourceId: r.source_id, sourcePort: r.source_port, destId: r.dest_id, destPort: r.dest_port, mode: r.mode, medium: r.medium ?? 'ethernet',
  nativeVlan: r.native_vlan, destNativeVlan: r.dest_native_vlan, taggedVlans: r.tagged_vlans ?? [], accessVlan: r.access_vlan,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

const notFound = (what: string) => new HttpError(404, `${what} not found`);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** Random URL-safe secret; only its SHA-256 is stored, so a database leak does not leak usable links. */
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = sha256;
/** Runs fn in a transaction unless db already is one. */
const inTx = <T>(db: Db, fn: (d: Db) => Promise<T>): Promise<T> => ('connect' in db && typeof (db as any).connect === 'function' && !('release' in db) ? tx(db as any, fn) : fn(db));

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
  async setPassword(db: Db, id: string, passwordHash: string, invalidateTokens: boolean) {
    await db.query('UPDATE users SET password_hash=$2, password_changed_at=CASE WHEN $3 THEN now() ELSE password_changed_at END WHERE id=$1', [id, passwordHash, invalidateTokens]);
  },
  async getAuth(db: Db, id: string) {
    const r = (await db.query('SELECT * FROM users WHERE id=$1', [id])).rows[0];
    return r ? { user: mapUser(r), passwordChangedAt: r.password_changed_at ? new Date(r.password_changed_at).getTime() : 0 } : null;
  },
  async adminCount(db: Db) { return Number((await db.query("SELECT count(*) FROM users WHERE role='admin'")).rows[0].count); },
};

/* ----------------------------- clients ----------------------------- */
export const clients = {
  async list(db: Db) { return (await db.query('SELECT * FROM clients ORDER BY lower(name)')).rows.map(mapClient); },
  /** Clients the user can open, each with the user's effective role. Global admins see everything. */
  async listFor(db: Db, user: User): Promise<Client[]> {
    if (user.role === 'admin') return (await db.query('SELECT * FROM clients ORDER BY lower(name)')).rows.map((r) => ({ ...mapClient(r), myRole: 'admin' as Role }));
    const r = await db.query('SELECT c.*, m.role AS my_role FROM clients c JOIN client_members m ON m.client_id=c.id WHERE m.user_id=$1 ORDER BY lower(c.name)', [user.id]);
    return r.rows.map((x) => ({ ...mapClient(x), myRole: x.my_role as Role }));
  },
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
const RACK_KEYS = ['rackId', 'rackPos', 'rackUnits'];

async function assertSiteInClient(db: Db, siteId: string | null | undefined, clientId: string) {
  if (!siteId) return;
  const s = await sites.get(db, siteId);
  if (!s || s.clientId !== clientId) throw new HttpError(400, 'Site does not belong to this client');
}

/** Checks that a rack placement is legal and returns the final {rack_id, rack_pos}. Locks the rack row to avoid double-booking. */
async function resolvePlacement(db: Db, clientId: string, deviceId: string | null, rackId: string | null, pos: number | null | undefined, units: number) {
  if (!rackId) return { rack_id: null as string | null, rack_pos: null as number | null };
  const rack = (await db.query('SELECT * FROM racks WHERE id=$1 FOR UPDATE', [rackId])).rows[0];
  if (!rack || rack.client_id !== clientId) throw new HttpError(400, 'Rack does not belong to this client');
  const others = (await db.query('SELECT id, rack_id, rack_pos, rack_units FROM devices WHERE rack_id=$1', [rackId])).rows
    .map((r) => ({ id: r.id as string, rackId: r.rack_id as string, rackPos: r.rack_pos as number | null, rackUnits: r.rack_units as number }));
  const finalPos = pos ?? firstFreePos(mapRack(rack), others, deviceId ?? '', units);
  if (finalPos == null) throw new HttpError(409, 'No room left in this rack');
  if (!canPlace(mapRack(rack), others, deviceId ?? '', finalPos, units)) throw new HttpError(409, 'That rack position is taken or out of range');
  return { rack_id: rackId, rack_pos: finalPos };
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
    return inTx(db, async (q) => {
    const units = input.rackUnits ?? 1;
    const place = await resolvePlacement(q, input.clientId, null, input.rackId ?? null, input.rackPos, units);
    const cols: Record<string, unknown> = {
      rack_id: place.rack_id, rack_pos: place.rack_pos, rack_units: units,
      client_id: input.clientId, site_id: input.siteId ?? null, name: input.name, type: input.type, model: input.model ?? null, serial: input.serial ?? null,
      role: input.role ?? null, mgmt_ip: input.mgmtIp ?? null, mgmt_gateway: input.mgmtGateway ?? null, mgmt_port: input.mgmtPort ?? null,
      mgmt_protocols: input.mgmtProtocols ?? [], mgmt_vlan: input.mgmtVlan ?? null, port_count: input.portCount ?? d.portCount, port_prefix: input.portPrefix ?? d.portPrefix,
      x: input.x ?? 0, y: input.y ?? 0, cred_username: input.mgmtUsername ?? null,
      cred_password_enc: input.mgmtPassword ? encrypt(input.mgmtPassword, key) : null,
    };
    const names = Object.keys(cols);
    const r = await q.query(`INSERT INTO devices (${names.join(',')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, Object.values(cols));
    return r.rows[0] as Row;
    });
  },

  async update(db: Db, id: string, input: Record<string, any>, key: Buffer) {
    return inTx(db, async (q) => {
    const existing = await devices.getRow(q, id);
    if (!existing) throw notFound('Device');
    if ('siteId' in input) await assertSiteInClient(q, input.siteId, existing.client_id);
    const sets: string[] = [];
    const vals: unknown[] = [id];
    const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
    for (const [k, col] of Object.entries(DEVICE_COLUMNS)) if (k in input && input[k] !== undefined) add(col, input[k] === '' ? null : input[k]);
    if (RACK_KEYS.some((k) => k in input && input[k] !== undefined)) {
      const rackId: string | null = 'rackId' in input && input.rackId !== undefined ? input.rackId : existing.rack_id;
      const units: number = input.rackUnits ?? existing.rack_units;
      // Moving to another rack without a position = first free slot; staying in the same rack keeps the position unless one is given.
      const keepPos = rackId === existing.rack_id ? existing.rack_pos : null;
      const pos = 'rackPos' in input && input.rackPos !== undefined ? input.rackPos : keepPos;
      const place = await resolvePlacement(q, existing.client_id, id, rackId, pos, units);
      add('rack_id', place.rack_id); add('rack_pos', place.rack_pos); add('rack_units', units);
    }
    if ('mgmtUsername' in input && input.mgmtUsername !== undefined) add('cred_username', input.mgmtUsername || null);
    // password: undefined keeps the stored one, null/'' clears it, a string replaces it.
    if ('mgmtPassword' in input && input.mgmtPassword !== undefined) add('cred_password_enc', input.mgmtPassword ? encrypt(input.mgmtPassword, key) : null);
    if (!sets.length) return existing;
    const r = await q.query(`UPDATE devices SET ${sets.join(',')}, updated_at=now() WHERE id=$1 RETURNING *`, vals);
    return r.rows[0] as Row;
    });
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
const mediumOf = (l: Record<string, any>) => (l.medium === 'fiber' ? 'fiber' : 'ethernet');

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
      `INSERT INTO links (client_id,source_id,source_port,dest_id,dest_port,mode,native_vlan,dest_native_vlan,tagged_vlans,access_vlan,medium) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [clientId, input.sourceId, input.sourcePort, input.destId, input.destPort, n.mode, n.nativeVlan, n.destNativeVlan, n.taggedVlans, n.accessVlan, mediumOf(input)],
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
      `UPDATE links SET source_id=$2,source_port=$3,dest_id=$4,dest_port=$5,mode=$6,native_vlan=$7,dest_native_vlan=$8,tagged_vlans=$9,access_vlan=$10,medium=$11,updated_at=now() WHERE id=$1 RETURNING *`,
      [id, merged.sourceId, merged.sourcePort, merged.destId, merged.destPort, n.mode, n.nativeVlan, n.destNativeVlan, n.taggedVlans, n.accessVlan, mediumOf(merged)],
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
  const rk = await racks.list(db, clientId);
  const d = await devices.list(db, clientId);
  const l = await links.list(db, { clientId });
  return { client, sites: s, racks: rk, devices: d.map((r) => mapDevice(r, revealUsername)), links: l };
}

/* ---------------------------- revisions ---------------------------- */
export interface Snapshot {
  sites: Site[];
  racks?: Rack[];
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
      racks: t.racks,
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
    await db.query('DELETE FROM racks WHERE client_id=$1', [clientId]);
    await db.query('DELETE FROM sites WHERE client_id=$1', [clientId]);
    for (const s of snap.sites) await db.query('INSERT INTO sites (id,client_id,name) VALUES ($1,$2,$3)', [s.id, clientId, s.name]);
    for (const rk of snap.racks ?? []) await db.query('INSERT INTO racks (id,client_id,site_id,name,units) VALUES ($1,$2,$3,$4,$5)', [rk.id, clientId, rk.siteId, rk.name, rk.units]);
    for (const d of snap.devices) {
      const c = creds.get(d.id);
      await db.query(
        `INSERT INTO devices (id,client_id,site_id,name,type,model,serial,role,mgmt_ip,mgmt_gateway,mgmt_port,mgmt_protocols,mgmt_vlan,port_count,port_prefix,x,y,cred_username,cred_password_enc,rack_id,rack_pos,rack_units)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [d.id, clientId, d.siteId, d.name, d.type, d.model, d.serial, d.role, d.mgmtIp, d.mgmtGateway, d.mgmtPort, d.mgmtProtocols, d.mgmtVlan, d.portCount, d.portPrefix, d.x, d.y, c?.u ?? null, c?.p ?? null, d.rackId ?? null, d.rackId ? d.rackPos ?? null : null, d.rackUnits ?? 1],
      );
    }
    for (const l of snap.links) {
      await db.query(
        `INSERT INTO links (id,client_id,source_id,source_port,dest_id,dest_port,mode,native_vlan,dest_native_vlan,tagged_vlans,access_vlan,medium) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [l.id, clientId, l.sourceId, l.sourcePort, l.destId, l.destPort, l.mode, l.nativeVlan, l.destNativeVlan, l.taggedVlans, l.accessVlan, l.medium ?? 'ethernet'],
      );
    }
    return clientId;
  },
};

/* ------------------------------- racks ------------------------------- */
export const racks = {
  async list(db: Db, clientId: string) { return (await db.query('SELECT * FROM racks WHERE client_id=$1 ORDER BY lower(name)', [clientId])).rows.map(mapRack); },
  async get(db: Db, id: string) { const r = (await db.query('SELECT * FROM racks WHERE id=$1', [id])).rows[0]; return r ? mapRack(r) : null; },
  async create(db: Db, i: { clientId: string; siteId?: string | null; name: string; units?: number }) {
    if (!(await clients.get(db, i.clientId))) throw notFound('Client');
    await assertSiteInClient(db, i.siteId, i.clientId);
    return mapRack((await db.query('INSERT INTO racks (client_id,site_id,name,units) VALUES ($1,$2,$3,$4) RETURNING *', [i.clientId, i.siteId ?? null, i.name, i.units ?? 42])).rows[0]);
  },
  async update(db: Db, id: string, i: { siteId?: string | null; name?: string; units?: number }) {
    const ex = await racks.get(db, id);
    if (!ex) throw notFound('Rack');
    if (i.siteId !== undefined) await assertSiteInClient(db, i.siteId, ex.clientId);
    if (i.units !== undefined) {
      const top = Number((await db.query('SELECT COALESCE(max(rack_pos + rack_units - 1),0) AS top FROM devices WHERE rack_id=$1', [id])).rows[0].top);
      if (i.units < top) throw new HttpError(409, `Devices are mounted up to U${top}; move them before shrinking the rack`);
    }
    const r = await db.query('UPDATE racks SET name=COALESCE($2,name), units=COALESCE($3,units), site_id=CASE WHEN $4 THEN $5 ELSE site_id END WHERE id=$1 RETURNING *',
      [id, i.name ?? null, i.units ?? null, i.siteId !== undefined, i.siteId ?? null]);
    return mapRack(r.rows[0]);
  },
  async remove(db: Db, id: string) {
    await db.query('UPDATE devices SET rack_id=NULL, rack_pos=NULL WHERE rack_id=$1', [id]);
    return (await db.query('DELETE FROM racks WHERE id=$1', [id])).rowCount! > 0;
  },
};

/* ------------------------- members & invitations ------------------------- */
const INVITE_DAYS = 7;
const mapInvitation = (r: Row): Invitation => ({ id: r.id, clientId: r.client_id, clientName: r.client_name, email: r.email, role: r.role, createdAt: iso(r.created_at), expiresAt: iso(r.expires_at) });

export const members = {
  async list(db: Db, clientId: string): Promise<Member[]> {
    const r = await db.query('SELECT u.id AS user_id,u.email,u.name,m.role FROM client_members m JOIN users u ON u.id=m.user_id WHERE m.client_id=$1 ORDER BY lower(u.name)', [clientId]);
    return r.rows.map((x) => ({ userId: x.user_id, email: x.email, name: x.name, role: x.role }));
  },
  async roleOf(db: Db, clientId: string, userId: string): Promise<MemberRole | null> {
    return ((await db.query('SELECT role FROM client_members WHERE client_id=$1 AND user_id=$2', [clientId, userId])).rows[0]?.role as MemberRole | undefined) ?? null;
  },
  async set(db: Db, clientId: string, userId: string, role: MemberRole) {
    await db.query('INSERT INTO client_members (client_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT (client_id,user_id) DO UPDATE SET role=EXCLUDED.role', [clientId, userId, role]);
  },
  async remove(db: Db, clientId: string, userId: string) { return (await db.query('DELETE FROM client_members WHERE client_id=$1 AND user_id=$2', [clientId, userId])).rowCount! > 0; },
};

export const invitations = {
  async listPending(db: Db, clientId: string) {
    return (await db.query('SELECT i.*, c.name AS client_name FROM invitations i JOIN clients c ON c.id=i.client_id WHERE i.client_id=$1 AND i.accepted_at IS NULL AND i.expires_at>now() ORDER BY i.created_at DESC', [clientId])).rows.map(mapInvitation);
  },
  /** Creates an invitation (replacing a pending one for the same address) and returns it with the one-time token. */
  async create(db: Db, clientId: string, email: string, role: MemberRole, invitedBy: string) {
    await db.query('DELETE FROM invitations WHERE client_id=$1 AND email=$2 AND accepted_at IS NULL', [clientId, email]);
    const token = newToken();
    const r = await db.query(
      `INSERT INTO invitations (client_id,email,role,token_hash,invited_by,expires_at) VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' days')::interval) RETURNING *, (SELECT name FROM clients WHERE id=$1) AS client_name`,
      [clientId, email, role, sha256(token), invitedBy, String(INVITE_DAYS)],
    );
    return { invitation: mapInvitation(r.rows[0]), token };
  },
  async findValid(db: Db, token: string) {
    const r = (await db.query('SELECT i.*, c.name AS client_name FROM invitations i JOIN clients c ON c.id=i.client_id WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.expires_at>now()', [sha256(token)])).rows[0];
    return r ? mapInvitation(r) : null;
  },
  async get(db: Db, id: string) { const r = (await db.query('SELECT i.*, c.name AS client_name FROM invitations i JOIN clients c ON c.id=i.client_id WHERE i.id=$1', [id])).rows[0]; return r ? mapInvitation(r) : null; },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM invitations WHERE id=$1', [id])).rowCount! > 0; },
  /** Turns a valid invitation into a membership. Never downgrades an existing member who already has a higher role. */
  async accept(db: Db, inv: Invitation, userId: string) {
    const current = await members.roleOf(db, inv.clientId, userId);
    if (current !== 'technician') await members.set(db, inv.clientId, userId, inv.role);
    await db.query('UPDATE invitations SET accepted_at=now() WHERE id=$1', [inv.id]);
  },
};

/* --------------------------- password resets --------------------------- */
export const passwordResets = {
  async create(db: Db, userId: string) {
    await db.query('DELETE FROM password_resets WHERE user_id=$1 AND used_at IS NULL', [userId]);
    const token = newToken();
    await db.query("INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES ($1,$2, now() + interval '1 hour')", [userId, sha256(token)]);
    return token;
  },
  /** Atomically consumes a valid token and returns the user id (null if unknown, used or expired). */
  async consume(db: Db, token: string): Promise<string | null> {
    const r = await db.query('UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id', [sha256(token)]);
    return (r.rows[0]?.user_id as string | undefined) ?? null;
  },
};

/* ------------------------------ settings ------------------------------ */
export interface StoredSmtp { host: string; port: number; secure: boolean; user: string; from: string; passwordEnc: string | null }
export interface StoredSettings { publicUrl: string; allowRegistration: boolean; smtp: StoredSmtp }
const DEFAULT_SETTINGS: StoredSettings = { publicUrl: '', allowRegistration: true, smtp: { host: '', port: 587, secure: false, user: '', from: '', passwordEnc: null } };

export const settings = {
  async get(db: Db): Promise<StoredSettings> {
    const rows = (await db.query('SELECT key,value FROM app_settings')).rows;
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...(m.general ?? {}), smtp: { ...DEFAULT_SETTINGS.smtp, ...(m.smtp ?? {}) } };
  },
  async save(db: Db, s: StoredSettings) {
    const put = (k: string, v: unknown) => db.query('INSERT INTO app_settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, JSON.stringify(v)]);
    await put('general', { publicUrl: s.publicUrl, allowRegistration: s.allowRegistration });
    await put('smtp', s.smtp);
  },
};

/* ------------------------------- library ------------------------------- */
const mapLibrary = (r: Row): LibraryItem => ({ id: r.id, label: r.label, type: r.type, model: r.model, portCount: r.port_count, portPrefix: r.port_prefix, role: r.role, rackUnits: r.rack_units });
export const library = {
  async list(db: Db) { return (await db.query('SELECT * FROM library_items ORDER BY lower(label)')).rows.map(mapLibrary); },
  async create(db: Db, i: Omit<LibraryItem, 'id'>) {
    return mapLibrary((await db.query('INSERT INTO library_items (label,type,model,port_count,port_prefix,role,rack_units) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [i.label, i.type, i.model, i.portCount, i.portPrefix, i.role ?? null, i.rackUnits ?? 1])).rows[0]);
  },
  async update(db: Db, id: string, i: Omit<LibraryItem, 'id'>) {
    const r = (await db.query('UPDATE library_items SET label=$2,type=$3,model=$4,port_count=$5,port_prefix=$6,role=$7,rack_units=$8 WHERE id=$1 RETURNING *', [id, i.label, i.type, i.model, i.portCount, i.portPrefix, i.role ?? null, i.rackUnits ?? 1])).rows[0];
    if (!r) throw notFound('Library item');
    return mapLibrary(r);
  },
  async remove(db: Db, id: string) { return (await db.query('DELETE FROM library_items WHERE id=$1', [id])).rowCount! > 0; },
};
