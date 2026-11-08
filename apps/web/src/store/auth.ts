import type { User } from '@netforge/shared';
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
  setSession(token: string, user: User): void;
  setUser(user: User): void;
  logout(): void;
}

export const useAuth = create<AuthState>((set, get) => ({
  ...load(),
  setSession: (token, user) => {
    try { localStorage.setItem(KEY, JSON.stringify({ token, user })); } catch { /* ignore */ }
    set({ token, user });
  },
  setUser: (user) => get().setSession(get().token ?? '', user),
  logout: () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    set({ token: null, user: null });
  },
}));

export const canEdit = (u: User | null) => u?.role === 'admin' || u?.role === 'technician';
export const isAdmin = (u: User | null) => u?.role === 'admin';
