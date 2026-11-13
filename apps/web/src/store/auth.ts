import type { Role, User } from '@infra-tech/shared';
import { create } from 'zustand';

const KEY = 'nf.session';
function load(): { token: string | null; user: User | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable */ }
  return { token: null, user: null };
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** Effective role inside the client being viewed (admins are admin everywhere). */
  clientRole: Role | null;
  setClientRole(r: Role | null): void;
  setSession(token: string, user: User): void;
  setUser(user: User): void;
  logout(): void;
}

export const useAuth = create<AuthState>((set, get) => ({
  ...load(),
  clientRole: null,
  setClientRole: (clientRole) => set({ clientRole }),
  setSession: (token, user) => {
    try { localStorage.setItem(KEY, JSON.stringify({ token, user })); } catch { /* ignore */ }
    set({ token, user });
  },
  setUser: (user) => get().setSession(get().token ?? '', user),
  logout: () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    set({ token: null, user: null, clientRole: null });
  },
}));

/** Write access in the open client: global admin, or technician member of it. */
export const useCanEdit = () => useAuth((s) => s.user?.role === 'admin' || s.clientRole === 'technician' || s.clientRole === 'admin');
export const useIsAdmin = () => useAuth((s) => s.user?.role === 'admin');
