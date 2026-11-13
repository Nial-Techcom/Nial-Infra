import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEVICE_ROLES, DEVICE_TYPES, type AdminSettings, type DeviceRole, type DeviceType, type LibraryItem } from '@infra-tech/shared';
import { api, errorText } from '../../lib/api';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { Field, Modal, Tabs } from '../ui';

type Tab = 'general' | 'catalog';
const toastErr = (e: unknown, t: (k: string) => string) => useUi.getState().toast(errorText(e, t), 'error');

function General() {
  const { t } = useTranslation();
  const [s, setS] = useState<AdminSettings | null>(null);
  const [pw, setPw] = useState('');
  const [clearPw, setClearPw] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.admin.settings().then(setS).catch((e) => toastErr(e, t)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="text-sm text-mute">…</p>;
  const setSmtp = (p: Partial<AdminSettings['smtp']>) => setS({ ...s, smtp: { ...s.smtp, ...p } });

  async function save() {
    if (!s) return;
    setBusy(true);
    try {
      const { hasPassword: _h, ...smtp } = s.smtp;
      const r = await api.admin.updateSettings({ publicUrl: s.publicUrl, allowRegistration: s.allowRegistration, smtp: { ...smtp, ...(clearPw ? { password: '' } : pw ? { password: pw } : {}) } });
      setS(r); setPw(''); setClearPw(false);
      useUi.getState().toast(t('admin.saved'));
    } catch (e) { toastErr(e, t); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try { await save(); await api.admin.testSmtp(testTo); useUi.getState().toast(t('admin.testSent')); } catch (e) { toastErr(e, t); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t('admin.general')}</h3>
        <Field label={t('admin.publicUrl')} hint={t('admin.publicUrlHint')}><input className="nf-input mono" inputMode="url" placeholder="https://infra-tech.example.com" value={s.publicUrl} onChange={(e) => setS({ ...s, publicUrl: e.target.value })} /></Field>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.allowRegistration} onChange={(e) => setS({ ...s, allowRegistration: e.target.checked })} />{t('admin.allowRegistration')}</label>
      </section>
      <section className="space-y-3 border-t border-line pt-4">
        <div><h3 className="text-sm font-semibold">{t('admin.smtp')}</h3><p className="text-xs text-mute">{t('admin.smtpHelp')}</p></div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('admin.host')} className="col-span-2"><input className="nf-input mono" placeholder="smtp.example.com" value={s.smtp.host} onChange={(e) => setSmtp({ host: e.target.value })} /></Field>
          <Field label={t('admin.port')}><input className="nf-input mono" inputMode="numeric" value={s.smtp.port} onChange={(e) => setSmtp({ port: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.smtp.secure} onChange={(e) => setSmtp({ secure: e.target.checked, port: e.target.checked ? 465 : s.smtp.port === 465 ? 587 : s.smtp.port })} />{t('admin.secure')}</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t('admin.smtpUser')}><input className="nf-input mono" autoComplete="off" value={s.smtp.user} onChange={(e) => setSmtp({ user: e.target.value })} /></Field>
          <Field label={t('admin.smtpPassword')} hint={s.smtp.hasPassword && !clearPw ? t('admin.smtpPasswordKept') : undefined}>
            <input className="nf-input mono" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
        </div>
        {s.smtp.hasPassword && <label className="flex items-center gap-2 text-xs text-mute"><input type="checkbox" checked={clearPw} onChange={(e) => setClearPw(e.target.checked)} />{t('common.delete')} : {t('admin.smtpPassword')}</label>}
        <Field label={t('admin.from')} hint={t('admin.fromHint')}><input className="nf-input" value={s.smtp.from} onChange={(e) => setSmtp({ from: e.target.value })} /></Field>
        <div className="flex items-end gap-2">
          <Field label={t('admin.testTo')} className="flex-1"><input className="nf-input" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></Field>
          <button className="nf-btn" disabled={busy || !testTo || !s.smtp.host || !s.smtp.from} onClick={test}>{t('admin.test')}</button>
        </div>
      </section>
      <div className="flex justify-end"><button className="nf-btn nf-btn-primary" disabled={busy} onClick={save}>{t('common.save')}</button></div>
    </div>
  );
}

const EMPTY = { label: '', type: 'switch' as DeviceType, model: '', portCount: '24', portPrefix: 'Gi1/0/', role: '' as DeviceRole | '', rackUnits: '1' };

function Catalog() {
  const { t } = useTranslation();
  const items = useTopology((s) => s.library);
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const n = Number(f.portCount), u = Number(f.rackUnits);
  const ok = f.label.trim() && f.model.trim() && Number.isInteger(n) && n >= 0 && n <= 512 && Number.isInteger(u) && u >= 1 && u <= 48;
  const reload = () => useTopology.getState().loadLibrary();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const body = { label: f.label.trim(), type: f.type, model: f.model.trim(), portCount: n, portPrefix: f.portPrefix.trim(), role: f.role || null, rackUnits: u };
    try { editing ? await api.library.update(editing, body) : await api.library.create(body); setF(EMPTY); setEditing(null); await reload(); } catch (err) { toastErr(err, t); }
  }
  const edit = (i: LibraryItem) => { setEditing(i.id); setF({ label: i.label, type: i.type, model: i.model, portCount: String(i.portCount), portPrefix: i.portPrefix, role: i.role ?? '', rackUnits: String(i.rackUnits) }); };
  const remove = (i: LibraryItem) => useUi.getState().ask({ title: t('common.delete'), message: t('common.deleteConfirm', { name: i.label }), danger: true, confirmLabel: t('common.delete'),
    onConfirm: async () => { try { await api.library.remove(i.id); await reload(); } catch (e) { toastErr(e, t); } } });

  return (
    <div>
      <p className="mb-3 text-xs text-mute">{t('admin.libraryHelp')}</p>
      {items.length === 0 ? <p className="mb-4 text-sm text-mute">{t('admin.libraryEmpty')}</p> : (
        <ul className="mb-4 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{i.label}</div><div className="mono truncate text-xs text-mute">{t(`deviceTypes.${i.type}`)} · {i.model} · {i.portCount}p · {i.rackUnits}U</div></div>
              <button className="nf-btn" onClick={() => edit(i)}>{t('common.edit')}</button>
              <button className="nf-btn nf-btn-danger" onClick={() => remove(i)}>{t('common.delete')}</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <h3 className="col-span-2 text-sm font-semibold">{t('admin.libraryAdd')}</h3>
        <Field label={t('admin.label')}><input className="nf-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label={t('modals.device.model')}><input className="nf-input" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
        <Field label={t('modals.device.type')}><select className="nf-input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DeviceType })}>{DEVICE_TYPES.map((x) => <option key={x} value={x}>{t(`deviceTypes.${x}`)}</option>)}</select></Field>
        <Field label={t('modals.device.role')}><select className="nf-input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as DeviceRole | '' })}><option value="">{t('common.none')}</option>{DEVICE_ROLES.map((x) => <option key={x} value={x}>{t(`deviceRoles.${x}`)}</option>)}</select></Field>
        <Field label={t('modals.device.portCount')}><input className="nf-input mono" inputMode="numeric" value={f.portCount} onChange={(e) => setF({ ...f, portCount: e.target.value })} /></Field>
        <Field label={t('modals.device.portPrefix')}><input className="nf-input mono" value={f.portPrefix} onChange={(e) => setF({ ...f, portPrefix: e.target.value })} /></Field>
        <Field label={t('admin.units')}><input className="nf-input mono" inputMode="numeric" value={f.rackUnits} onChange={(e) => setF({ ...f, rackUnits: e.target.value })} /></Field>
        <div className="col-span-2 flex justify-end gap-2">
          {editing && <button type="button" className="nf-btn" onClick={() => { setEditing(null); setF(EMPTY); }}>{t('common.cancel')}</button>}
          <button className="nf-btn nf-btn-primary" disabled={!ok}>{editing ? t('common.save') : t('common.create')}</button>
        </div>
      </form>
    </div>
  );
}

/** Administration panel: server-wide settings (public address, registration, SMTP) and the equipment catalog. */
export function AdminModal() {
  const { t } = useTranslation();
  const close = useUi((s) => s.close);
  const [tab, setTab] = useState<Tab>('general');
  return (
    <Modal title={t('admin.title')} onClose={close} width="max-w-2xl">
      <Tabs tabs={[{ id: 'general', label: `${t('admin.general')} · SMTP` }, { id: 'catalog', label: t('admin.library') }]} value={tab} onChange={setTab} />
      {tab === 'general' ? <General /> : <Catalog />}
    </Modal>
  );
}
