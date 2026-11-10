import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEVICE_TYPES, ROLES, VENDORS, generateClientConfig, generateDeviceConfig, type Revision, type Role, type User, type Vendor, type DeviceType,
} from '@netforge/shared';
import { api, errorText } from '../../lib/api';
import { createFromPreset } from '../../lib/devices';
import { safeName, saveFile } from '../../lib/platform';
import { useAuth } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { Field, Modal } from '../ui';

const toastErr = (e: unknown, t: (k: string) => string) => useUi.getState().toast(errorText(e, t), 'error');

/** Generic "type one text value" dialog (new client, new site, rename...). */
export function NameModal({ title, label, initial, onSubmit }: { title: string; label: string; initial: string; onSubmit: (v: string) => Promise<void> }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => { e.preventDefault(); if (!v.trim()) return; setBusy(true); await onSubmit(v.trim()); setBusy(false); close(); };
  return (
    <Modal title={title} onClose={close} width="max-w-sm">
      <form onSubmit={go} className="space-y-4">
        <Field label={label}><input className="nf-input" value={v} onChange={(e) => setV(e.target.value)} maxLength={100} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="nf-btn" onClick={close}>{t('common.cancel')}</button><button className="nf-btn nf-btn-primary" disabled={busy || !v.trim()}>{t('common.save')}</button></div>
      </form>
    </Modal>
  );
}

