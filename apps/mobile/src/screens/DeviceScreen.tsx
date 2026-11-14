import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { DEVICE_ROLES, MGMT_PROTOCOLS, isValidVlan, parseIpCidr, type DeviceRole, type MgmtProtocol } from '@nial-infra/shared';
import { api, useCanEdit, errorText, useSession, useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Button, Card, Chip, Field, Header, Muted } from '../ui';

export function DeviceScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useT();
  const c = useTheme();
  const user = useSession((s) => s.user);
  const locale = useSession((s) => s.locale);
  const { devices, links, reload } = useTopology();
  const d = devices.find((x) => x.id === id);
  const edit = useCanEdit();
  const [f, setF] = useState(() => ({
    name: d?.name ?? '', model: d?.model ?? '', serial: d?.serial ?? '', role: (d?.role ?? '') as DeviceRole | '', mgmtIp: d?.mgmtIp ?? '', mgmtGateway: d?.mgmtGateway ?? '',
    mgmtPort: d?.mgmtPort ?? '', mgmtVlan: d?.mgmtVlan ? String(d.mgmtVlan) : '', protocols: (d?.mgmtProtocols ?? []) as MgmtProtocol[], username: d?.credentialsUsername ?? '', password: '',
  }));
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!d) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const fail = (e: unknown) => Alert.alert(t('common.error'), errorText(e, locale));
  const bad = !f.name.trim() || (!!f.mgmtIp && !parseIpCidr(f.mgmtIp)) || (!!f.mgmtGateway && !parseIpCidr(f.mgmtGateway)) || (!!f.mgmtVlan && !isValidVlan(Number(f.mgmtVlan)));
  const mine = links.filter((l) => l.sourceId === id || l.destId === id);
  const nameOf = (x: string) => devices.find((y) => y.id === x)?.name ?? '?';

  async function save() {
    setBusy(true);
    try {
      await api.devices.update(id, {
        name: f.name.trim(), model: f.model.trim() || null, serial: f.serial.trim() || null, role: f.role || null, mgmtIp: f.mgmtIp.trim() || null, mgmtGateway: f.mgmtGateway.trim() || null,
        mgmtPort: f.mgmtPort.trim() || null, mgmtVlan: f.mgmtVlan ? Number(f.mgmtVlan) : null, mgmtProtocols: f.protocols, mgmtUsername: f.username.trim() || null, ...(f.password ? { mgmtPassword: f.password } : {}),
      });
      await reload();
      onBack();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  const remove = () => Alert.alert(t('mobile.deleteDevice'), t('common.deleteConfirm', { name: d.name }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await api.devices.remove(id); await reload(); onBack(); } catch (e) { fail(e); } } },
  ]);

  async function reveal() { try { setShown((await api.devices.credentials(id)).password ?? ''); } catch (e) { fail(e); } }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={d.name} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 8 }}>{t('modals.device.identity')}</Text>
        <Field label={t('modals.device.name')} value={f.name} onChangeText={(v) => set('name', v)} editable={edit} autoCapitalize="sentences" />
        <Field label={t('modals.device.model')} value={f.model} onChangeText={(v) => set('model', v)} editable={edit} />
        <Field label={t('modals.device.serial')} value={f.serial} onChangeText={(v) => set('serial', v)} editable={edit} autoCapitalize="characters" />
        <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('modals.device.role')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
          {DEVICE_ROLES.map((r) => <Chip key={r} label={t(`deviceRoles.${r}`)} active={f.role === r} onPress={() => edit && set('role', f.role === r ? '' : r)} />)}
        </View>

        <Text style={{ color: c.ink, fontWeight: '700', marginVertical: 8 }}>{t('modals.device.management')}</Text>
        <Field label={t('modals.device.mgmtIp')} hint={t('modals.device.mgmtIpHint')} value={f.mgmtIp} onChangeText={(v) => set('mgmtIp', v)} editable={edit} keyboardType="numbers-and-punctuation" />
        <Field label={t('modals.device.gateway')} value={f.mgmtGateway} onChangeText={(v) => set('mgmtGateway', v)} editable={edit} keyboardType="numbers-and-punctuation" />
        <Field label={t('modals.device.mgmtPort')} value={f.mgmtPort} onChangeText={(v) => set('mgmtPort', v)} editable={edit} />
        <Field label={t('modals.device.mgmtVlan')} value={f.mgmtVlan} onChangeText={(v) => set('mgmtVlan', v)} editable={edit} keyboardType="number-pad" />
        <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{t('modals.device.protocols')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
          {MGMT_PROTOCOLS.map((p) => <Chip key={p} label={p} active={f.protocols.includes(p)} onPress={() => edit && set('protocols', f.protocols.includes(p) ? f.protocols.filter((x) => x !== p) : [...f.protocols, p])} />)}
        </View>
        {edit && (
          <>
            <Field label={t('modals.device.username')} value={f.username} onChangeText={(v) => set('username', v)} />
            <Field label={t('modals.device.password')} hint={d.hasCredentials ? t('modals.device.passwordStored') : undefined} value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry />
            {d.hasCredentials && <View style={{ marginBottom: 12 }}><Button title={shown === null ? t('modals.device.revealPassword') : shown || '—'} onPress={() => void reveal()} /></View>}
          </>
        )}

        {mine.length > 0 && (
          <Card>
            <Text style={{ color: c.ink, fontWeight: '600', marginBottom: 4 }}>{t('modals.device.connections')} ({mine.length})</Text>
            {mine.map((l) => { const out = l.sourceId === id; return <Muted key={l.id}>{`${out ? l.sourcePort : l.destPort} → ${nameOf(out ? l.destId : l.sourceId)} (${out ? l.destPort : l.sourcePort}) · ${l.mode}`}</Muted>; })}
          </Card>
        )}

        {edit && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button kind="primary" title={t('common.save')} busy={busy} disabled={bad} onPress={() => void save()} />
            <Button kind="danger" title={t('mobile.deleteDevice')} onPress={remove} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
