import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { devicePorts, formatVlanList, isValidVlan, parseVlanList, type LinkMode } from '@netforge/shared';
import { api, useCanEdit, errorText, useSession, useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Button, Chip, Field, Header, Muted } from '../ui';

function DevicePicker({ label, value, onChange, exclude }: { label: string; value: string; onChange: (id: string) => void; exclude?: string }) {
  const c = useTheme();
  const devices = useTopology((s) => s.devices);
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{devices.filter((d) => d.id !== exclude).map((d) => <Chip key={d.id} label={d.name} active={value === d.id} onPress={() => onChange(d.id)} />)}</View>
    </View>
  );
}

/** Create a cable (no id) or edit/delete an existing one. */
export function LinkScreen({ id, onBack }: { id?: string; onBack: () => void }) {
  const t = useT();
  const c = useTheme();
  const user = useSession((s) => s.user);
  const locale = useSession((s) => s.locale);
  const { devices, links, reload } = useTopology();
  const existing = id ? links.find((l) => l.id === id) : undefined;
  const edit = useCanEdit();
  const [f, setF] = useState(() => ({
    sourceId: existing?.sourceId ?? '', destId: existing?.destId ?? '', sourcePort: existing?.sourcePort ?? '', destPort: existing?.destPort ?? '', mode: (existing?.mode ?? 'access') as LinkMode, medium: (existing?.medium ?? 'ethernet') as 'ethernet' | 'fiber',
    nativeVlan: existing?.nativeVlan ? String(existing.nativeVlan) : '', destNativeVlan: existing?.destNativeVlan ? String(existing.destNativeVlan) : '',
    tagged: existing ? formatVlanList(existing.taggedVlans) : '', accessVlan: existing?.accessVlan ? String(existing.accessVlan) : '',
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const src = devices.find((d) => d.id === f.sourceId);
  const dst = devices.find((d) => d.id === f.destId);
  const fail = (e: unknown) => Alert.alert(t('common.error'), errorText(e, locale));
  const used = (deviceId: string) => new Set(links.filter((l) => l.id !== id).flatMap((l) => [l.sourceId === deviceId ? l.sourcePort : '', l.destId === deviceId ? l.destPort : '']).filter(Boolean));
  const vlanOk = (v: string) => !v || isValidVlan(Number(v));
  const trunk = f.mode === 'trunk';
  const bad = !src || !dst || src.id === dst.id || !f.sourcePort.trim() || !f.destPort.trim() || !vlanOk(f.nativeVlan) || !vlanOk(f.destNativeVlan) || !vlanOk(f.accessVlan);

  function pickDevice(side: 'source' | 'dest', deviceId: string) {
    const d = devices.find((x) => x.id === deviceId);
    const free = d ? devicePorts(d).find((p) => !used(deviceId).has(p)) ?? '' : '';
    setF((p) => ({ ...p, ...(side === 'source' ? { sourceId: deviceId, sourcePort: free } : { destId: deviceId, destPort: free }) }));
  }

  async function save() {
    if (bad) return;
    setBusy(true);
    const body = {
      sourcePort: f.sourcePort.trim(), destPort: f.destPort.trim(), mode: f.mode, medium: f.medium,
      nativeVlan: trunk && f.nativeVlan ? Number(f.nativeVlan) : null, destNativeVlan: trunk && f.destNativeVlan ? Number(f.destNativeVlan) : null,
      taggedVlans: trunk ? parseVlanList(f.tagged) : [], accessVlan: !trunk && f.accessVlan ? Number(f.accessVlan) : null,
    };
    try {
      if (existing) await api.links.update(existing.id, body);
      else await api.links.create({ sourceId: f.sourceId, destId: f.destId, ...body });
      await reload();
      onBack();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  const remove = () => existing && Alert.alert(t('mobile.deleteCable'), t('common.deleteConfirm', { name: `${src?.name} ↔ ${dst?.name}` }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await api.links.remove(existing.id); await reload(); onBack(); } catch (e) { fail(e); } } },
  ]);

  const portChips = (d: typeof src, value: string, onPick: (p: string) => void) => d ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
      {devicePorts(d).slice(0, 60).map((p) => <Chip key={p} label={used(d.id).has(p) ? `${p} •` : p} active={value === p} onPress={() => edit && onPick(p)} />)}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={existing ? t('modals.cable.title') : t('mobile.addCable')} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
        {!existing && <DevicePicker label={t('modals.cable.from')} value={f.sourceId} onChange={(x) => pickDevice('source', x)} />}
        {!existing && <DevicePicker label={t('modals.cable.to')} value={f.destId} onChange={(x) => pickDevice('dest', x)} exclude={f.sourceId} />}
        {existing && <Text style={{ color: c.ink, fontWeight: '600', marginBottom: 10 }}>{src?.name} ↔ {dst?.name}</Text>}

        <Field label={`${t('modals.cable.sourcePort')}${src ? ` (${src.name})` : ''}`} value={f.sourcePort} onChangeText={(v) => set('sourcePort', v)} editable={edit} />
        {portChips(src, f.sourcePort, (p) => set('sourcePort', p))}
        <Field label={`${t('modals.cable.destPort')}${dst ? ` (${dst.name})` : ''}`} value={f.destPort} onChangeText={(v) => set('destPort', v)} editable={edit} />
        {portChips(dst, f.destPort, (p) => set('destPort', p))}
        <Muted>• = {t('mobile.portInUse')}</Muted>

        <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600', marginVertical: 8 }}>{t('modals.cable.medium')}</Text>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>{(['ethernet', 'fiber'] as const).map((m) => <Chip key={m} label={t(`modals.cable.${m}`)} active={f.medium === m} onPress={() => edit && set('medium', m)} />)}</View>

        <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600', marginVertical: 8 }}>{t('modals.cable.mode')}</Text>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>{(['access', 'trunk'] as const).map((m) => <Chip key={m} label={t(`modals.cable.${m}`)} active={f.mode === m} onPress={() => edit && set('mode', m)} />)}</View>

        {trunk ? (
          <>
            <Field label={t('modals.cable.nativeVlan')} value={f.nativeVlan} onChangeText={(v) => set('nativeVlan', v)} editable={edit} keyboardType="number-pad" />
            <Field label={t('modals.cable.destNativeVlan')} hint={t('modals.cable.sameAsSource')} value={f.destNativeVlan} onChangeText={(v) => set('destNativeVlan', v)} editable={edit} keyboardType="number-pad" />
            <Field label={t('modals.cable.taggedVlans')} hint={t('modals.cable.taggedHint')} value={f.tagged} onChangeText={(v) => set('tagged', v)} editable={edit} keyboardType="numbers-and-punctuation" />
          </>
        ) : (
          <Field label={t('modals.cable.accessVlan')} value={f.accessVlan} onChangeText={(v) => set('accessVlan', v)} editable={edit} keyboardType="number-pad" />
        )}
        {src && dst && src.id === dst.id ? <Text style={{ color: c.crit }}>{t('mobile.sameDevice')}</Text> : null}

        {edit && (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Button kind="primary" title={t('common.save')} busy={busy} disabled={bad} onPress={() => void save()} />
            {existing && <Button kind="danger" title={t('mobile.deleteCable')} onPress={remove} />}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
