import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { ApiError, createApi, translate, type Client, type Device, type Link, type Locale, type Rack, type Site, type User } from '@infra-tech/shared';

const KEY = 'infra-tech.session';

interface SessionState {
  ready: boolean;
  server: string;
  token: string | null;
  user: User | null;
  locale: Locale;
  boot(): Promise<void>;
  login(server: string, token: string, user: User): Promise<void>;
  logout(): Promise<void>;
  setLocale(l: Locale): Promise<void>;
}

async function persist(s: Pick<SessionState, 'server' | 'token' | 'user' | 'locale'>) {
  try { await SecureStore.setItemAsync(KEY, JSON.stringify({ server: s.server, token: s.token, user: s.user, locale: s.locale })); } catch { /* storage unavailable */ }
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false, server: '', token: null, user: null, locale: 'fr',
  boot: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) set({ ...JSON.parse(raw) });
    } catch { /* first launch */ }
    set({ ready: true });
  },
  login: async (server, token, user) => { set({ server, token, user }); await persist(get()); },
  logout: async () => { set({ token: null, user: null }); useTopology.getState().reset(); await persist(get()); },
  setLocale: async (locale) => { set({ locale }); await persist(get()); },
}));

export const api = createApi({
  get baseUrl() { return `${useSession.getState().server.replace(/\/+$/, '')}/api/v1`; },
  getToken: () => useSession.getState().token,
  onUnauthorized: () => { void useSession.getState().logout(); },
});

/** Translation hook: re-renders when the language changes. */
export function useT() {
  const locale = useSession((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) => translate(locale, key, params);
}

export function errorText(e: unknown, locale: Locale): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return translate(locale, 'errors.network');
    if (e.status === 401) return translate(locale, 'errors.unauthorized');
    if (e.status === 403) return translate(locale, 'errors.forbidden');
    return e.message;
  }
  return e instanceof Error ? e.message : translate(locale, 'errors.generic');
}

interface TopologyState {
  clients: Client[];
  clientId: string | null;
  sites: Site[];
  racks: Rack[];
  devices: Device[];
  links: Link[];
  loading: boolean;
  error: string | null;
  reset(): void;
  loadClients(): Promise<void>;
  open(id: string): Promise<void>;
  reload(): Promise<void>;
}

export const useTopology = create<TopologyState>((set, get) => ({
  clients: [], clientId: null, sites: [], racks: [], devices: [], links: [], loading: false, error: null,
  reset: () => set({ clients: [], clientId: null, sites: [], racks: [], devices: [], links: [], error: null }),
  loadClients: async () => {
    set({ loading: true, error: null });
    try { set({ clients: (await api.clients.list()).clients }); } catch (e) { set({ error: errorText(e, useSession.getState().locale) }); }
    set({ loading: false });
  },
  open: async (id) => { set({ clientId: id, sites: [], racks: [], devices: [], links: [] }); await get().reload(); },
  reload: async () => {
    const id = get().clientId;
    if (!id) return;
    set({ loading: true, error: null });
    try {
      const t = await api.clients.topology(id);
      if (get().clientId === id) set({ sites: t.sites, racks: t.racks ?? [], devices: t.devices, links: t.links });
    } catch (e) { set({ error: errorText(e, useSession.getState().locale) }); }
    set({ loading: false });
  },
}));

export const isAdmin = (u: User | null) => u?.role === 'admin';
/** Write access in the open client: global admin, or technician member of that client. */
export function useCanEdit() {
  const u = useSession((s) => s.user);
  const role = useTopology((s) => s.clients.find((c) => c.id === s.clientId)?.myRole);
  return u?.role === 'admin' || role === 'technician' || role === 'admin';
}
