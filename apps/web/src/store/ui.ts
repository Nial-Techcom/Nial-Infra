import { create } from 'zustand';
import type { Link } from '@nial-infra/shared';

export type Modal =
  | { kind: 'device'; id: string }
  | { kind: 'cable'; linkId?: string; draft?: Pick<Link, 'sourceId' | 'destId'> }
  | { kind: 'config'; deviceId?: string }
  | { kind: 'custom-device'; pos?: { x: number; y: number } }
  | { kind: 'name'; title: string; label: string; initial: string; onSubmit: (v: string) => Promise<void> }
  | { kind: 'history' }
  | { kind: 'users' }
  | { kind: 'admin' }
  | { kind: 'members' }
  | { kind: 'password' }
  | { kind: 'search' }
  | null;

export interface Toast { id: number; text: string; tone: 'ok' | 'error' }
export interface ConfirmReq { title: string; message: string; danger?: boolean; confirmLabel?: string; onConfirm: () => void | Promise<void> }

type Theme = 'dark' | 'light';
export type View = 'schema' | 'rack';
const savedTheme = (): Theme => {
  try {
    const t = localStorage.getItem('nf.theme');
    if (t === 'light' || t === 'dark') return t;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

interface UiState {
  modal: Modal;
  toasts: Toast[];
  confirm: ConfirmReq | null;
  theme: Theme;
  /** Schema and Rack are two views of the same data (like a site): only the way it is drawn changes. */
  view: View;
  setView(v: View): void;
  alertsOpen: boolean;
  sidebarOpen: boolean;
  open(m: Modal): void;
  close(): void;
  toast(text: string, tone?: Toast['tone']): void;
  ask(c: ConfirmReq): void;
  closeConfirm(): void;
  toggleTheme(): void;
  setAlertsOpen(v: boolean): void;
  setSidebarOpen(v: boolean): void;
}

let seq = 1;
export const useUi = create<UiState>((set, get) => ({
  modal: null,
  toasts: [],
  confirm: null,
  theme: savedTheme(),
  view: 'schema',
  setView: (view) => set({ view }),
  alertsOpen: true,
  sidebarOpen: true,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
  toast: (text, tone = 'ok') => {
    const id = seq++;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), tone === 'error' ? 6000 : 3000);
  },
  ask: (confirm) => set({ confirm }),
  closeConfirm: () => set({ confirm: null }),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('nf.theme', theme); } catch { /* ignore */ }
    set({ theme });
  },
  setAlertsOpen: (alertsOpen) => set({ alertsOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
