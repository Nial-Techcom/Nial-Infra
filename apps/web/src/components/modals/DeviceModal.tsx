import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEVICE_ROLES, DEVICE_TYPES, MGMT_PROTOCOLS, isValidVlan, parseIpCidr, type DeviceRole, type DeviceType, type MgmtProtocol } from '@netforge/shared';
import { api, errorText } from '../../lib/api';
import { useCanEdit } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { Field, Modal, Tabs } from '../ui';

type Tab = 'identity' | 'management' | 'vlan';

/** Double-click on a device: identity, management access (encrypted credentials) and management VLAN. */
export function DeviceModal({ id }: { id: string }) {
  const { t } = useTranslation();
  const device = useTopology((s) => s.devices.find((d) => d.id === id));
  const { clients, sites, racks, links, devices } = useTopology();
  const edit = useCanEdit();
  const close = useUi((s) => s.close);
  const [tab, setTab] = useState<Tab>('identity');
  const [f, setF] = useState(() => ({
    name: device?.name ?? '', siteId: device?.siteId ?? '', type: (device?.type ?? 'switch') as DeviceType, model: device?.model ?? '', serial: device?.serial ?? '',
    role: (device?.role ?? '') as DeviceRole | '', portCount: String(device?.portCount ?? 0), portPrefix: device?.portPrefix ?? '',
    rackId: device?.rackId ?? '', rackPos: device?.rackPos ? String(device.rackPos) : '', rackUnits: String(device?.rackUnits ?? 1),
    mgmtIp: device?.mgmtIp ?? '', mgmtGateway: device?.mgmtGateway ?? '', mgmtPort: device?.mgmtPort ?? '', mgmtProtocols: (device?.mgmtProtocols ?? []) as MgmtProtocol[],
    mgmtUsername: device?.credentialsUsername ?? '', mgmtPassword: '', mgmtVlan: device?.mgmtVlan ? String(device.mgmtVlan) : '',
  }));
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const problems = useMemo(() => {
    const p: Partial<Record<'name' | 'mgmtIp' | 'mgmtGateway' | 'mgmtVlan' | 'portCount', string>> = {};
    if (!f.name.trim()) p.name = t('common.required');
    if (f.mgmtIp && !parseIpCidr(f.mgmtIp)) p.mgmtIp = t('modals.device.mgmtIpHint');
    if (f.mgmtGateway && !parseIpCidr(f.mgmtGateway)) p.mgmtGateway = t('modals.device.mgmtIpHint');
    if (f.mgmtVlan && !isValidVlan(Number(f.mgmtVlan))) p.mgmtVlan = '1–4094';
    const n = Number(f.portCount);
    if (!Number.isInteger(n) || n < 0 || n > 512) p.portCount = '0–512';
    return p;
  }, [f, t]);

  if (!device) return null;
  const clientName = clients.find((c) => c.id === device.clientId)?.name ?? '';
  const mine = links.filter((l) => l.sourceId === id || l.destId === id);
  const nameOf = (x: string) => devices.find((d) => d.id === x)?.name ?? '?';
  const invalid = Object.keys(problems).length > 0;
  const tabHasError = { identity: !!(problems.name || problems.portCount), management: !!(problems.mgmtIp || problems.mgmtGateway), vlan: !!problems.mgmtVlan };

  async function save() {
    if (invalid) return;
    setBusy(true);
    const r = await useTopology.getState().updateDevice(id, {
      name: f.name.trim(), siteId: f.siteId || null, type: f.type, model: f.model.trim() || null, serial: f.serial.trim() || null, role: f.role || null,
      portCount: Number(f.portCount), portPrefix: f.portPrefix.trim(),
      rackId: f.rackId || null, rackPos: f.rackId && f.rackPos ? Number(f.rackPos) : null, rackUnits: Number(f.rackUnits) || 1,
      mgmtIp: f.mgmtIp.trim() || null, mgmtGateway: f.mgmtGateway.trim() || null, mgmtPort: f.mgmtPort.trim() || null, mgmtProtocols: f.mgmtProtocols,
      mgmtVlan: f.mgmtVlan ? Number(f.mgmtVlan) : null, mgmtUsername: f.mgmtUsername.trim() || null,
      ...(f.mgmtPassword ? { mgmtPassword: f.mgmtPassword } : {}),
    });
    setBusy(false);
    if (r) close();
  }

  async function reveal() {
    try {
      const c = await api.devices.credentials(id);
      setShown(c.password ?? '');
    } catch (e) {
      useUi.getState().toast(errorText(e, (k) => t(k)), 'error');
    }
  }

  const err = (m?: string) => (m ? <span className="mt-1 block text-xs text-crit">{m}</span> : null);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'identity', label: t('modals.device.identity') + (tabHasError.identity ? ' •' : '') },
    { id: 'management', label: t('modals.device.management') + (tabHasError.management ? ' •' : '') },
    { id: 'vlan', label: t('modals.device.vlanMapping') + (tabHasError.vlan ? ' •' : '') },
  ];

  return (
    <Modal title={`${t('modals.device.title')} · ${device.name}`} onClose={close} width="max-w-2xl"
      footer={<><button className="nf-btn" onClick={close}>{t('common.cancel')}</button>{edit && <button className="nf-btn nf-btn-primary" disabled={busy || invalid} onClick={save}>{t('common.save')}</button>}</>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <fieldset disabled={!edit} className="min-w-0 border-0 p-0">
        {tab === 'identity' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('modals.device.name')}><input className="nf-input" value={f.name} onChange={(e) => set('name', e.target.value)} />{err(problems.name)}</Field>
            <Field label={t('modals.device.client')}><input className="nf-input" value={clientName} disabled /></Field>
            <Field label={t('modals.device.site')}>
              <select className="nf-input" value={f.siteId} onChange={(e) => set('siteId', e.target.value)}>
                <option value="">{t('sidebar.unassigned')}</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={t('modals.device.type')}>
              <select className="nf-input" value={f.type} onChange={(e) => set('type', e.target.value as DeviceType)}>{DEVICE_TYPES.map((x) => <option key={x} value={x}>{t(`deviceTypes.${x}`)}</option>)}</select>
            </Field>
            <Field label={t('modals.device.model')}><input className="nf-input" value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
            <Field label={t('modals.device.serial')}><input className="nf-input mono" value={f.serial} onChange={(e) => set('serial', e.target.value)} /></Field>
            <Field label={t('modals.device.role')}>
              <select className="nf-input" value={f.role} onChange={(e) => set('role', e.target.value as DeviceRole | '')}>
                <option value="">{t('common.none')}</option>{DEVICE_ROLES.map((x) => <option key={x} value={x}>{t(`deviceRoles.${x}`)}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('modals.device.portCount')}><input className="nf-input mono" inputMode="numeric" value={f.portCount} onChange={(e) => set('portCount', e.target.value)} />{err(problems.portCount)}</Field>
              <Field label={t('modals.device.portPrefix')}><input className="nf-input mono" value={f.portPrefix} onChange={(e) => set('portPrefix', e.target.value)} /></Field>
            </div>
            <p className="text-xs text-mute sm:col-span-2">{t('modals.device.portsHint')}</p>
            <Field label={t('rack.rackOf')}>
              <select className="nf-input" value={f.rackId} onChange={(e) => set('rackId', e.target.value)}>
                <option value="">{t('rack.notRacked')}</option>{racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('rack.position')}><input className="nf-input mono" inputMode="numeric" disabled={!f.rackId} placeholder="auto" value={f.rackPos} onChange={(e) => set('rackPos', e.target.value)} /></Field>
              <Field label={t('rack.height')}><input className="nf-input mono" inputMode="numeric" value={f.rackUnits} onChange={(e) => set('rackUnits', e.target.value)} /></Field>
            </div>
            {mine.length > 0 && (
              <div className="sm:col-span-2">
                <div className="mb-1 text-xs font-medium text-mute">{t('modals.device.connections')} ({mine.length})</div>
                <ul className="mono max-h-28 overflow-y-auto rounded border border-line bg-bg p-2 text-xs">
                  {mine.map((l) => {
                    const out = l.sourceId === id;
                    return <li key={l.id}>{out ? l.sourcePort : l.destPort} → {nameOf(out ? l.destId : l.sourceId)} ({out ? l.destPort : l.sourcePort}) · {l.mode}</li>;
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
        {tab === 'management' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('modals.device.mgmtIp')} hint={t('modals.device.mgmtIpHint')}><input className="nf-input mono" value={f.mgmtIp} onChange={(e) => set('mgmtIp', e.target.value)} />{err(problems.mgmtIp)}</Field>
            <Field label={t('modals.device.gateway')}><input className="nf-input mono" value={f.mgmtGateway} onChange={(e) => set('mgmtGateway', e.target.value)} />{err(problems.mgmtGateway)}</Field>
            <Field label={t('modals.device.mgmtPort')}><input className="nf-input mono" placeholder="MGMT, ETH0" value={f.mgmtPort} onChange={(e) => set('mgmtPort', e.target.value)} /></Field>
            <div>
              <span className="mb-1 block text-xs font-medium text-mute">{t('modals.device.protocols')}</span>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {MGMT_PROTOCOLS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={f.mgmtProtocols.includes(p)} onChange={(e) => set('mgmtProtocols', e.target.checked ? [...f.mgmtProtocols, p] : f.mgmtProtocols.filter((x) => x !== p))} />{p}
                  </label>
                ))}
              </div>
            </div>
            <fieldset className="rounded border border-line p-3 sm:col-span-2">
              <legend className="px-1 text-xs font-medium text-mute">{t('modals.device.credentials')} (AES-256-GCM)</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('modals.device.username')}><input className="nf-input mono" autoComplete="off" value={f.mgmtUsername} onChange={(e) => set('mgmtUsername', e.target.value)} /></Field>
                <Field label={t('modals.device.password')} hint={device.hasCredentials ? t('modals.device.passwordStored') : undefined}>
                  <input className="nf-input mono" type="password" autoComplete="new-password" value={f.mgmtPassword} onChange={(e) => set('mgmtPassword', e.target.value)} />
                </Field>
              </div>
              {device.hasCredentials && (
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" className="nf-btn" disabled={!edit} onClick={reveal}>{t('modals.device.revealPassword')}</button>
                  {shown !== null && <code className="mono rounded bg-bg px-2 py-1 select-all">{shown || '—'}</code>}
                </div>
              )}
            </fieldset>
          </div>
        )}
        {tab === 'vlan' && (
          <div className="max-w-xs">
            <Field label={t('modals.device.mgmtVlan')}><input className="nf-input mono" inputMode="numeric" placeholder="1–4094" value={f.mgmtVlan} onChange={(e) => set('mgmtVlan', e.target.value)} />{err(problems.mgmtVlan)}</Field>
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
