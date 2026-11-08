import { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { DEVICE_COLORS, formatVlanList } from '@netforge/shared';
import { useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Button, Muted } from '../ui';

const W = 150, H = 46, PAD = 40;

/** Read-only view of the schema using the x/y saved from the web or desktop designer. Tap a device to open it. */
export function Diagram({ onDevice, onLink }: { onDevice: (id: string) => void; onLink: (id: string) => void }) {
  const t = useT();
  const c = useTheme();
  const { devices, links } = useTopology();
  const { width } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  const box = useMemo(() => {
    if (!devices.length) return { x: 0, y: 0, w: 300, h: 300 };
    const xs = devices.map((d) => d.x), ys = devices.map((d) => d.y);
    const x = Math.min(...xs) - PAD, y = Math.min(...ys) - PAD;
    return { x, y, w: Math.max(...xs) + W + PAD - x, h: Math.max(...ys) + H + PAD - y };
  }, [devices]);

  if (!devices.length) return <View style={{ padding: 16 }}><Muted>{t('canvas.empty')}</Muted></View>;
  const base = Math.min(1, (width - 8) / box.w);
  const scale = base * zoom;
  const byId = new Map(devices.map((d) => [d.id, d]));
  const center = (id: string) => { const d = byId.get(id)!; return { x: d.x + W / 2, y: d.y + H / 2 }; };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 8, alignItems: 'center' }}>
        <Button title="−" onPress={() => setZoom((z) => Math.max(0.5, z - 0.25))} style={{ minWidth: 48 }} />
        <Button title="+" onPress={() => setZoom((z) => Math.min(3, z + 0.25))} style={{ minWidth: 48 }} />
        <Muted>{t('mobile.tapDevice')}</Muted>
      </View>
      <ScrollView horizontal><ScrollView>
        <Svg width={box.w * scale} height={box.h * scale} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
          {links.filter((l) => byId.has(l.sourceId) && byId.has(l.destId)).map((l) => {
            const a = center(l.sourceId), b = center(l.destId);
            const label = l.mode === 'trunk' ? (l.taggedVlans.length ? formatVlanList(l.taggedVlans) : 'trunk') : l.accessVlan ? `v${l.accessVlan}` : '?';
            return (
              <G key={l.id} onPress={() => onLink(l.id)}>
                <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={22} />
                <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.mode === 'trunk' ? c.trunk : c.access} strokeWidth={l.mode === 'trunk' ? 3 : 2} />
                <SvgText x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} fill={c.ink} fontSize={11} textAnchor="middle">{label}</SvgText>
              </G>
            );
          })}
          {devices.map((d) => (
            <G key={d.id} onPress={() => onDevice(d.id)}>
              <Rect x={d.x} y={d.y} width={W} height={H} rx={6} fill={c.panel} stroke={DEVICE_COLORS[d.type]} strokeWidth={2} />
              <SvgText x={d.x + W / 2} y={d.y + 20} fill={c.ink} fontSize={13} fontWeight="600" textAnchor="middle">{d.name.slice(0, 20)}</SvgText>
              <SvgText x={d.x + W / 2} y={d.y + 36} fill={c.mute} fontSize={10} textAnchor="middle">{d.mgmtIp ?? d.model ?? ''}</SvgText>
            </G>
          ))}
        </Svg>
      </ScrollView></ScrollView>
    </View>
  );
}
