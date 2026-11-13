import { BaseEdge, EdgeLabelRenderer, useStore, type EdgeProps } from 'reactflow';
import type { Link } from '@infra-tech/shared';
import { formatVlanList } from '@infra-tech/shared';

export interface CableEdgeData {
  link: Link;
  index: number;
  count: number;
  severity: 'critical' | 'warning' | 'info' | null;
  dim: boolean;
}

interface Box { x: number; y: number; w: number; h: number }

/** Point where the line from this box's centre towards `other` leaves the box (floating edges: no fixed handle needed). */
function edgePoint(a: Box, b: Box) {
  const w = a.w / 2, h = a.h / 2;
  const ax = a.x + w, ay = a.y + h;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return { x: ax, y: ay };
  const s = 1 / Math.max(Math.abs(dx) / w, Math.abs(dy) / h);
  return { x: ax + dx * s, y: ay + dy * s };
}

const quad = (p0: number, p1: number, p2: number, t: number) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

export function CableEdge({ id, source, target, data, selected }: EdgeProps<CableEdgeData>) {
  const sn = useStore((s) => s.nodeInternals.get(source));
  const tn = useStore((s) => s.nodeInternals.get(target));
  if (!sn || !tn || !data || !sn.positionAbsolute || !tn.positionAbsolute || !sn.width || !sn.height || !tn.width || !tn.height) return null;
  const { link, index, count, severity, dim } = data;

  const a: Box = { x: sn.positionAbsolute.x, y: sn.positionAbsolute.y, w: sn.width, h: sn.height };
  const b: Box = { x: tn.positionAbsolute.x, y: tn.positionAbsolute.y, w: tn.width, h: tn.height };
  const trunk = link.mode === 'trunk';
  const fiber = link.medium === 'fiber';
  // The wire itself shows the cable type (black = Ethernet, orange = fibre); the VLAN chip shows the mode.
  const wire = fiber ? 'rgb(var(--fiber))' : 'rgb(var(--eth))';
  const color = severity === 'critical' ? 'rgb(var(--crit))' : trunk ? 'rgb(var(--trunk))' : 'rgb(var(--access))';

  let path: string;
  let p1: { x: number; y: number }, p2: { x: number; y: number }, mid: { x: number; y: number };
  let sx: number, sy: number, tx: number, ty: number;

  if (source === target) {
    // Loop on the same device: a small arc above its top-right corner.
    sx = a.x + a.w - 24; sy = a.y; tx = a.x + a.w; ty = a.y + 22;
    const r = 34 + index * 12;
    path = `M ${sx} ${sy} C ${sx} ${sy - r}, ${tx + r} ${ty - r}, ${tx} ${ty}`;
    mid = { x: tx + r * 0.6, y: sy - r * 0.6 };
    p1 = { x: sx, y: sy - 12 }; p2 = { x: tx + 14, y: ty };
  } else {
    const s0 = edgePoint(a, b);
    const t0 = edgePoint(b, a);
    const dx = t0.x - s0.x, dy = t0.y - s0.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = (index - (count - 1) / 2) * 34; // parallel cables fan out instead of overlapping
    const nx = -dy / len, ny = dx / len;
    const cx = (s0.x + t0.x) / 2 + nx * off * 2, cy = (s0.y + t0.y) / 2 + ny * off * 2;
    sx = s0.x; sy = s0.y; tx = t0.x; ty = t0.y;
    path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
    mid = { x: quad(sx, cx, tx, 0.5), y: quad(sy, cy, ty, 0.5) };
    p1 = { x: quad(sx, cx, tx, 0.17), y: quad(sy, cy, ty, 0.17) };
    p2 = { x: quad(sx, cx, tx, 0.83), y: quad(sy, cy, ty, 0.83) };
  }

  const vlan = trunk ? `${link.nativeVlan ? `n${link.nativeVlan}` : ''}${link.taggedVlans.length ? ` +${formatVlanList(link.taggedVlans)}` : ''}`.trim() || 'trunk' : link.accessVlan ? `v${link.accessVlan}` : '?';
  const tag = 'mono pointer-events-none absolute whitespace-nowrap rounded-[3px] border bg-panel px-1 py-px text-[10px] leading-none';
  const place = (p: { x: number; y: number }) => ({ transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)` });

  return (
    <g style={{ opacity: dim ? 0.25 : 1 }}>
      {/* A thin light halo keeps the black Ethernet cable readable on the dark theme. */}
      <path d={path} fill="none" stroke="rgb(var(--eth-halo))" strokeOpacity={fiber ? 0 : 0.55} strokeWidth={(trunk ? 3 : 2) + (selected ? 2 : 0) + 3} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
      <BaseEdge id={id} path={path} interactionWidth={18}
        style={{ stroke: wire, strokeWidth: (trunk ? 3 : 2) + (selected ? 2 : 0), strokeDasharray: severity === 'critical' ? '6 4' : undefined }} />
      <EdgeLabelRenderer>
        <div className={tag} style={{ ...place(p1), borderColor: wire, color: 'rgb(var(--ink))' }}>{link.sourcePort}</div>
        <div className={tag} style={{ ...place(p2), borderColor: wire, color: 'rgb(var(--ink))' }}>{link.destPort}</div>
        <div className={`${tag} font-medium`} style={{ ...place(mid), borderColor: color, background: color, color: '#10151c', outline: selected ? '2px solid rgb(var(--ink))' : undefined }}>{fiber ? '⌁ ' : ''}{vlan}</div>
      </EdgeLabelRenderer>
    </g>
  );
}
