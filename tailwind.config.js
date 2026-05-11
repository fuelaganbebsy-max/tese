/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#00E5FF',
        'primary-soft': '#C3F5FF',
        teal: '#26A69A',
        amber: '#FFB300',
        background: '#0A0A0A',
        surface: '#121212',
        'surface-2': '#1E1E1E',
        outline: '#2C2C2C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
