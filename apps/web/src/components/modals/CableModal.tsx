import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { devicePorts, formatVlanList, isValidVlan, parseVlanList, type Device, type LinkMedium, type LinkMode } from '@netforge/shared';
import { useCanEdit } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { Field, Modal } from '../ui';

function PortSelect({ device, value, onChange, taken, label }: { device: Device | undefined; value: string; onChange: (v: string) => void; taken: Set<string>; label: string }) {
  const ports = device ? devicePorts(device) : [];
  return (
    <Field label={label}>
      <input className="nf-input mono" list={`ports-${device?.id}-${label}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={ports[0]} />
      <datalist id={`ports-${device?.id}-${label}`}>{ports.map((p) => <option key={p} value={p}>{taken.has(p) ? '• in use' : ''}</option>)}</datalist>
    </Field>
  );
}

/** Opens right after drawing a cable (draft) or when double-clicking an existing one (linkId). */
export function CableModal({ linkId, draft }: { linkId?: string; draft?: { sourceId: string; destId: string } }) {
  const { t } = useTranslation();
  const { devices, links } = useTopology();
  const edit = useCanEdit();
  const close = useUi((s) => s.close);
  const existing = linkId ? links.find((l) => l.id === linkId) : undefined;
  const sourceId = existing?.sourceId ?? draft?.sourceId ?? '';
  const destId = existing?.destId ?? draft?.destId ?? '';
  const src = devices.find((d) => d.id === sourceId);
  const dst = devices.find((d) => d.id === destId);

  const used = (deviceId: string) => new Set(links.filter((l) => l.id !== linkId).flatMap((l) => [l.sourceId === deviceId ? l.sourcePort : '', l.destId === deviceId ? l.destPort : '']).filter(Boolean));
  const firstFree = (d?: Device, other?: string) => (d ? devicePorts(d).find((p) => !used(d.id).has(p) && p !== other) ?? '' : '');

  const [f, setF] = useState(() => ({
    sourcePort: existing?.sourcePort ?? firstFree(src), destPort: existing?.destPort ?? firstFree(dst),
    mode: (existing?.mode ?? 'access') as LinkMode, medium: (existing?.medium ?? 'ethernet') as LinkMedium,
    nativeVlan: existing?.nativeVlan ? String(existing.nativeVlan) : '', destNativeVlan: existing?.destNativeVlan ? String(existing.destNativeVlan) : '',
    tagged: existing ? formatVlanList(existing.taggedVlans) : '', accessVlan: existing?.accessVlan ? String(existing.accessVlan) : '',
  }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  if (!src || !dst) return null;
  const vlanOk = (s: string) => !s || isValidVlan(Number(s));
  const trunk = f.mode === 'trunk';
  const invalid = !f.sourcePort.trim() || !f.destPort.trim() || !vlanOk(f.nativeVlan) || !vlanOk(f.destNativeVlan) || !vlanOk(f.accessVlan);

  async function save() {
    if (invalid) return;
    setBusy(true);
    const body = {
      sourcePort: f.sourcePort.trim(), destPort: f.destPort.trim(), mode: f.mode, medium: f.medium,
      nativeVlan: trunk && f.nativeVlan ? Number(f.nativeVlan) : null,
      destNativeVlan: trunk && f.destNativeVlan ? Number(f.destNativeVlan) : null,
      taggedVlans: trunk ? parseVlanList(f.tagged) : [],
      accessVlan: !trunk && f.accessVlan ? Number(f.accessVlan) : null,
    };
    const s = useTopology.getState();
    const r = existing ? await s.updateLink(existing.id, body) : await s.addLink({ sourceId, destId, ...body });
    setBusy(false);
    if (r) close();
  }

  const remove = () => existing && useUi.getState().ask({
    title: t('canvas.removeCable'), message: t('common.deleteConfirm', { name: `${src.name} ↔ ${dst.name}` }), danger: true, confirmLabel: t('common.delete'),
    onConfirm: async () => { await useTopology.getState().removeLinks([existing.id]); close(); },
  });

  return (
    <Modal title={`${t('modals.cable.title')} · ${src.name} ↔ ${dst.name}`} onClose={close}
      footer={<>
        {existing && edit && <button className="nf-btn nf-btn-danger mr-auto" onClick={remove}>{t('common.delete')}</button>}
        <button className="nf-btn" onClick={close}>{t('common.cancel')}</button>
        {edit && <button className="nf-btn nf-btn-primary" disabled={busy || invalid} onClick={save}>{t('common.save')}</button>}
      </>}>
      <fieldset disabled={!edit} className="min-w-0 space-y-3 border-0 p-0">
        <div className="grid grid-cols-2 gap-3">
          <PortSelect device={src} value={f.sourcePort} onChange={(v) => set('sourcePort', v)} taken={used(src.id)} label={`${t('modals.cable.sourcePort')} (${src.name})`} />
          <PortSelect device={dst} value={f.destPort} onChange={(v) => set('destPort', v)} taken={used(dst.id)} label={`${t('modals.cable.destPort')} (${dst.name})`} />
        </div>
        <Field label={t('modals.cable.medium')}>
          <div className="flex gap-4 pt-1">
            {(['ethernet', 'fiber'] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="radio" name="medium" checked={f.medium === m} onChange={() => set('medium', m)} />
                <span className="inline-block h-1.5 w-6 rounded-full border border-line" style={{ background: m === 'fiber' ? 'rgb(var(--fiber))' : 'rgb(var(--eth))' }} aria-hidden />
                {t(`modals.cable.${m}`)}
              </label>
            ))}
          </div>
        </Field>
        <Field label={t('modals.cable.mode')}>
          <div className="flex gap-4 pt-1">
            {(['access', 'trunk'] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5"><input type="radio" name="mode" checked={f.mode === m} onChange={() => set('mode', m)} />{t(`modals.cable.${m}`)}</label>
            ))}
          </div>
        </Field>
        {trunk ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('modals.cable.nativeVlan')}><input className="nf-input mono" inputMode="numeric" value={f.nativeVlan} onChange={(e) => set('nativeVlan', e.target.value)} /></Field>
              <Field label={t('modals.cable.destNativeVlan')} hint={t('modals.cable.sameAsSource')}><input className="nf-input mono" inputMode="numeric" value={f.destNativeVlan} onChange={(e) => set('destNativeVlan', e.target.value)} /></Field>
            </div>
            <Field label={t('modals.cable.taggedVlans')} hint={t('modals.cable.taggedHint')}><input className="nf-input mono" value={f.tagged} onChange={(e) => set('tagged', e.target.value)} /></Field>
          </>
        ) : (
          <Field label={t('modals.cable.accessVlan')}><input className="nf-input mono" inputMode="numeric" value={f.accessVlan} onChange={(e) => set('accessVlan', e.target.value)} /></Field>
        )}
      </fieldset>
    </Modal>
  );
}
