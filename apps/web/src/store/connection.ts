import { create } from 'zustand';
import { api } from '../lib/api';
import { useAuth } from './auth';
import { useTopology } from './topology';

/**
 * Nial-Infra never works offline: everything lives on the server, nothing is cached on the device.
 * This store tracks whether the server answers; while it does not, the UI is blocked by <ConnectionGate>.
 */
interface ConnectionState {
  online: boolean;
  checking: boolean;
  check(): Promise<boolean>;
}

const FAILS_BEFORE_BLOCK = 2; // one lost packet must not flash the blocking screen
let fails = 0;

export const useConnection = create<ConnectionState>((set, get) => ({
  online: true,
  checking: false,
  check: async () => {
    if (get().checking) return get().online;
    set({ checking: true });
    let ok = false;
    try {
      await Promise.race([api.health(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
      ok = true;
    } catch { ok = false; }
    const was = get().online;
    fails = ok ? 0 : fails + 1;
    const online = ok || fails < FAILS_BEFORE_BLOCK;
    set({ online, checking: false });
    // Back from an outage: refresh what the screen shows, since changes may have happened meanwhile.
    if (ok && !was && useAuth.getState().token) {
      void useTopology.getState().loadClients().then(() => useTopology.getState().reload());
    }
    return online;
  },
}));

/** Poll while signed in (fast when blocked), and react immediately to the OS network events. */
export function startConnectionWatch(): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const loop = async () => {
    if (useAuth.getState().token || !useConnection.getState().online) await useConnection.getState().check();
    timer = setTimeout(loop, fails === 0 ? 15000 : 3000);
  };
  const now = () => { fails = FAILS_BEFORE_BLOCK; void useConnection.getState().check(); };
  const back = () => { void useConnection.getState().check(); };
  window.addEventListener('offline', now);
  window.addEventListener('online', back);
  void loop();
  return () => { clearTimeout(timer); window.removeEventListener('offline', now); window.removeEventListener('online', back); };
}
