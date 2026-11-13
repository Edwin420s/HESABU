/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#1b4d3e',
          950: '#0c271f'
        },
        surface: {
          50: '#f8faf9',
          100: '#f1f5f3',
          200: '#e5ece8',
          300: '#d4dfd9',
          800: '#1e2924',
          900: '#0f1714'
        },
        ink: '#17231f',
        muted: '#6b7771',
        paper: '#f6f7f5',
        forest: '#245c46',
        line: '#e5e9e5'
      },
      fontFamily: {
        sans: ['Manrope', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};
