/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand tokens — DESIGN_SYSTEM §1 (CSS-var + rgb(var()/<alpha>) so opacity utilities work)
        paper: v('paper'),
        surface: v('surface'),
        yellow: {
          DEFAULT: v('yellow'),
          deep: v('yellow-deep'),
        },
        'gold-ink': v('gold-ink'),
        ink: {
          DEFAULT: v('ink'),
          muted: v('ink-muted'),
          faint: v('ink-faint'),
        },
        line: v('line'),
        // Semantic status (functional only)
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
      },
      fontFamily: {
        display: ['"Chelsea Market"', 'Georgia', 'serif'],
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        deva: ['"Tiro Devanagari Hindi"', 'serif'],
      },
      borderRadius: {
        pill: '9999px',
        chip: '0.625rem',
        card: '1rem',
      },
      boxShadow: {
        // Warm-tinted only — never gray/black slab, never glow
        sm: '0 1px 2px rgba(31,27,18,0.06)',
        md: '0 8px 24px -10px rgba(31,27,18,0.14)',
        lg: '0 24px 60px -24px rgba(31,27,18,0.22)',
        oil: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 24px -14px rgba(206,150,10,0.7)',
        // bottom-sheet lift — same warm lg scale, cast upward
        sheet: '0 -24px 60px -24px rgba(31,27,18,0.22)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(.16,1,.3,1)',
      },
      transitionDuration: {
        fast: '200ms',
        reveal: '450ms',
      },
      spacing: {
        // safe-area aware bottom nav height
        nav: '64px',
        'nav-safe': 'calc(64px + env(safe-area-inset-bottom))',
      },
      minHeight: {
        tap: '44px',
        9: '2.25rem',
        11: '2.75rem',
      },
      minWidth: {
        tap: '44px',
        11: '2.75rem',
      },
    },
  },
  plugins: [],
};
