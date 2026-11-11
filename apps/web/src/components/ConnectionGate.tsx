import { useTranslation } from 'react-i18next';
import { getServerUrl, isDesktop } from '../lib/platform';
import { useAuth } from '../store/auth';
import { useConnection } from '../store/connection';

/**
 * Blocks the whole app while the server cannot be reached. NetForge has no offline mode:
 * nothing is kept on the device, so there is nothing to work on without the server.
 */
export function ConnectionGate() {
  const { t } = useTranslation();
  const online = useConnection((s) => s.online);
  const checking = useConnection((s) => s.checking);
  const signedIn = useAuth((s) => !!s.token);
  if (online || !signedIn) return null;
  const server = isDesktop ? getServerUrl() : window.location.origin;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="nf-conn-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-6 text-center shadow-2xl">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line text-xl" aria-hidden>⚡</div>
        <h2 id="nf-conn-title" className="text-lg font-semibold">{t('conn.title')}</h2>
        <p className="mt-2 text-sm text-mute">{t('conn.body')}</p>
        {server && <p className="mono mt-3 break-all text-xs text-mute">{t('conn.server')} : {server}</p>}
        <p className="mt-3 text-xs text-mute" aria-live="polite">{checking ? t('conn.checking') : ''}&nbsp;</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button className="nf-btn nf-btn-primary" disabled={checking} onClick={() => void useConnection.getState().check()}>{t('conn.retry')}</button>
          {isDesktop && <button className="nf-btn" onClick={() => { useConnection.setState({ online: true }); useAuth.getState().logout(); }}>{t('conn.changeServer')}</button>}
        </div>
      </div>
    </div>
  );
}
