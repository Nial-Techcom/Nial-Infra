import { useColorScheme } from 'react-native';

/** Same palette as the web app, so the three clients look related. */
const dark = { bg: '#141A22', panel: '#1C2430', raised: '#242E3C', line: '#2C3746', ink: '#DDE4EC', mute: '#8292A4', access: '#4C8DF6', trunk: '#F0A63A', crit: '#F2555A', warn: '#F0A63A', info: '#63B3ED', ok: '#4AC88C' };
const light = { bg: '#ECEFF3', panel: '#FFFFFF', raised: '#F5F7FA', line: '#D2D9E2', ink: '#18202C', mute: '#627082', access: '#2563DC', trunk: '#C0700A', crit: '#D62834', warn: '#B06408', info: '#0E74BE', ok: '#168C5A' };
export type Palette = typeof dark;

export function useTheme(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}
