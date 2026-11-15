import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { licenseRequestMailto, type LicenseStatus } from '@nial-infra/shared';
import { api, errorText } from '../lib/api';
import { useLicense } from '../store/license';
import { useUi } from '../store/ui';
import { Field } from './ui';

/** Request / install a licence. Used by the Administration modal and by the blocking screen. */
export function LicensePanel({ onChange }: { onChange?: () => void }) {
  const { t } = useTranslation();
  const [s, setS] = useState<LicenseStatus | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => useUi.getState().toast(errorText(e, t), 'error');
  useEffect(() => { api.license.get().then((r) => setS(r.license)).catch(fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s) return <p className="text-sm text-mute">…</p>;

  const apply = (l: LicenseStatus) => { setS(l); void useLicense.getState().refresh(); onChange?.(); };
  async function install() {
    setBusy(true);
    try { apply((await api.license.import(text.trim())).license); setText(''); useUi.getState().toast(t('license.installed')); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function recheck() {
    setBusy(true);
    try { apply((await api.license.check()).license); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  const mail = licenseRequestMailto(s.contact, t('license.mailSubject'), t('license.mailBody', { id: s.installationId }));
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : t('license.never'));

  return (
    <div className="space-y-4">
      <div className="rounded border border-line p-3 text-sm">
        <p className="font-semibold">
          {s.state === 'trial' ? t('license.trial', { n: s.daysLeft ?? 0 }) : s.state === 'licensed' ? t('license.licensed') : t('license.blocked')}
        </p>
        {s.state === 'blocked' && s.reason && <p className="mt-1 text-mute">{t(`license.reason_${s.reason}`)}</p>}
        {s.license && (
          <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-mute">{t('license.customer')}</dt><dd>{s.license.customer} · {s.license.email}</dd>
            <dt className="text-mute">{t('license.expires')}</dt><dd>{day(s.license.expiresAt)}</dd>
            <dt className="text-mute">{t('license.lastCheck')}</dt><dd>{s.verifiedAt ? new Date(s.verifiedAt).toLocaleString() : '—'}</dd>
          </dl>
        )}
        {s.state === 'trial' && <p className="mt-1 text-xs text-mute">{t('license.trialEnds')} : {day(s.trialEndsAt)}</p>}
        {s.license && <button className="nf-btn mt-2" disabled={busy} onClick={recheck}>{t('license.recheck')}</button>}
      </div>

      <Field label={t('license.installationId')}>
        <div className="flex gap-2">
          <input className="nf-input mono flex-1" readOnly value={s.installationId} onFocus={(e) => e.currentTarget.select()} />
          <button className="nf-btn" onClick={() => { void navigator.clipboard?.writeText(s.installationId); useUi.getState().toast(t('license.copied')); }}>⧉</button>
        </div>
      </Field>
      <div>
        <a className="nf-btn nf-btn-primary inline-block" href={mail}>{t('license.request')}</a>
        <p className="mt-1 text-xs text-mute">{t('license.requestHelp', { contact: s.contact })}</p>
      </div>
      <Field label={t('license.paste')}>
        <textarea className="nf-input mono h-24 text-xs" placeholder={t('license.pastePlaceholder')} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <button className="nf-btn nf-btn-primary" disabled={busy || !text.trim()} onClick={install}>{t('license.import')}</button>
    </div>
  );
}
