import { create } from 'zustand';
import type { Client, Device, Link, Site } from '@netforge/shared';
import { api, errorText } from '../lib/api';
import { useUi } from './ui';
import i18n from '../i18n';

const LAST = 'nf.client';

interface FocusReq { kind: 'device' | 'link'; id: string; n: number }

interface TopologyState {
  clients: Client[];
  clientId: string | null;
  sites: Site[];
  devices: Device[];
  links: Link[];
  activeSiteId: string | null;
  loading: boolean;
  focus: FocusReq | null;
  reset(): void;
  loadClients(): Promise<void>;
  selectClient(id: string | null): Promise<void>;
  reload(): Promise<void>;
  setActiveSite(id: string | null): void;
  requestFocus(kind: FocusReq['kind'], id: string): void;
  createClient(name: string): Promise<void>;
  renameClient(id: string, name: string): Promise<void>;
  deleteClient(id: string): Promise<void>;
  createSite(name: string): Promise<void>;
  deleteSite(id: string): Promise<void>;
  addDevice(input: Parameters<typeof api.devices.create>[0]): Promise<Device | null>;
  updateDevice(id: string, patch: Parameters<typeof api.devices.update>[1]): Promise<Device | null>;
  moveDevice(id: string, x: number, y: number): Promise<void>;
  removeDevices(ids: string[]): Promise<void>;
  addLink(input: Parameters<typeof api.links.create>[0]): Promise<Link | null>;
  updateLink(id: string, patch: Parameters<typeof api.links.update>[1]): Promise<Link | null>;
  removeLinks(ids: string[]): Promise<void>;
}

/** Runs an API call; on failure shows a toast and returns null so callers can stay simple. */
async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    useUi.getState().toast(errorText(e, (k) => i18n.t(k)), 'error');
    return null;
  }
}

export const useTopology = create<TopologyState>((set, get) => ({
  clients: [], clientId: null, sites: [], devices: [], links: [], activeSiteId: null, loading: false, focus: null,

  reset: () => set({ clients: [], clientId: null, sites: [], devices: [], links: [], activeSiteId: null, focus: null }),

  loadClients: async () => {
    const r = await guard(() => api.clients.list());
    if (!r) return;
    set({ clients: r.clients });
    let last: string | null = null;
    try { last = localStorage.getItem(LAST); } catch { /* ignore */ }
    const current = get().clientId;
    const pick = [current, last].find((id) => id && r.clients.some((c) => c.id === id)) ?? r.clients[0]?.id ?? null;
    await get().selectClient(pick);
  },

  selectClient: async (id) => {
    try { id ? localStorage.setItem(LAST, id) : localStorage.removeItem(LAST); } catch { /* ignore */ }
    set({ clientId: id, activeSiteId: null, sites: [], devices: [], links: [] });
    if (id) await get().reload();
  },

  reload: async () => {
    const id = get().clientId;
    if (!id) return;
    set({ loading: true });
    const t = await guard(() => api.clients.topology(id));
    // Ignore a late answer if the user already switched client.
    if (t && get().clientId === id) set({ sites: t.sites, devices: t.devices, links: t.links });
    set({ loading: false });
  },

  setActiveSite: (activeSiteId) => set({ activeSiteId }),
  requestFocus: (kind, id) => set({ focus: { kind, id, n: (get().focus?.n ?? 0) + 1 } }),

  createClient: async (name) => {
    const r = await guard(() => api.clients.create(name));
    if (!r) return;
    set({ clients: [...get().clients, r.client].sort((a, b) => a.name.localeCompare(b.name)) });
    await get().selectClient(r.client.id);
  },
  renameClient: async (id, name) => {
    const r = await guard(() => api.clients.rename(id, name));
    if (r) set({ clients: get().clients.map((c) => (c.id === id ? r.client : c)) });
  },
  deleteClient: async (id) => {
    if (!(await guard(() => api.clients.remove(id)))) return;
    const clients = get().clients.filter((c) => c.id !== id);
    set({ clients });
    if (get().clientId === id) await get().selectClient(clients[0]?.id ?? null);
  },
  createSite: async (name) => {
    const clientId = get().clientId;
    if (!clientId) return;
    const r = await guard(() => api.sites.create(clientId, name));
    if (r) set({ sites: [...get().sites, r.site] });
  },
  deleteSite: async (id) => {
    if (!(await guard(() => api.sites.remove(id)))) return;
    set({ sites: get().sites.filter((s) => s.id !== id), devices: get().devices.map((d) => (d.siteId === id ? { ...d, siteId: null } : d)), activeSiteId: get().activeSiteId === id ? null : get().activeSiteId });
  },

  addDevice: async (input) => {
    const r = await guard(() => api.devices.create(input));
    if (r) set({ devices: [...get().devices, r.device] });
    return r?.device ?? null;
  },
  updateDevice: async (id, patch) => {
    const r = await guard(() => api.devices.update(id, patch));
    if (r) set({ devices: get().devices.map((d) => (d.id === id ? r.device : d)) });
    return r?.device ?? null;
  },
  moveDevice: async (id, x, y) => {
    set({ devices: get().devices.map((d) => (d.id === id ? { ...d, x, y } : d)) }); // optimistic: the node is already there
    if (!(await guard(() => api.devices.update(id, { x, y })))) await get().reload();
  },
  removeDevices: async (ids) => {
    const done: string[] = [];
    for (const id of ids) if (await guard(() => api.devices.remove(id))) done.push(id);
    if (done.length) set({ devices: get().devices.filter((d) => !done.includes(d.id)), links: get().links.filter((l) => !done.includes(l.sourceId) && !done.includes(l.destId)) });
  },
  addLink: async (input) => {
    const r = await guard(() => api.links.create(input));
    if (r) set({ links: [...get().links, r.link] });
    return r?.link ?? null;
  },
  updateLink: async (id, patch) => {
    const r = await guard(() => api.links.update(id, patch));
    if (r) set({ links: get().links.map((l) => (l.id === id ? r.link : l)) });
    return r?.link ?? null;
  },
  removeLinks: async (ids) => {
    const done: string[] = [];
    for (const id of ids) if (await guard(() => api.links.remove(id))) done.push(id);
    if (done.length) set({ links: get().links.filter((l) => !done.includes(l.id)) });
  },
}));
