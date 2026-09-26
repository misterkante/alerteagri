const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        leaf: { DEFAULT: token('leaf'), light: token('leaf-tint'), mid: token('leaf-strong'), ink: token('on-leaf') },
        soil: { DEFAULT: token('ink'), muted: token('ink-muted'), light: token('page'), line: token('line') },
        surface: { DEFAULT: token('surface'), raised: token('surface-raised') },
        warn: { DEFAULT: token('warn'), light: token('warn-tint') },
        danger: { DEFAULT: token('danger'), light: token('danger-tint') },
        flag: { green: token('flag-green'), yellow: token('flag-yellow'), red: token('flag-red') },
        status: { calm: token('status-calm'), check: token('status-check'), alert: token('status-alert') },
      },
      fontFamily: { sans: ['Montserrat', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(0 0 0 / 0.06)' },
    },
  },
  plugins: [],
};
