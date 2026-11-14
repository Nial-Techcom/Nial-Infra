import { FlatList, Text, View } from 'react-native';
import { DEVICE_COLORS, connectionsOf, usedUnits } from '@nial-infra/shared';
import { useT, useTopology } from '../store';
import { useTheme } from '../theme';
import { Card, Muted } from '../ui';

const Swatch = ({ fiber }: { fiber: boolean }) => (
  <View style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: fiber ? '#F28C28' : '#111111', borderWidth: 1, borderColor: '#C8D0DC' }} />
);

/** Read-only rack view: devices from the top U down, with the cables that leave the rack. */
export function Racks({ onDevice }: { onDevice: (id: string) => void }) {
  const t = useT();
  const c = useTheme();
  const { racks, devices, links } = useTopology();
  if (racks.length === 0) return <View style={{ padding: 12 }}><Muted>{t('rack.noRack')}</Muted></View>;
  return (
    <FlatList
      data={racks} keyExtractor={(r) => r.id} contentContainerStyle={{ padding: 12 }}
      renderItem={({ item: rack }) => {
        const inRack = devices.filter((d) => d.rackId === rack.id && d.rackPos != null).sort((a, b) => b.rackPos! - a.rackPos!);
        return (
          <Card>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{rack.name}</Text>
            <Muted>{t('rack.used', { used: usedUnits(rack, devices), total: rack.units })}</Muted>
            <View style={{ marginTop: 8, gap: 4 }}>
              {inRack.map((d) => {
                const cross = connectionsOf(d, devices, links, racks).filter((x) => x.crossRack);
                return (
                  <View key={d.id}>
                    <Text onPress={() => onDevice(d.id)} style={{ color: c.ink, backgroundColor: c.raised, borderLeftWidth: 4, borderLeftColor: DEVICE_COLORS[d.type], padding: 8, borderRadius: 4 }}>
                      U{d.rackPos}{d.rackUnits > 1 ? `–${d.rackPos! + d.rackUnits - 1}` : ''}  {d.name}
                    </Text>
                    {cross.map((x) => (
                      <View key={x.link.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingTop: 3 }}>
                        <Swatch fiber={x.link.medium === 'fiber'} />
                        <Text style={{ color: c.mute, fontSize: 12, flex: 1 }}>{x.localPort} → {x.remote.name} ({x.remotePort}) · {x.remoteRack?.name ?? t('rack.notRacked')}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
              {inRack.length === 0 && <Muted>—</Muted>}
            </View>
          </Card>
        );
      }}
    />
  );
}
