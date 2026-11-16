import { useTranslation } from 'react-i18next';
import { useAuth } from '../store/auth';
import { useLicense } from '../store/license';
import { LicensePanel } from './LicensePanel';

/** Blocks the app once the trial is over and no valid licence is installed. Data stays untouched on the server. */
export function LicenseGate() {
  const { t } = useTranslation();
  const summary = useLicense((s) => s.summary);
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  if (!token || !user || summary?.state !== 'blocked') return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="nf-lic-title" className="fixed inset-0 z-[90] flex items-center justify-center overflow-auto bg-bg/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-2xl">
        <h2 id="nf-lic-title" className="text-lg font-semibold">{t('license.blockedTitle')}</h2>
        <p className="mt-2 text-sm text-mute">{t('license.blockedBody')}</p>
        {user.role === 'admin' ? (
          <div className="mt-4"><LicensePanel /></div>
        ) : (
          <>
            {summary.reason && <p className="mt-2 text-sm">{t(`license.reason_${summary.reason}`)}</p>}
            <p className="mt-3 text-sm">{t('license.adminOnlyBody')}</p>
            <button className="nf-btn mt-4" onClick={() => useAuth.getState().logout()}>{t('conn.signOut')}</button>
          </>
        )}
      </div>
    </div>
  );
}
