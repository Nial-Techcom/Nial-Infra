import type { Alert, Client, Device, Link, Revision, Role, Site, User, Vendor } from './types';
import type { ShmnltFile } from './shmnlt';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  /** e.g. "http://localhost:5000/api/v1" or "/api/v1" */
  baseUrl: string;
  getToken: () => string | null | undefined;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export type DeviceInput = Partial<Omit<Device, 'id' | 'createdAt' | 'updatedAt' | 'hasCredentials' | 'credentialsUsername'>> & {
  clientId?: string;
  name?: string;
  type?: Device['type'];
  mgmtUsername?: string | null;
  mgmtPassword?: string | null;
};
export type LinkInput = Partial<Omit<Link, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>>;

/**
 * Tiny fetch-based client used by the web, desktop and mobile apps,
 * so all three speak to the server exactly the same way.
 */
export function createApi(opts: ApiOptions) {
  const doFetch = (...a: Parameters<typeof fetch>) => (opts.fetchImpl ?? fetch)(...a);
  const base = () => opts.baseUrl.replace(/\/+$/, '');

  async function raw(method: string, path: string, body?: unknown, query?: Record<string, string | undefined>): Promise<Response> {
    const qs = query
      ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('&')
      : '';
    const headers: Record<string, string> = {};
    const token = opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await doFetch(`${base()}${path}${qs === '?' ? '' : qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError(0, 'Network error', e);
    }
    if (!res.ok) {
      let message = res.statusText || 'Request failed';
      let details: unknown;
      try {
        const j = await res.json();
        message = j.error ?? message;
        details = j.details;
      } catch {
        /* non JSON body */
      }
      if (res.status === 401 && token) opts.onUnauthorized?.();
      throw new ApiError(res.status, message, details);
    }
    return res;
  }
  const json = async <T>(method: string, path: string, body?: unknown, query?: Record<string, string | undefined>) =>
    (await (await raw(method, path, body, query)).json()) as T;

  return {
    health: () => json<{ status: string }>('GET', '/health'),
    auth: {
      login: (email: string, password: string) => json<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
      me: () => json<{ user: User }>('GET', '/auth/me'),
      changePassword: (currentPassword: string, newPassword: string) => json<{ success: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),
    },
    users: {
      list: () => json<{ users: User[] }>('GET', '/users'),
      create: (u: { email: string; name: string; password: string; role: Role }) => json<{ user: User }>('POST', '/users', u),
      update: (id: string, u: Partial<{ name: string; password: string; role: Role }>) => json<{ user: User }>('PATCH', `/users/${id}`, u),
      remove: (id: string) => json<{ success: true }>('DELETE', `/users/${id}`),
    },
    clients: {
      list: () => json<{ clients: Client[] }>('GET', '/clients'),
      create: (name: string) => json<{ client: Client }>('POST', '/clients', { name }),
      rename: (id: string, name: string) => json<{ client: Client }>('PATCH', `/clients/${id}`, { name }),
      remove: (id: string) => json<{ success: true }>('DELETE', `/clients/${id}`),
      topology: (id: string) => json<{ client: Client; sites: Site[]; devices: Device[]; links: Link[] }>('GET', `/clients/${id}/topology`),
      exportShmnlt: (id: string) => json<ShmnltFile>('GET', `/clients/${id}/export`),
      importShmnlt: (id: string, file: ShmnltFile) => json<{ devices: number; links: number }>('POST', `/clients/${id}/import`, file),
    },
    sites: {
      list: (clientId?: string) => json<{ sites: Site[] }>('GET', '/sites', undefined, { clientId }),
      create: (clientId: string, name: string) => json<{ site: Site }>('POST', '/sites', { clientId, name }),
      rename: (id: string, name: string) => json<{ site: Site }>('PATCH', `/sites/${id}`, { name }),
      remove: (id: string) => json<{ success: true }>('DELETE', `/sites/${id}`),
    },
    devices: {
      list: (clientId?: string) => json<{ devices: Device[] }>('GET', '/devices', undefined, { clientId }),
      create: (d: DeviceInput & { clientId: string; name: string; type: Device['type'] }) => json<{ device: Device }>('POST', '/devices', d),
      update: (id: string, d: DeviceInput) => json<{ device: Device }>('PUT', `/devices/${id}`, d),
      remove: (id: string) => json<{ success: true }>('DELETE', `/devices/${id}`),
      credentials: (id: string) => json<{ username: string | null; password: string | null }>('GET', `/devices/${id}/credentials`),
    },
    links: {
      list: (q: { clientId?: string; deviceId?: string }) => json<{ links: Link[] }>('GET', '/links', undefined, q),
      create: (l: LinkInput & { sourceId: string; sourcePort: string; destId: string; destPort: string; mode: Link['mode'] }) => json<{ link: Link }>('POST', '/links', l),
      update: (id: string, l: LinkInput) => json<{ link: Link }>('PUT', `/links/${id}`, l),
      remove: (id: string) => json<{ success: true }>('DELETE', `/links/${id}`),
    },
    validate: (clientId: string) => json<{ alerts: Alert[] }>('POST', '/validate', { clientId }),
    exports: {
      csv: async (clientId: string) => (await raw('GET', '/export/csv', undefined, { clientId })).text(),
      config: async (q: { clientId?: string; deviceId?: string; vendor: Vendor }) => (await raw('GET', '/export/config', undefined, q)).text(),
      pdf: async (clientId: string) => (await raw('GET', '/export/pdf', undefined, { clientId })).arrayBuffer(),
    },
    revisions: {
      list: (clientId: string) => json<{ revisions: Revision[] }>('GET', `/clients/${clientId}/revisions`),
      create: (clientId: string, note?: string) => json<{ revision: Revision }>('POST', `/clients/${clientId}/revisions`, { note }),
      restore: (id: string) => json<{ success: true }>('POST', `/revisions/${id}/restore`),
    },
  };
}

export type NetForgeApi = ReturnType<typeof createApi>;
