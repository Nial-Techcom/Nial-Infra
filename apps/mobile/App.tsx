import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, useSession, useTopology } from './src/store';
import { ConnectionGate, useConnectionWatch } from './src/connection';
import { useTheme } from './src/theme';
import { Clients } from './src/screens/Clients';
import { DeviceScreen } from './src/screens/DeviceScreen';
import { LinkScreen } from './src/screens/LinkScreen';
import { Login } from './src/screens/Login';
import { Settings } from './src/screens/Settings';
import { Topology } from './src/screens/Topology';

type Route = { name: 'clients' } | { name: 'settings' } | { name: 'topology' } | { name: 'device'; id: string } | { name: 'link'; id?: string };

export default function App() {
  const c = useTheme();
  const { ready, token, boot } = useSession();
  const [stack, setStack] = useState<Route[]>([{ name: 'clients' }]);
  const route = stack[stack.length - 1];
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);

  useEffect(() => { void boot(); }, [boot]);
  useConnectionWatch();
  // Validate a stored session on start; a 401 logs out through the API client.
  useEffect(() => { if (token) api.auth.me().then((r) => useSession.setState({ user: r.user })).catch(() => undefined); else setStack([{ name: 'clients' }]); }, [token]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (stack.length > 1) { pop(); return true; } return false; });
    return () => sub.remove();
  }, [stack.length, pop]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><ActivityIndicator color={c.mute} /></View>;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.panel }}>
        <StatusBar style="auto" />
        {!token ? <Login /> : (
          <>
            {route.name === 'clients' && <Clients onOpen={(id) => { void useTopology.getState().open(id); push({ name: 'topology' }); }} onSettings={() => push({ name: 'settings' })} />}
            {route.name === 'settings' && <Settings onBack={pop} />}
            {route.name === 'topology' && <Topology onBack={() => { useTopology.setState({ clientId: null }); pop(); }} onDevice={(id) => push({ name: 'device', id })} onLink={(id) => push({ name: 'link', id })} />}
            {route.name === 'device' && <DeviceScreen key={route.id} id={route.id} onBack={pop} />}
            {route.name === 'link' && <LinkScreen key={route.id ?? 'new'} id={route.id} onBack={pop} />}
          </>
        )}
        <ConnectionGate />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
