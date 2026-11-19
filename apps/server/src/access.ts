import type { Request } from 'express';
import type { Role } from '@nial-infra/shared';
import type { Db } from './db';
import { HttpError } from './errors';
import * as store from './store';

export type Level = 'read' | 'write';

/**
 * Role of the signed-in user inside one client. Clients are private to their owner and the people they shared them with:
 * global admins get NO special access to client data. No membership = the client does not exist for them (404).
 */
export async function roleIn(db: Db, req: Request, clientId: string): Promise<Role> {
  const user = req.user!;
  const m = await store.members.roleOf(db, clientId, user.id);
  if (!m) throw new HttpError(404, 'Client not found');
  return m;
}

/** Throws unless the user may read (or write) the client's data; returns the effective role. */
export async function requireClient(db: Db, req: Request, clientId: string | undefined, level: Level = 'read'): Promise<Role> {
  if (!clientId) throw new HttpError(400, 'clientId is required');
  const role = await roleIn(db, req, clientId);
  if (level === 'write' && role === 'viewer') throw new HttpError(403, 'Insufficient permissions');
  return role;
}

const need = <T>(v: T | null | undefined, what: string): T => { if (!v) throw new HttpError(404, `${what} not found`); return v; };
export const clientOf = {
  async device(db: Db, id: string) { return need(await store.devices.getRow(db, id), 'Device').client_id as string; },
  async link(db: Db, id: string) { return need(await store.links.get(db, id), 'Link').clientId; },
  async site(db: Db, id: string) { return need(await store.sites.get(db, id), 'Site').clientId; },
  async rack(db: Db, id: string) { return need(await store.racks.get(db, id), 'Rack').clientId; },
  async revision(db: Db, id: string) { return need(await store.revisions.getRaw(db, id), 'Revision').client_id as string; },
};

/**
 * Sharing / renaming / deleting a client and managing its sites: the client's owner only (admins included: no bypass).
 * Other members (even technicians) get 403; people with no access at all get 404 so existence is not revealed.
 */
export async function requireManage(db: Db, req: Request, clientId: string | undefined): Promise<void> {
  if (!clientId) throw new HttpError(400, 'clientId is required');
  const client = await store.clients.get(db, clientId);
  if (!client) throw new HttpError(404, 'Client not found');
  const user = req.user!;
  if (client.ownerId === user.id) return;
  if (!(await store.members.roleOf(db, clientId, user.id))) throw new HttpError(404, 'Client not found');
  throw new HttpError(403, 'Insufficient permissions');
}
