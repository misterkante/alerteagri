export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        leaf: { DEFAULT: '#14532d', light: '#dcfce7', mid: '#166534' },
        soil: { DEFAULT: '#3f2d1c', light: '#f7f6f1', line: '#e7e2d6' },
        warn: { DEFAULT: '#92400e', light: '#fef3c7' },
        danger: { DEFAULT: '#991b1b', light: '#fee2e2' },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
