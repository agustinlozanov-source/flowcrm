/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        bg: '#f5f5f7',
        surface: '#ffffff',
        'surface-2': '#f5f5f7',
        primary: '#0a0a0a',
        secondary: '#6e6e73',
        tertiary: '#a0a0a5',
        border: 'rgba(0,0,0,0.08)',
        'border-strong': 'rgba(0,0,0,0.14)',
        accent: {
          blue: '#0066ff',
          green: '#00c853',
          amber: '#f59e0b',
          red: '#ff3b30',
          purple: '#7c3aed',
        },
      },
      borderRadius: {
        card: '14px',
        btn: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-md': '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
