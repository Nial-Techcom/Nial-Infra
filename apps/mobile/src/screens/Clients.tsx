import { useEffect } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { api, errorText, useSession, useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Button, Card, Header, Muted } from '../ui';

export function Clients({ onOpen, onSettings }: { onOpen: (id: string) => void; onSettings: () => void }) {
  const t = useT();
  const c = useTheme();
  const user = useSession((s) => s.user);
  const locale = useSession((s) => s.locale);
  const { clients, loading, error, loadClients } = useTopology();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => { void loadClients(); }, [loadClients]);

  async function add() {
    if (!name.trim()) return;
    try { await api.clients.create(name.trim()); setName(''); await loadClients(); } catch (e) { Alert.alert(t('common.error'), errorText(e, locale)); }
  }

  // An invitation arrives by e-mail as a link: paste it (or just its code) to join the client.
  async function join() {
    const m = code.match(/invite=([\w-]+)/);
    try { await api.invitations.accept((m ? m[1] : code).trim()); setCode(''); await loadClients(); } catch (e) { Alert.alert(t('common.error'), errorText(e, locale)); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('sidebar.clients')} right={<Button title={t('mobile.settings')} onPress={onSettings} />} />
      {error ? <Text style={{ color: c.crit, padding: 12 }}>{error}</Text> : null}
      <FlatList
        data={clients} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadClients} tintColor={c.mute} />}
        ListEmptyComponent={loading ? null : <Muted>{t('account.noClientBody')}</Muted>}
        renderItem={({ item }) => <Card onPress={() => onOpen(item.id)}><Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{item.name}</Text>{!item.isOwner && <Text style={{ color: c.mute, fontSize: 12, marginTop: 2 }}>{item.myRole === 'viewer' ? t('members.readOnlyBadge') : t('members.sharedWithMe')}</Text>}</Card>}
        ListFooterComponent={(
          <>
            <View style={{ marginTop: 12, gap: 8 }}>
            <TextInput value={name} onChangeText={setName} placeholder={t('sidebar.newClient')} placeholderTextColor={c.mute} style={{ color: c.ink, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 }} />
            <Button kind="primary" title={t('common.create')} disabled={!name.trim()} onPress={add} />
          </View>
            {<View style={{ marginTop: 12, gap: 8 }}>
            <TextInput value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder={t('account.inviteHintMobile')} placeholderTextColor={c.mute} style={{ color: c.ink, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 }} />
            <Button kind="primary" title={t('account.inviteAccept')} disabled={code.trim().length < 20} onPress={join} />
          </View>}
          </>
        )}
      />
    </View>
  );
}
