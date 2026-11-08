import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

export function Button({ title, onPress, kind = 'default', disabled, busy, style }: { title: string; onPress: () => void; kind?: 'default' | 'primary' | 'danger'; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.access : c.raised;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? c.crit : c.ink;
  return (
    <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: kind === 'primary' ? c.access : c.line, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...p }: { label: string; hint?: string } & TextInputProps) {
  const c = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[s.label, { color: c.mute }]}>{label}</Text>
      <TextInput placeholderTextColor={c.mute} autoCapitalize="none" autoCorrect={false} {...p}
        style={[s.input, { color: c.ink, backgroundColor: c.bg, borderColor: c.line }, p.editable === false && { opacity: 0.55 }]} />
      {hint ? <Text style={{ color: c.mute, fontSize: 12, marginTop: 3 }}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: ViewStyle }) {
  const c = useTheme();
  const body = <View style={[s.card, { backgroundColor: c.panel, borderColor: c.line }, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[s.chip, { borderColor: active ? c.access : c.line, backgroundColor: active ? c.access : c.raised }]}>
      <Text style={{ color: active ? '#fff' : c.ink, fontSize: 13, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Dot({ type }: { type: 'critical' | 'warning' | 'info' }) {
  const c = useTheme();
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: type === 'critical' ? c.crit : type === 'warning' ? c.warn : c.info }} />;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={[s.header, { backgroundColor: c.panel, borderBottomColor: c.line }]}>
      {onBack ? <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button"><Text style={{ color: c.ink, fontSize: 24, paddingRight: 12 }}>‹</Text></Pressable> : null}
      <Text numberOfLines={1} style={{ color: c.ink, fontSize: 17, fontWeight: '600', flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => {
  const c = useTheme();
  return <Text style={{ color: c.mute, fontSize: 13 }}>{children}</Text>;
};

const s = StyleSheet.create({
  btn: { minHeight: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
});
