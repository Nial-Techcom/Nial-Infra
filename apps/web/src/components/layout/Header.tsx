import { ChevronDown, Download, Network, Server, Settings, History, Languages, LogOut, Moon, PanelLeft, Search, Sun, Users, KeyRound, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { exportCsv, exportPdf, exportShmnlt, importShmnlt } from '../../lib/exports';
import { exportDiagram } from '../../lib/exportImage';
import { useAlerts } from '../../lib/useAlerts';
import { useCanEdit, useIsAdmin, useAuth } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { SeverityDot } from '../ui';

function Menu({ label, icon, children, align = 'right' }: { label: ReactNode; icon?: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', away); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button className="nf-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{icon}{label}<ChevronDown size={13} /></button>
      {open && <div role="menu" className={`absolute z-40 mt-1 min-w-56 rounded-md border border-line bg-panel py-1 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
const Item = ({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) => (
  <button role="menuitem" className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-raised ${danger ? 'text-crit' : ''}`} onClick={onClick}>{children}</button>
);

export function Header() {
  const { t, i18n } = useTranslation();
  const rf = useReactFlow();
  const user = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const { clients, clientId, selectClient } = useTopology();
  const { counts } = useAlerts();
  const ui = useUi();
  const edit = useCanEdit();
  const admin = useIsAdmin();
  const clientName = clients.find((c) => c.id === clientId)?.name ?? 'diagram';
  const lang = i18n.resolvedLanguage === 'fr' ? 'fr' : 'en';

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
      <button className="nf-btn nf-btn-ghost !p-1.5 lg:hidden" aria-label="Menu" onClick={() => ui.setSidebarOpen(!ui.sidebarOpen)}><PanelLeft size={18} /></button>
      <div className="flex items-center gap-2 pr-2">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="6" fill="rgb(var(--bg))" stroke="rgb(var(--line))" /><path d="M6 22h6v-6h8v-6h6" stroke="rgb(var(--trunk))" strokeWidth="3" fill="none" strokeLinejoin="round" /></svg>
        <span className="font-semibold tracking-tight">Nial-Infra</span>
      </div>
      <select className="nf-input !w-auto max-w-[14rem]" value={clientId ?? ''} onChange={(e) => void selectClient(e.target.value || null)} aria-label={t('modals.device.client')}>
        {clients.length === 0 && <option value="">{t('sidebar.selectClient')}</option>}
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {/* Schema and Rack: two views of the same client data */}
      <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border border-line">
        {(['schema', 'rack'] as const).map((v) => (
          <button key={v} aria-pressed={ui.view === v} onClick={() => ui.setView(v)} className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm ${ui.view === v ? 'bg-access text-white' : 'bg-panel text-mute hover:text-ink'}`}>
            {v === 'schema' ? <Network size={14} /> : <Server size={14} />}<span className="hidden sm:inline">{t(v === 'schema' ? 'rack.viewSchema' : 'rack.viewRack')}</span>
          </button>
        ))}
      </div>
      <button className="nf-btn text-mute" onClick={() => ui.open({ kind: 'search' })} aria-label={t('common.search')}>
        <Search size={14} /><span className="hidden md:inline">{t('common.search')}</span><kbd className="mono hidden rounded border border-line px-1 text-[10px] md:inline">{t('search.hint')}</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 text-xs text-mute xl:flex" aria-label={t('modals.cable.medium')}>
          <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-5 rounded-full ring-1 ring-[rgb(var(--eth-halo))]/60" style={{ background: 'rgb(var(--eth))' }} />Ethernet</span>
          <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-5 rounded-full" style={{ background: 'rgb(var(--fiber))' }} />{lang === 'fr' ? 'Fibre' : 'Fibre'}</span>
        </span>
        <button className="nf-btn" onClick={() => ui.setAlertsOpen(!ui.alertsOpen)} aria-pressed={ui.alertsOpen} aria-label={t('alerts.title')}>
          <TriangleAlert size={14} />
          <span className="flex items-center gap-2 text-xs"><span className="flex items-center gap-1"><SeverityDot type="critical" />{counts.critical}</span><span className="flex items-center gap-1"><SeverityDot type="warning" />{counts.warning}</span><span className="hidden items-center gap-1 sm:flex"><SeverityDot type="info" />{counts.info}</span></span>
        </button>
        <Menu icon={<Download size={14} />} label={<span className="hidden sm:inline">{t('exports.title')}</span>}>
          {(close) => (
            <>
              <Item onClick={() => { close(); void exportCsv(); }}>{t('exports.csv')}</Item>
              <Item onClick={() => { close(); void exportPdf(); }}>{t('exports.pdf')}</Item>
              <Item onClick={() => { close(); void exportDiagram(rf, 'png', clientName, ui.theme === 'dark'); }}>{t('exports.png')}</Item>
              <Item onClick={() => { close(); void exportDiagram(rf, 'svg', clientName, ui.theme === 'dark'); }}>{t('exports.svg')}</Item>
              <Item onClick={() => { close(); ui.open({ kind: 'config' }); }}>{t('exports.config')}</Item>
              <div className="my-1 border-t border-line" />
              <Item onClick={() => { close(); void exportShmnlt(); }}>{t('exports.shmnlt')}</Item>
              {edit && <Item onClick={() => { close(); void importShmnlt(); }}>{t('exports.importShmnlt')}</Item>}
            </>
          )}
        </Menu>
        <button className="nf-btn" onClick={() => ui.open({ kind: 'history' })} disabled={!clientId} aria-label={t('revisions.title')} title={t('revisions.title')}><History size={14} /></button>
        <button className="nf-btn" onClick={() => i18n.changeLanguage(lang === 'fr' ? 'en' : 'fr')} aria-label={t('common.language')} title={t('common.language')}><Languages size={14} />{lang.toUpperCase()}</button>
        <button className="nf-btn" onClick={ui.toggleTheme} aria-label={t('common.theme')} title={t('common.theme')}>{ui.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
        <Menu label={<span className="max-w-[8rem] truncate">{user.name}</span>}>
          {(close) => (
            <>
              <div className="px-3 py-1.5 text-xs text-mute">{user.email}<br />{t(`roles.${user.role}`)}</div>
              <div className="my-1 border-t border-line" />
              {admin && <Item onClick={() => { close(); ui.open({ kind: 'admin' }); }}><Settings size={14} />{t('admin.title')}</Item>}
              {admin && <Item onClick={() => { close(); ui.open({ kind: 'users' }); }}><Users size={14} />{t('users.title')}</Item>}
              <Item onClick={() => { close(); ui.open({ kind: 'password' }); }}><KeyRound size={14} />{t('auth.changePassword')}</Item>
              <Item danger onClick={() => { close(); logout(); }}><LogOut size={14} />{t('common.logout')}</Item>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}
