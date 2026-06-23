/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand tokens — CONTRACT §8
        forest: '#0E3B14',
        green: '#1B5E20',
        gold: '#C9A227',
        'gold-bright': '#E2B84B',
        mustard: '#E5B23C',
        cream: '#FAFAF7',
        charcoal: '#1A1A17',
        // semantic
        brand: '#1B5E20',
        accent: '#C9A227',
        success: '#1B5E20',
        warning: '#C9A227',
        danger: '#9B2C2C',
        info: '#2C7A7B',
        // neutrals on cream
        surface: '#FAFAF7',
        'surface-2': '#F1F0E9',
        line: '#E4E2D8',
        muted: '#6B6A60',
        ink: '#1A1A17',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,26,23,0.04), 0 4px 16px rgba(26,26,23,0.06)',
        'card-lg': '0 2px 8px rgba(26,26,23,0.08), 0 12px 32px rgba(26,26,23,0.10)',
        sheet: '0 -8px 32px rgba(26,26,23,0.14)',
      },
      spacing: {
        // safe-area aware bottom nav height
        'nav': '64px',
        'nav-safe': 'calc(64px + env(safe-area-inset-bottom))',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
    },
  },
  plugins: [],
};
