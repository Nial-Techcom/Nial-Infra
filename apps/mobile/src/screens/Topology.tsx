import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import {
  DEVICE_COLORS, DEVICE_LIBRARY, alertMessage, buildShmnlt, cablingMatrixCsv, generateClientConfig, parseShmnlt, summarizeAlerts, validateTopology, VENDORS, type Vendor,
} from '@netforge/shared';
import { api, useCanEdit, errorText, useSession, useT, useTopology } from '../store';
import { pickText, shareText } from '../share';
import { useTheme } from '../theme';
import { Button, Card, Chip, Dot, Header, Muted } from '../ui';
import { Diagram } from './Diagram';
import { Racks } from './Racks';

type Tab = 'diagram' | 'racks' | 'devices' | 'cables' | 'alerts' | 'export';

export function Topology({ onBack, onDevice, onLink }: { onBack: () => void; onDevice: (id: string) => void; onLink: (id?: string) => void }) {
  const t = useT();
  const c = useTheme();
  const user = useSession((s) => s.user);
  const locale = useSession((s) => s.locale);
  const { clients, clientId, devices, links, loading, reload } = useTopology();
  const edit = useCanEdit();
  const [tab, setTab] = useState<Tab>('diagram');
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState<Vendor>('cisco');
  const client = clients.find((x) => x.id === clientId);
  const alerts = useMemo(() => validateTopology({ devices, links }), [devices, links]);
  const counts = summarizeAlerts(alerts);
  const nameOf = (id: string) => devices.find((d) => d.id === id)?.name ?? '?';
  const fail = (e: unknown) => Alert.alert(t('common.error'), errorText(e, locale));
  const safe = (client?.name ?? 'netforge').replace(/[^A-Za-z0-9_-]+/g, '_');

  async function addDevice(key: string) {
    const p = DEVICE_LIBRARY.find((x) => x.key === key);
    if (!p || !clientId) return;
    const n = devices.filter((d) => d.type === p.type).length + 1;
    try {
      await api.devices.create({ clientId, name: `${p.label.split(' ')[0].toUpperCase()}-${String(n).padStart(2, '0')}`, type: p.type, model: p.model, portCount: p.portCount, portPrefix: p.portPrefix, role: p.role ?? null, x: 40 + (devices.length % 4) * 190, y: 40 + Math.floor(devices.length / 4) * 90 });
      await reload();
    } catch (e) { fail(e); }
  }

  async function share(name: string, text: string, mime?: string) {
    try { if (!(await shareText(name, text, mime))) Alert.alert(t('mobile.shareFailed')); } catch (e) { fail(e); }
  }

  async function importFile() {
    try {
      const text = await pickText();
      if (!text || !clientId) return;
      const r = await api.clients.importShmnlt(clientId, parseShmnlt(text));
      await reload();
      Alert.alert(t('mobile.imported'), t('exports.imported', { devices: r.devices, links: r.links }));
    } catch (e) { fail(e); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'diagram', label: t('mobile.diagram') }, { id: 'racks', label: t('rack.viewRack') }, { id: 'devices', label: t('canvas.devices') }, { id: 'cables', label: t('mobile.cables') },
    { id: 'alerts', label: `${t('alerts.title')} ${alerts.length ? `(${alerts.length})` : ''}` }, { id: 'export', label: t('exports.title') },
  ];
  const filtered = devices.filter((d) => !q.trim() || [d.name, d.mgmtIp, d.model, d.serial].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={client?.name ?? ''} onBack={onBack} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, paddingBottom: 2 }}>
        {tabs.map((x) => <Chip key={x.id} label={x.label} active={tab === x.id} onPress={() => setTab(x.id)} />)}
      </View>

      {tab === 'diagram' && <Diagram onDevice={onDevice} onLink={(id) => onLink(id)} />}

      {tab === 'racks' && <Racks onDevice={onDevice} />}

      {tab === 'devices' && (
        <FlatList
          data={filtered} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.mute} />}
          ListHeaderComponent={<TextInput value={q} onChangeText={setQ} placeholder={t('search.placeholder')} placeholderTextColor={c.mute} style={{ color: c.ink, backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16 }} />}
          ListEmptyComponent={<Muted>{t('mobile.empty')}</Muted>}
          renderItem={({ item: d }) => (
            <Card onPress={() => onDevice(d.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: DEVICE_COLORS[d.type] }} />
                <Text style={{ color: c.ink, fontWeight: '600', fontSize: 16, flex: 1 }}>{d.name}</Text>
                <Muted>{t(`deviceTypes.${d.type}`)}</Muted>
              </View>
              <Muted>{[d.mgmtIp, d.model].filter(Boolean).join(' · ') || '—'}</Muted>
            </Card>
          )}
          ListFooterComponent={edit ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: c.mute, fontWeight: '600', marginBottom: 6 }}>{t('mobile.addDevice')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{DEVICE_LIBRARY.map((p) => <Chip key={p.key} label={p.label} onPress={() => void addDevice(p.key)} />)}</View>
            </View>
          ) : null}
        />
      )}

      {tab === 'cables' && (
        <FlatList
          data={links} keyExtractor={(l) => l.id} contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.mute} />}
          ListEmptyComponent={<Muted>{t('mobile.empty')}</Muted>}
          ListHeaderComponent={edit ? <Button kind="primary" title={t('mobile.addCable')} onPress={() => onLink(undefined)} style={{ marginBottom: 10 }} disabled={devices.length < 2} /> : null}
          renderItem={({ item: l }) => (
            <Card onPress={() => onLink(l.id)}>
              <Text style={{ color: c.ink, fontWeight: '600' }}>{nameOf(l.sourceId)} {l.sourcePort} ↔ {nameOf(l.destId)} {l.destPort}</Text>
              <Muted>{l.medium === 'fiber' ? 'fibre · ' : 'ethernet · '}{l.mode === 'trunk' ? `trunk · native ${l.nativeVlan ?? '—'} · tagged ${l.taggedVlans.length}` : `access · VLAN ${l.accessVlan ?? '?'}`}</Muted>
            </Card>
          )}
        />
      )}

      {tab === 'alerts' && (
        <FlatList
          data={alerts} keyExtractor={(a) => a.id} contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={<Muted>{`${t('alerts.critical')} ${counts.critical} · ${t('alerts.warning')} ${counts.warning} · ${t('alerts.info')} ${counts.info}`}</Muted>}
          ListEmptyComponent={<Text style={{ color: c.ok, paddingTop: 12 }}>{t('alerts.none')}</Text>}
          renderItem={({ item: a }) => (
            <Card onPress={() => (a.linkId ? onLink(a.linkId) : a.deviceId ? onDevice(a.deviceId) : undefined)} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Dot type={a.type} /><Muted>{`${t(`alerts.${a.type}`)} · ${a.rule}`}</Muted></View>
              <Text style={{ color: c.ink, marginTop: 4 }}>{alertMessage(locale, a)}</Text>
            </Card>
          )}
        />
      )}

      {tab === 'export' && (
        <View style={{ padding: 12, gap: 10 }}>
          <Button title={t('exports.csv')} onPress={() => void share(`${safe}-cabling.csv`, '﻿' + cablingMatrixCsv(devices, links), 'text/csv')} />
          <Button title={t('exports.shmnlt')} onPress={() => client && void share(`${safe}.shmnlt`, JSON.stringify(buildShmnlt(client.name, useTopology.getState().sites, devices, links, useTopology.getState().racks), null, 2), 'application/json')} />
          {edit ? <Button title={t('exports.importShmnlt')} onPress={() => void importFile()} /> : null}
          <Text style={{ color: c.mute, fontWeight: '600', marginTop: 6 }}>{t('exports.config')}</Text>
          <View style={{ flexDirection: 'row' }}>{VENDORS.map((v) => <Chip key={v} label={t(`exports.${v}`)} active={vendor === v} onPress={() => setVendor(v)} />)}</View>
          <Button kind="primary" title={t('common.download')} onPress={() => void share(`${safe}-${vendor}.txt`, generateClientConfig(vendor, devices, links))} />
        </View>
      )}
    </View>
  );
}
