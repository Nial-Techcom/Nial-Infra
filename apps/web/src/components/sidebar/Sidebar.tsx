import { Cable, Pencil, Plus, Trash2 } from 'lucide-react';
import { useReactFlow } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { DEVICE_COLORS, DEVICE_LIBRARY, DEVICE_TYPES, type DevicePreset } from '@netforge/shared';
import { canvasCenter, createFromPreset } from '../../lib/devices';
import { canEdit, isAdmin, useAuth } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';

export function Sidebar() {
  const { t } = useTranslation();
  const rf = useReactFlow();
  const user = useAuth((s) => s.user);
  const edit = canEdit(user);
  const admin = isAdmin(user);
  const { clients, clientId, sites, devices, activeSiteId } = useTopology();
  const ui = useUi.getState;
  let stagger = 0;

  const askName = (title: string, label: string, initial: string, onSubmit: (v: string) => Promise<void>) => ui().open({ kind: 'name', title, label, initial, onSubmit });
  const confirmDelete = (name: string, fn: () => Promise<void>) => ui().ask({ title: t('common.delete'), message: t('common.deleteConfirm', { name }), danger: true, confirmLabel: t('common.delete'), onConfirm: fn });
  const addAtCenter = (p: DevicePreset) => { void createFromPreset(p, canvasCenter(rf, stagger++)); };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel" aria-label={t('sidebar.clients')}>
      <section className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('sidebar.clients')}</h2>
          {admin && <button className="nf-btn nf-btn-ghost !p-1" title={t('sidebar.newClient')} aria-label={t('sidebar.newClient')} onClick={() => askName(t('sidebar.newClient'), t('sidebar.clientName'), '', (v) => useTopology.getState().createClient(v))}><Plus size={16} /></button>}
        </div>
        {clients.length === 0 && <p className="text-sm text-mute">{t('sidebar.noClient')}</p>}
        <ul className="space-y-0.5">
          {clients.map((c) => {
            const active = c.id === clientId;
            return (
              <li key={c.id}>
                <div className={`group flex items-center rounded ${active ? 'bg-raised' : 'hover:bg-raised/60'}`}>
                  <button className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left ${active ? 'font-semibold' : ''}`} onClick={() => void useTopology.getState().selectClient(c.id)}>{c.name}</button>
                  {admin && active && (
                    <span className="flex pr-1">
                      <button className="nf-btn nf-btn-ghost !p-1" title={t('sidebar.renameClient')} aria-label={t('sidebar.renameClient')} onClick={() => askName(t('sidebar.renameClient'), t('sidebar.clientName'), c.name, (v) => useTopology.getState().renameClient(c.id, v))}><Pencil size={13} /></button>
                      <button className="nf-btn nf-btn-ghost nf-btn-danger !p-1" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => confirmDelete(c.name, () => useTopology.getState().deleteClient(c.id))}><Trash2 size={13} /></button>
                    </span>
                  )}
                </div>
                {active && (
                  <ul className="mb-1 ml-3 border-l border-line pl-2">
                    {sites.map((s) => {
                      const n = devices.filter((d) => d.siteId === s.id).length;
                      return (
                        <li key={s.id} className="group flex items-center">
                          <button className={`min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-[13px] ${activeSiteId === s.id ? 'bg-access/20 text-ink' : 'text-mute hover:text-ink'}`} onClick={() => useTopology.getState().setActiveSite(activeSiteId === s.id ? null : s.id)}>
                            {s.name} <span className="mono text-[11px]">{n}</span>
                          </button>
                          {admin && <button className="nf-btn nf-btn-ghost nf-btn-danger !p-1 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={t('common.delete')} onClick={() => confirmDelete(s.name, () => useTopology.getState().deleteSite(s.id))}><Trash2 size={12} /></button>}
                        </li>
                      );
                    })}
                    {devices.some((d) => !d.siteId) && sites.length > 0 && <li className="px-2 py-1 text-[13px] text-mute">{t('sidebar.unassigned')} <span className="mono text-[11px]">{devices.filter((d) => !d.siteId).length}</span></li>}
                    {admin && <li><button className="px-2 py-1 text-[13px] text-mute hover:text-ink" onClick={() => askName(t('sidebar.newSite'), t('sidebar.siteName'), '', (v) => useTopology.getState().createSite(v))}>+ {t('sidebar.newSite')}</button></li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="p-3">
        <h2 className="mb-1 text-sm font-semibold">{t('sidebar.devices')}</h2>
        <p className="mb-2 text-xs text-mute">{edit ? t('sidebar.dragHint') : t('common.readOnly')}</p>
        {DEVICE_TYPES.map((type) => (
          <div key={type} className="mb-2">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-mute"><span className="h-2 w-2 rounded-sm" style={{ background: DEVICE_COLORS[type] }} />{t(`deviceTypes.${type}`)}</div>
            <div className="grid grid-cols-1 gap-1">
              {DEVICE_LIBRARY.filter((p) => p.type === type).map((p) => (
                <button key={p.key} disabled={!edit || !clientId} draggable={edit && !!clientId}
                  onDragStart={(e) => { e.dataTransfer.setData('application/netforge-preset', p.key); e.dataTransfer.effectAllowed = 'copy'; }}
                  onClick={() => addAtCenter(p)}
                  className="flex cursor-grab items-center justify-between rounded border border-line bg-bg px-2 py-1.5 text-left text-[13px] hover:border-mute active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="truncate">{p.label}</span><span className="mono text-[11px] text-mute">{p.portCount}p</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="nf-btn mt-1 w-full" disabled={!edit || !clientId} onClick={() => ui().open({ kind: 'custom-device' })}><Cable size={14} />{t('sidebar.customDevice')}</button>
      </section>
    </aside>
  );
}
