import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEVICE_COLORS, canPlace, connectionsOf, usedUnits, type Device, type Rack } from '@nial-infra/shared';
import { useCanEdit, useIsAdmin } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';

const U_H = 22; // pixel height of one rack unit

/** Colour swatch of a cable: black = Ethernet, orange = fibre (a light ring keeps black visible on the dark theme). */
export const CableSwatch = ({ medium }: { medium: 'ethernet' | 'fiber' }) => (
  <span aria-hidden className="inline-block h-1.5 w-5 shrink-0 rounded-full ring-1 ring-[rgb(var(--eth-halo))]/60" style={{ background: medium === 'fiber' ? 'rgb(var(--fiber))' : 'rgb(var(--eth))' }} />
);

/**
 * Rack view: the same devices and cables as the schema, drawn the way they are mounted.
 * Drag a device (or pick it then click a free slot) to place it; cross-rack cables are flagged.
 */
export function RackView() {
  const { t } = useTranslation();
  const edit = useCanEdit();
  const admin = useIsAdmin();
  const { racks, devices, links, sites, activeSiteId, clientId } = useTopology();
  const [selected, setSelected] = useState<string | null>(null); // device picked in the list or in a rack
  const rackName = useMemo(() => new Map(racks.map((r) => [r.id, r.name])), [racks]);
  const visibleRacks = racks.filter((r) => !activeSiteId || r.siteId === activeSiteId || !r.siteId);
  const unplaced = devices.filter((d) => !d.rackId && (!activeSiteId || d.siteId === activeSiteId));
  const sel = devices.find((d) => d.id === selected) ?? null;
  const conns = useMemo(() => (sel ? connectionsOf(sel, devices, links, racks) : []), [sel, devices, links, racks]);

  const ask = (title: string, label: string, initial: string, onSubmit: (v: string) => Promise<void>) => useUi.getState().open({ kind: 'name', title, label, initial, onSubmit });
  const addRack = () => ask(t('rack.addRack'), t('rack.rackName'), `${t('rack.rackOf')} ${racks.length + 1}`, async (v) => { await useTopology.getState().addRack(v, 42, activeSiteId); });

  async function place(deviceId: string, rack: Rack, pos: number) {
    const d = devices.find((x) => x.id === deviceId);
    if (!d || !edit) return;
    if (!canPlace(rack, devices, d.id, pos, d.rackUnits)) { useUi.getState().toast(t('rack.overlap'), 'error'); return; }
    await useTopology.getState().updateDevice(d.id, { rackId: rack.id, rackPos: pos, rackUnits: d.rackUnits });
    setSelected(null);
  }
  const unrack = (d: Device) => useTopology.getState().updateDevice(d.id, { rackId: null, rackPos: null });

  if (!clientId) return null;
  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Devices that are not in any rack yet */}
      <aside className="max-h-52 shrink-0 overflow-y-auto border-b border-line bg-panel p-3 md:max-h-none md:w-60 md:border-b-0 md:border-r" aria-label={t('rack.unplaced')}>
        <h2 className="text-sm font-semibold">{t('rack.unplaced')} <span className="mono text-xs text-mute">{unplaced.length}</span></h2>
        {edit && <p className="mb-2 text-xs text-mute">{t('rack.dragHint')}</p>}
        <ul className="space-y-1">
          {unplaced.map((d) => (
            <li key={d.id}>
              <button draggable={edit} onDragStart={(e) => { e.dataTransfer.setData('application/nial-infra-device', d.id); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => setSelected(selected === d.id ? null : d.id)}
                className={`flex w-full items-center justify-between rounded border bg-bg px-2 py-1.5 text-left text-[13px] ${selected === d.id ? 'border-access' : 'border-line hover:border-mute'}`}>
                <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: DEVICE_COLORS[d.type] }} /><span className="truncate">{d.name}</span></span>
                <span className="mono text-[11px] text-mute">{d.rackUnits}U</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">{t('rack.racks')}</h2>
          {admin || edit ? <button className="nf-btn" onClick={addRack}><Plus size={14} />{t('rack.addRack')}</button> : null}
          <span className="ml-auto flex items-center gap-3 text-xs text-mute"><span className="flex items-center gap-1"><CableSwatch medium="ethernet" />{t('modals.cable.ethernet')}</span><span className="flex items-center gap-1"><CableSwatch medium="fiber" />{t('modals.cable.fiber')}</span></span>
        </div>
        {visibleRacks.length === 0 && <p className="text-sm text-mute">{t('rack.noRack')}</p>}

        <div className="flex items-start gap-6">
          {visibleRacks.map((rack) => {
            const inRack = devices.filter((d) => d.rackId === rack.id && d.rackPos != null);
            const leaving = inRack.flatMap((d) => connectionsOf(d, devices, links, racks).filter((c) => c.crossRack && (c.link.sourceId === d.id)).map((c) => ({ d, c })));
            // Cables whose other end is in this rack also count, so each cable shows once per rack it touches.
            const incoming = inRack.flatMap((d) => connectionsOf(d, devices, links, racks).filter((c) => c.crossRack && c.link.destId === d.id).map((c) => ({ d, c })));
            const crossing = [...leaving, ...incoming];
            return (
              <section key={rack.id} className="shrink-0" style={{ width: 250 }} aria-label={rack.name}>
                <header className="mb-1 flex items-center gap-1">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{rack.name}</div><div className="mono text-[11px] text-mute">{t('rack.used', { used: usedUnits(rack, devices), total: rack.units })}{rack.siteId ? ` · ${sites.find((s) => s.id === rack.siteId)?.name ?? ''}` : ''}</div></div>
                  {edit && (
                    <>
                      <button className="nf-btn nf-btn-ghost !p-1" title={t('rack.renameRack')} aria-label={t('rack.renameRack')} onClick={() => ask(t('rack.renameRack'), t('rack.rackName'), rack.name, async (v) => { await useTopology.getState().updateRack(rack.id, { name: v }); })}><Pencil size={13} /></button>
                      <button className="nf-btn nf-btn-ghost !p-1" title={t('rack.units')} aria-label={t('rack.units')} onClick={() => ask(t('rack.units'), t('rack.units'), String(rack.units), async (v) => { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 60) await useTopology.getState().updateRack(rack.id, { units: n }); })}><span className="mono text-[11px]">{rack.units}U</span></button>
                      <button className="nf-btn nf-btn-ghost nf-btn-danger !p-1" title={t('rack.deleteRack')} aria-label={t('rack.deleteRack')} onClick={() => useUi.getState().ask({ title: t('rack.deleteRack'), message: t('common.deleteConfirm', { name: rack.name }), danger: true, confirmLabel: t('common.delete'), onConfirm: () => useTopology.getState().removeRack(rack.id) })}><Trash2 size={13} /></button>
                    </>
                  )}
                </header>

                {/* The rack itself: U1 at the bottom, like on site */}
                <div className="relative rounded-md border-2 border-line bg-bg" style={{ height: rack.units * U_H }}>
                  {Array.from({ length: rack.units }, (_, i) => rack.units - i).map((u) => {
                    const ok = !!selected && !!sel && canPlace(rack, devices, sel.id, u, sel.rackUnits);
                    return (
                      <div key={u} data-slot={u} style={{ height: U_H }}
                        className={`flex items-center border-b border-line/50 text-[10px] text-mute ${ok ? 'cursor-pointer hover:bg-access/20' : ''}`}
                        onClick={() => { if (selected && edit) void place(selected, rack, u); }}
                        onDragOver={(e) => { if (edit) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('application/nial-infra-device'); if (id) void place(id, rack, u); }}>
                        <span className="mono w-6 select-none text-right pr-1">{u}</span>
                      </div>
                    );
                  })}
                  {inRack.map((d) => {
                    const cs = connectionsOf(d, devices, links, racks);
                    const cross = cs.filter((c) => c.crossRack);
                    const h = d.rackUnits * U_H;
                    return (
                      <button key={d.id} draggable={edit}
                        onDragStart={(e) => { e.dataTransfer.setData('application/nial-infra-device', d.id); e.dataTransfer.effectAllowed = 'move'; }}
                        onClick={(e) => { e.stopPropagation(); setSelected(selected === d.id ? null : d.id); }}
                        onDoubleClick={() => useUi.getState().open({ kind: 'device', id: d.id })}
                        title={`${d.name} · U${d.rackPos}${d.rackUnits > 1 ? `–${d.rackPos! + d.rackUnits - 1}` : ''}`}
                        className={`absolute left-6 right-1 flex items-center gap-1.5 overflow-hidden rounded-[3px] border px-1.5 text-left text-xs ${selected === d.id ? 'border-access ring-1 ring-access' : 'border-line'}`}
                        style={{ bottom: (d.rackPos! - 1) * U_H + 1, height: h - 2, background: `color-mix(in srgb, ${DEVICE_COLORS[d.type]} 22%, rgb(var(--panel)))`, borderLeft: `4px solid ${DEVICE_COLORS[d.type]}` }}>
                        <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                        {cross.length > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 rounded bg-panel px-1 text-[10px]" title={t('rack.crossRack')}>
                            {cross.slice(0, 3).map((c) => <CableSwatch key={c.link.id} medium={c.link.medium} />)}↗{cross.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 text-xs">
                  <div className="mb-1 font-medium text-mute">{t('rack.cablesOut')}</div>
                  {crossing.length === 0 ? <p className="text-mute">{t('rack.none')}</p> : (
                    <ul className="space-y-1">
                      {crossing.map(({ d, c }) => (
                        <li key={`${d.id}-${c.link.id}`} className="flex items-center gap-1.5">
                          <CableSwatch medium={c.link.medium} />
                          <span className="mono truncate">{d.name}:{c.localPort} → {c.remote.name}:{c.remotePort}</span>
                          <span className="ml-auto shrink-0 rounded border border-line px-1 text-[10px] text-mute">{c.remoteRack?.name ?? t('rack.notRacked')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Details of the selected device: where each of its cables goes */}
        {sel && (
          <div className="mt-6 max-w-2xl rounded-md border border-line bg-panel p-3 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">{sel.name}</span>
              <span className="mono text-xs text-mute">{sel.rackId ? `${rackName.get(sel.rackId) ?? '?'} · U${sel.rackPos}` : t('rack.notRacked')}</span>
              <span className="ml-auto flex gap-2">
                {edit && sel.rackId && <button className="nf-btn" onClick={() => void unrack(sel)}>{t('rack.removeFromRack')}</button>}
                <button className="nf-btn" onClick={() => useUi.getState().open({ kind: 'device', id: sel.id })}>{t('common.edit')}</button>
              </span>
            </div>
            <div className="mb-1 text-xs font-medium text-mute">{t('rack.connections')} ({conns.length})</div>
            {conns.length === 0 ? <p className="text-xs text-mute">—</p> : (
              <ul className="space-y-1">
                {conns.map((c) => (
                  <li key={c.link.id} className="flex items-center gap-2 text-xs">
                    <CableSwatch medium={c.link.medium} />
                    <span className="mono">{c.localPort}</span><span className="text-mute">{t('rack.plugged')}</span>
                    <span className="font-medium">{c.remote.name}</span><span className="mono text-mute">({c.remotePort})</span>
                    <span className={`ml-auto rounded border px-1 text-[10px] ${c.crossRack ? 'border-warn text-warn' : 'border-line text-mute'}`}>
                      {c.crossRack ? `${t('rack.crossRack')}: ${c.remoteRack?.name ?? t('rack.notRacked')}` : t('rack.sameRack')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
