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
      // Body text in the phone's own face (Roboto on the Android phones most used in Benin): sharp, nothing to download.
      // Titles in Montserrat, the typeface of the government charter.
      fontFamily: {
        sans: ['system-ui', 'Roboto', '-apple-system', 'Segoe UI', 'Noto Sans', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(38 33 26 / 0.05), 0 4px 16px rgb(38 33 26 / 0.06)',
        lift: '0 2px 4px rgb(38 33 26 / 0.06), 0 10px 28px rgb(38 33 26 / 0.10)',
      },
    },
  },
  plugins: [],
};
