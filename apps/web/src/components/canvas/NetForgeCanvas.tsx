import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, MiniMap, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { DEVICE_COLORS, DEVICE_LIBRARY, type Alert } from '@netforge/shared';
import { createFromPreset, findPreset } from '../../lib/devices';
import { useAlerts } from '../../lib/useAlerts';
import { useCanEdit } from '../../store/auth';
import { useTopology } from '../../store/topology';
import { useUi } from '../../store/ui';
import { CableEdge, type CableEdgeData } from './CableEdge';
import { DeviceNode, type DeviceNodeData } from './DeviceNode';

const nodeTypes = { device: DeviceNode };
const edgeTypes = { cable: CableEdge };
const RANK = { critical: 3, warning: 2, info: 1 } as const;

function worst(alerts: Alert[]): 'critical' | 'warning' | 'info' | null {
  let best: 'critical' | 'warning' | 'info' | null = null;
  for (const a of alerts) if (!best || RANK[a.type] > RANK[best]) best = a.type;
  return best;
}

export function NetForgeCanvas() {
  const { t } = useTranslation();
  const rf = useReactFlow();
  const { devices, links, sites, racks, library, activeSiteId, focus, clientId, moveDevice } = useTopology();
  const { alerts } = useAlerts();
  const editable = useCanEdit();
  const theme = useUi((s) => s.theme);
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CableEdgeData>([]);

  // Devices -> nodes. Selection is carried over so editing a device does not drop it.
  useEffect(() => {
    const siteName = new Map(sites.map((s) => [s.id, s.name]));
    const rackName = new Map(racks.map((r) => [r.id, r.name]));
    const used = new Map<string, Record<string, 'access' | 'trunk'>>();
    for (const l of links) {
      for (const [id, port] of [[l.sourceId, l.sourcePort], [l.destId, l.destPort]] as const) used.set(id, { ...(used.get(id) ?? {}), [port]: l.mode });
    }
    setNodes((prev) => {
      const sel = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      return devices.map<Node<DeviceNodeData>>((d) => ({
        id: d.id, type: 'device', position: { x: d.x, y: d.y }, selected: sel.has(d.id),
        data: {
          device: d, usedPorts: used.get(d.id) ?? {}, severity: worst(alerts.filter((a) => a.deviceId === d.id)),
          dim: !!activeSiteId && d.siteId !== activeSiteId, siteName: d.siteId ? siteName.get(d.siteId) ?? null : null, editable,
          rackLabel: d.rackId && d.rackPos ? `${rackName.get(d.rackId) ?? '?'} U${d.rackPos}` : null,
        },
      }));
    });
  }, [devices, links, sites, racks, alerts, activeSiteId, editable, setNodes]);

  // Links -> edges (parallel cables between the same pair get an index so they fan out).
  useEffect(() => {
    const byPair = new Map<string, string[]>();
    for (const l of links) {
      const k = [l.sourceId, l.destId].sort().join('|');
      byPair.set(k, [...(byPair.get(k) ?? []), l.id]);
    }
    const dev = new Map(devices.map((d) => [d.id, d]));
    setEdges((prev) => {
      const sel = new Set(prev.filter((e) => e.selected).map((e) => e.id));
      return links.map<Edge<CableEdgeData>>((l) => {
        const group = byPair.get([l.sourceId, l.destId].sort().join('|')) ?? [l.id];
        const dimmed = !!activeSiteId && dev.get(l.sourceId)?.siteId !== activeSiteId && dev.get(l.destId)?.siteId !== activeSiteId;
        return {
          id: l.id, source: l.sourceId, target: l.destId, type: 'cable', selected: sel.has(l.id),
          data: { link: l, index: group.indexOf(l.id), count: group.length, severity: worst(alerts.filter((a) => a.linkId === l.id)), dim: dimmed },
        };
      });
    });
  }, [links, devices, alerts, activeSiteId, setEdges]);

  // Fit the view when another client is opened.
  useEffect(() => {
    const id = setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 250 }), 80);
    return () => clearTimeout(id);
  }, [clientId, rf]);

  // Search / alert clicks ask the canvas to focus an element.
  useEffect(() => {
    if (!focus) return;
    if (focus.kind === 'device') {
      setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === focus.id })));
      setEdges((es) => es.map((e) => ({ ...e, selected: false })));
      rf.fitView({ nodes: [{ id: focus.id }], padding: 1.2, maxZoom: 1.2, duration: 400 });
    } else {
      const l = links.find((x) => x.id === focus.id);
      if (!l) return;
      setEdges((es) => es.map((e) => ({ ...e, selected: e.id === focus.id })));
      setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
      rf.fitView({ nodes: [{ id: l.sourceId }, { id: l.destId }], padding: 0.5, maxZoom: 1.2, duration: 400 });
    }
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback((c: Connection) => {
    if (!editable || !c.source || !c.target) return;
    useUi.getState().open({ kind: 'cable', draft: { sourceId: c.source, destId: c.target } });
  }, [editable]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('application/netforge-preset');
    const preset = findPreset(key, library, DEVICE_LIBRARY);
    if (!preset || !editable) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    void createFromPreset(preset, { x: p.x - 95, y: p.y - 30 });
  }, [rf, editable, library]);

  const askDelete = useCallback(() => {
    if (!editable) return;
    const nodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
    const linkIds = edges.filter((e) => e.selected).map((e) => e.id);
    if (!nodeIds.length && !linkIds.length) return;
    const names = nodeIds.map((id) => devices.find((d) => d.id === id)?.name).filter(Boolean).join(', ');
    useUi.getState().ask({
      title: t('canvas.deleteSelection'),
      message: t('common.deleteConfirm', { name: names || `${linkIds.length} ${t('canvas.links')}` }),
      danger: true, confirmLabel: t('common.delete'),
      onConfirm: async () => {
        if (nodeIds.length) await useTopology.getState().removeDevices(nodeIds);
        if (linkIds.length) await useTopology.getState().removeLinks(linkIds.filter((id) => links.some((l) => l.id === id)));
      },
    });
  }, [nodes, edges, devices, links, editable, t]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable || useUi.getState().modal || useUi.getState().confirm) return;
      askDelete();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [askDelete]);

  const miniColor = useMemo(() => (n: Node<DeviceNodeData>) => DEVICE_COLORS[n.data.device.type], []);

  return (
    <div className="relative h-full w-full" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onNodeDragStop={(_, n) => void moveDevice(n.id, Math.round(n.position.x), Math.round(n.position.y))}
        onSelectionDragStop={(_, ns) => ns.forEach((n) => void moveDevice(n.id, Math.round(n.position.x), Math.round(n.position.y)))}
        onNodeDoubleClick={(_, n) => useUi.getState().open({ kind: 'device', id: n.id })}
        onEdgeDoubleClick={(_, e) => useUi.getState().open({ kind: 'cable', linkId: e.id })}
        nodesDraggable={editable} nodesConnectable={editable} deleteKeyCode={null} multiSelectionKeyCode="Shift"
        minZoom={0.15} maxZoom={2} snapToGrid snapGrid={[10, 10]} proOptions={{ hideAttribution: true }} fitView
      >
        <Background variant={BackgroundVariant.Lines} gap={40} color={theme === 'dark' ? '#1d2630' : '#dfe4ea'} lineWidth={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={miniColor} maskColor={theme === 'dark' ? 'rgba(10,14,19,.65)' : 'rgba(236,239,243,.7)'} />
      </ReactFlow>
      {devices.length === 0 && clientId && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs text-center text-mute">
            <p className="text-base text-ink">{t('canvas.empty')}</p>
            <p className="mt-1 text-sm">{t('canvas.connectHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
