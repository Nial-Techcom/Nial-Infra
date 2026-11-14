import { useEffect } from 'react';
import { AppState, Text, View } from 'react-native';
import { create } from 'zustand';
import { api, useSession, useT, useTopology } from './store';
import { useTheme } from './theme';
import { Button } from './ui';

/** Nial-Infra has no offline mode: while the server does not answer, the app is blocked (nothing is stored on the phone). */
interface ConnectionState { online: boolean; checking: boolean; check(): Promise<boolean> }

const FAILS_BEFORE_BLOCK = 2;
let fails = 0;

export const useConnection = create<ConnectionState>((set, get) => ({
  online: true,
  checking: false,
  check: async () => {
    if (get().checking) return get().online;
    set({ checking: true });
    let ok = false;
    try { await Promise.race([api.health(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]); ok = true; } catch { ok = false; }
    const was = get().online;
    fails = ok ? 0 : fails + 1;
    const online = ok || fails < FAILS_BEFORE_BLOCK;
    set({ online, checking: false });
    if (ok && !was && useSession.getState().token) {
      void useTopology.getState().loadClients().then(() => useTopology.getState().reload());
    }
    return online;
  },
}));

/** Polls while signed in (fast while blocked) and re-checks as soon as the app returns to the foreground. */
export function useConnectionWatch() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token) { fails = 0; useConnection.setState({ online: true }); return; }
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => { await useConnection.getState().check(); timer = setTimeout(loop, fails === 0 ? 15000 : 3000); };
    void loop();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { fails = FAILS_BEFORE_BLOCK; void useConnection.getState().check(); } });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [token]);
}

export function ConnectionGate() {
  const t = useT();
  const c = useTheme();
  const online = useConnection((s) => s.online);
  const checking = useConnection((s) => s.checking);
  const server = useSession((s) => s.server);
  const token = useSession((s) => s.token);
  if (online || !token) return null;
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: c.bg, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t('conn.title')}</Text>
      <Text style={{ color: c.mute, fontSize: 14, textAlign: 'center', marginTop: 10 }}>{t('conn.body')}</Text>
      <Text style={{ color: c.mute, fontSize: 12, textAlign: 'center', marginTop: 12 }}>{t('conn.server')} : {server}</Text>
      <Text style={{ color: c.mute, fontSize: 12, textAlign: 'center', marginTop: 12, minHeight: 16 }}>{checking ? t('conn.checking') : ''}</Text>
      <View style={{ marginTop: 8, gap: 10 }}>
        <Button kind="primary" title={t('conn.retry')} busy={checking} onPress={() => void useConnection.getState().check()} />
        <Button title={t('conn.changeServer')} onPress={() => { useConnection.setState({ online: true }); void useSession.getState().logout(); }} />
      </View>
    </View>
  );
}
