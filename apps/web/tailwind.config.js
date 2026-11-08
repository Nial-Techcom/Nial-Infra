/** Colours are CSS variables so light/dark themes switch without touching components. */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), panel: v('panel'), raised: v('raised'), line: v('line'), ink: v('ink'), mute: v('mute'),
        access: v('access'), trunk: v('trunk'), crit: v('crit'), warn: v('warn'), info: v('info'), ok: v('ok'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
