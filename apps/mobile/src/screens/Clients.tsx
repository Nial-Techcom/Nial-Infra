import { useEffect } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { api, canEdit, errorText, useSession, useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Button, Card, Header, Muted } from '../ui';

export function Clients({ onOpen, onSettings }: { onOpen: (id: string) => void; onSettings: () => void }) {
  const t = useT();
  const c = useTheme();
  const user = useSession((s) => s.user);
  const locale = useSession((s) => s.locale);
  const { clients, loading, error, loadClients } = useTopology();
  const [name, setName] = useState('');
  useEffect(() => { void loadClients(); }, [loadClients]);

  async function add() {
    if (!name.trim()) return;
    try { await api.clients.create(name.trim()); setName(''); await loadClients(); } catch (e) { Alert.alert(t('common.error'), errorText(e, locale)); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('sidebar.clients')} right={<Button title={t('mobile.settings')} onPress={onSettings} />} />
      {error ? <Text style={{ color: c.crit, padding: 12 }}>{error}</Text> : null}
      <FlatList
        data={clients} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClients} tintColor={c.mute} />}
        ListEmptyComponent={loading ? null : <Muted>{t('sidebar.noClient')}</Muted>}
        renderItem={({ item }) => <Card onPress={() => onOpen(item.id)}><Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{item.name}</Text></Card>}
        ListFooterComponent={user?.role === 'admin' ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <TextInput value={name} onChangeText={setName} placeholder={t('sidebar.newClient')} placeholderTextColor={c.mute} style={{ color: c.ink, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 }} />
            <Button kind="primary" title={t('common.create')} disabled={!name.trim() || !canEdit(user)} onPress={add} />
          </View>
        ) : null}
      />
    </View>
  );
}
