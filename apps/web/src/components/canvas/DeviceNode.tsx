import { Handle, Position, type NodeProps } from 'reactflow';
import { Monitor, Network, Router, Server, Shield, Wifi, type LucideIcon } from 'lucide-react';
import { DEVICE_COLORS, devicePorts, type Device, type DeviceType, type LinkMode } from '@infra-tech/shared';

export interface DeviceNodeData {
  device: Device;
  usedPorts: Record<string, LinkMode>;
  severity: 'critical' | 'warning' | 'info' | null;
  dim: boolean;
  siteName: string | null;
  rackLabel?: string | null;
  editable: boolean;
}

const ICONS: Record<DeviceType, LucideIcon> = { firewall: Shield, switch: Network, router: Router, server: Server, access_point: Wifi, client: Monitor };
const MAX_LEDS = 48;

/** A device drawn as a rack faceplate: one LED per port, lit with the colour of the cable plugged into it. */
export function DeviceNode({ data, selected }: NodeProps<DeviceNodeData>) {
  const { device: d, usedPorts, severity, dim, siteName, rackLabel, editable } = data;
  const Icon = ICONS[d.type];
  const ports = devicePorts({ portCount: d.portCount, portPrefix: d.portPrefix });
  const shown = ports.slice(0, MAX_LEDS);
  const extraUsed = Object.keys(usedPorts).filter((p) => !ports.includes(p)).length;
  const ring = severity === 'critical' ? 'border-crit' : severity === 'warning' ? 'border-warn' : selected ? 'border-access' : 'border-line';

  return (
    <div className={`group relative w-[190px] rounded-md border bg-panel text-ink shadow-md transition-opacity ${ring} ${dim ? 'opacity-30' : ''}`} style={{ borderLeft: `4px solid ${DEVICE_COLORS[d.type]}` }}>
      <Handle type="target" position={Position.Top} className="nf-fill-handle" isConnectableStart={false} />
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <Icon size={16} style={{ color: DEVICE_COLORS[d.type] }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{d.name}</div>
          <div className="mono truncate text-[11px] leading-tight text-mute">{d.mgmtIp ?? d.model ?? '—'}</div>
        </div>
        {severity && <span className={`h-2.5 w-2.5 rounded-full ${severity === 'critical' ? 'bg-crit' : severity === 'warning' ? 'bg-warn' : 'bg-info'}`} title={severity} />}
      </div>
      {shown.length > 0 && (
        <div className="mx-2.5 mb-2 mt-2 flex flex-wrap gap-[3px] rounded-sm bg-bg p-1.5" aria-hidden>
          {shown.map((p) => {
            const m = usedPorts[p];
            return <span key={p} title={p} className="h-[7px] w-[7px] rounded-[1px]" style={{ background: m === 'trunk' ? 'rgb(var(--trunk))' : m === 'access' ? 'rgb(var(--access))' : 'rgb(var(--line))' }} />;
          })}
          {ports.length > MAX_LEDS && <span className="mono ml-1 text-[9px] leading-[7px] text-mute">+{ports.length - MAX_LEDS}</span>}
        </div>
      )}
      <div className="flex items-center justify-between px-2.5 pb-1.5 text-[10px] text-mute">
        <span className="truncate">{[siteName, rackLabel].filter(Boolean).join(' · ')}</span>
        <span className="mono">{Object.keys(usedPorts).length + extraUsed}/{d.portCount}</span>
      </div>
      {editable && <Handle type="source" position={Position.Right} className="!opacity-0 transition-opacity group-hover:!opacity-100" style={{ right: -6 }} />}
    </div>
  );
}
