import { CheckCircle2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { alertMessage, type Locale } from '@netforge/shared';
import { useAlerts } from '../../lib/useAlerts';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { SeverityDot } from '../ui';

export function AlertsPanel() {
  const { t, i18n } = useTranslation();
  const { alerts, counts } = useAlerts();
  const setOpen = useUi((s) => s.setAlertsOpen);
  const locale = (i18n.resolvedLanguage === 'fr' ? 'fr' : 'en') as Locale;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-panel" aria-label={t('alerts.title')}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h2 className="text-sm font-semibold">{t('alerts.title')}</h2>
        <div className="flex items-center gap-3 text-xs text-mute">
          <span className="flex items-center gap-1"><SeverityDot type="critical" />{counts.critical}</span>
          <span className="flex items-center gap-1"><SeverityDot type="warning" />{counts.warning}</span>
          <span className="flex items-center gap-1"><SeverityDot type="info" />{counts.info}</span>
          <button className="nf-btn nf-btn-ghost !p-1" onClick={() => setOpen(false)} aria-label={t('common.close')}><X size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-sm text-mute"><CheckCircle2 size={16} className="text-ok" />{t('alerts.none')}</p>
        ) : (
          <ul>
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  className="flex w-full items-start gap-2 border-b border-line/60 px-3 py-2 text-left text-sm hover:bg-raised"
                  onClick={() => { const s = useTopology.getState(); if (a.linkId) s.requestFocus('link', a.linkId); else if (a.deviceId) s.requestFocus('device', a.deviceId); }}
                >
                  <span className="mt-1.5"><SeverityDot type={a.type} /></span>
                  <span>
                    <span className="block text-xs text-mute">{t(`alerts.${a.type}`)} · {a.rule}</span>
                    {alertMessage(locale, a)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