export function CustomDeviceModal({ pos }: { pos?: { x: number; y: number } }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [f, setF] = useState({ name: '', type: 'switch' as DeviceType, model: '', portCount: '24', portPrefix: 'Gi1/0/' });
  const n = Number(f.portCount);
  const ok = Number.isInteger(n) && n >= 0 && n <= 512;
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    await createFromPreset({ type: f.type, model: f.model || 'Custom', portCount: n, portPrefix: f.portPrefix, role: undefined }, pos ?? { x: 80, y: 80 }, f.name.trim() || undefined);
    close();
  };
  return (
    <Modal title={t('sidebar.customDevice')} onClose={close} width="max-w-md">
      <form onSubmit={go} className="space-y-3">
        <Field label={t('modals.device.name')} hint={t('common.optional')}><input className="nf-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('modals.device.type')}><select className="nf-input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DeviceType })}>{DEVICE_TYPES.map((x) => <option key={x} value={x}>{t(`deviceTypes.${x}`)}</option>)}</select></Field>
          <Field label={t('modals.device.model')}><input className="nf-input" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          <Field label={t('modals.device.portCount')}><input className="nf-input mono" inputMode="numeric" value={f.portCount} onChange={(e) => setF({ ...f, portCount: e.target.value })} /></Field>
          <Field label={t('modals.device.portPrefix')}><input className="nf-input mono" value={f.portPrefix} onChange={(e) => setF({ ...f, portPrefix: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-mute">{t('modals.device.portsHint')}</p>
        <div className="flex justify-end gap-2"><button type="button" className="nf-btn" onClick={close}>{t('common.cancel')}</button><button className="nf-btn nf-btn-primary" disabled={!ok}>{t('common.create')}</button></div>
      </form>
    </Modal>
  );
}

/** CLI configuration script (Cisco / Huawei / Arista), generated locally from the current schema. */
export function ConfigModal({ deviceId }: { deviceId?: string }) {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const { devices, links, clients, clientId } = useTopology();
  const [vendor, setVendor] = useState<Vendor>('cisco');
  const [scope, setScope] = useState<string>(deviceId ?? 'all');
  const text = useMemo(() => {
    if (scope === 'all') return generateClientConfig(vendor, devices, links);
    const d = devices.find((x) => x.id === scope);
    return d ? generateDeviceConfig(vendor, d, devices, links) : '';
  }, [vendor, scope, devices, links]);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? 'netforge';
  return (
    <Modal title={t('exports.config')} onClose={close} width="max-w-3xl"
      footer={<>
        <button className="nf-btn" onClick={() => { void navigator.clipboard?.writeText(text); useUi.getState().toast(t('common.copied')); }}>{t('common.copy')}</button>
        <button className="nf-btn nf-btn-primary" onClick={() => void saveFile(`${safeName(clientName)}-${vendor}.txt`, text, 'text/plain')}>{t('common.download')}</button>
      </>}>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label={t('exports.vendor')}><select className="nf-input" value={vendor} onChange={(e) => setVendor(e.target.value as Vendor)}>{VENDORS.map((v) => <option key={v} value={v}>{t(`exports.${v}`)}</option>)}</select></Field>
        <Field label={t('exports.scope')}>
          <select className="nf-input" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">{t('exports.allDevices')}</option>
            {devices.filter((d) => d.type !== 'client' && d.type !== 'server').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <pre className="mono max-h-[50vh] overflow-auto rounded border border-line bg-bg p-3 text-xs leading-relaxed">{text || t('common.noData')}</pre>
    </Modal>
  );
}

export function HistoryModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const clientId = useTopology((s) => s.clientId);
  const edit = useAuth((s) => s.user?.role !== 'viewer');
  const [list, setList] = useState<Revision[] | null>(null);
  const [note, setNote] = useState('');
  const load = () => { if (clientId) api.revisions.list(clientId).then((r) => setList(r.revisions)).catch((e) => toastErr(e, t)); };
  useEffect(load, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!clientId) return;
    try { await api.revisions.create(clientId, note.trim() || undefined); setNote(''); useUi.getState().toast(t('revisions.saved')); load(); } catch (e) { toastErr(e, t); }
  }
  const restore = (r: Revision) => useUi.getState().ask({
    title: t('revisions.restore'), message: t('revisions.restoreConfirm'), confirmLabel: t('revisions.restore'),
    onConfirm: async () => { try { await api.revisions.restore(r.id); await useTopology.getState().reload(); useUi.getState().toast(t('revisions.restored')); close(); } catch (e) { toastErr(e, t); } },
  });

  return (
    <Modal title={t('revisions.title')} onClose={close} width="max-w-lg">
      {edit && (
        <div className="mb-4 flex gap-2">
          <input className="nf-input" placeholder={t('revisions.note')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <button className="nf-btn nf-btn-primary shrink-0" onClick={save}>{t('revisions.save')}</button>
        </div>
      )}
      {list === null ? <p className="text-mute">{t('common.loading')}</p> : list.length === 0 ? <p className="text-mute">{t('revisions.empty')}</p> : (
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="truncate">{r.note || '—'}</div>
                <div className="text-xs text-mute">{new Date(r.createdAt).toLocaleString()}{r.authorName ? ` · ${t('revisions.by', { name: r.authorName })}` : ''}</div>
              </div>
              {edit && <button className="nf-btn shrink-0" onClick={() => restore(r)}>{t('revisions.restore')}</button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function UsersModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [n, setN] = useState({ email: '', name: '', password: '', role: 'technician' as Role });
  const load = () => api.users.list().then((r) => setUsers(r.users)).catch((e) => toastErr(e, t));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api.users.create(n); setN({ email: '', name: '', password: '', role: 'technician' }); await load(); } catch (err) { toastErr(err, t); }
  }
  const remove = (u: User) => {
    if (u.id === me?.id) return useUi.getState().toast(t('users.deleteSelf'), 'error');
    useUi.getState().ask({ title: t('common.delete'), message: t('common.deleteConfirm', { name: u.email }), danger: true, confirmLabel: t('common.delete'),
      onConfirm: async () => { try { await api.users.remove(u.id); await load(); } catch (e) { toastErr(e, t); } } });
  };
  const setRole = async (u: User, role: Role) => { try { await api.users.update(u.id, { role }); await load(); } catch (e) { toastErr(e, t); } };

  return (
    <Modal title={t('users.title')} onClose={close} width="max-w-2xl">
      <ul className="mb-4 divide-y divide-line">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{u.name}</div><div className="truncate text-xs text-mute">{u.email}</div></div>
            <select className="nf-input !w-auto" value={u.role} disabled={u.id === me?.id} onChange={(e) => void setRole(u, e.target.value as Role)} aria-label={t('users.role')}>{ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select>
            <button className="nf-btn nf-btn-danger" onClick={() => remove(u)}>{t('common.delete')}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2">
        <input className="nf-input" type="email" required placeholder={t('users.email')} value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} />
        <input className="nf-input" required placeholder={t('users.name')} value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="nf-input" type="password" required minLength={8} autoComplete="new-password" placeholder={t('users.password')} value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} />
        <select className="nf-input" value={n.role} onChange={(e) => setN({ ...n, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}</select>
        <button className="nf-btn nf-btn-primary sm:col-span-2">{t('users.add')}</button>
      </form>
    </Modal>
  );
}

export function PasswordModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    try { const r = await api.auth.changePassword(cur, next); useAuth.getState().setSession(r.token, useAuth.getState().user!); useUi.getState().toast(t('auth.passwordChanged')); close(); } catch (err) { toastErr(err, t); }
  };
  return (
    <Modal title={t('auth.changePassword')} onClose={close} width="max-w-sm">
      <form onSubmit={go} className="space-y-3">
        <Field label={t('auth.currentPassword')}><input className="nf-input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
        <Field label={t('auth.newPassword')}><input className="nf-input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="nf-btn" onClick={close}>{t('common.cancel')}</button><button className="nf-btn nf-btn-primary">{t('common.save')}</button></div>
      </form>
    </Modal>
  );
}

interface Hit { key: string; label: string; sub: string; run: () => void }

/** Ctrl+P: devices (name/IP/model/serial), ports of cables, sites and clients. Enter jumps to the match. */
export function SearchModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const { devices, links, sites, clients } = useTopology();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(s));
    const focus = (kind: 'device' | 'link', id: string) => () => { useTopology.getState().requestFocus(kind, id); close(); };
    const out: Hit[] = [];
    for (const d of devices) if (has(d.name, d.mgmtIp, d.model, d.serial, d.mgmtPort)) out.push({ key: `d${d.id}`, label: d.name, sub: [d.mgmtIp, d.model, t(`deviceTypes.${d.type}`)].filter(Boolean).join(' · '), run: focus('device', d.id) });
    const name = (id: string) => devices.find((d) => d.id === id)?.name ?? '?';
    for (const l of links) if (has(l.sourcePort, l.destPort)) out.push({ key: `l${l.id}`, label: `${name(l.sourceId)} ${l.sourcePort} ↔ ${name(l.destId)} ${l.destPort}`, sub: l.mode, run: focus('link', l.id) });
    for (const x of sites) if (has(x.name)) out.push({ key: `s${x.id}`, label: x.name, sub: t('sidebar.sites'), run: () => { useTopology.getState().setActiveSite(x.id); close(); } });
    for (const c of clients) if (has(c.name)) out.push({ key: `c${c.id}`, label: c.name, sub: t('sidebar.clients'), run: () => { void useTopology.getState().selectClient(c.id); close(); } });
    return out.slice(0, 40);
  }, [q, devices, links, sites, clients, t, close]);

  useEffect(() => setI(0), [q]);
  useEffect(() => { listRef.current?.children[i]?.scrollIntoView({ block: 'nearest' }); }, [i]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    else if (e.key === 'Enter') { hits[i]?.run(); }
  };

  return (
    <Modal title={t('common.search')} onClose={close} width="max-w-xl">
      <input className="nf-input" autoFocus placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} aria-label={t('common.search')} />
      <ul ref={listRef} className="mt-3 max-h-[45vh] overflow-y-auto" role="listbox">
        {q && hits.length === 0 && <li className="p-2 text-sm text-mute">{t('search.noResults')}</li>}
        {hits.map((h, idx) => (
          <li key={h.key} role="option" aria-selected={idx === i}>
            <button className={`block w-full rounded px-2 py-1.5 text-left ${idx === i ? 'bg-raised' : 'hover:bg-raised/60'}`} onMouseEnter={() => setI(idx)} onClick={h.run}>
              <div className="truncate text-sm">{h.label}</div><div className="mono truncate text-xs text-mute">{h.sub}</div>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
