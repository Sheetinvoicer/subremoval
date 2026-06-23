/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Phase 1 design system tokens.
        // Surface/text/border tokens are theme-aware: their channels are
        // defined as CSS variables in app/globals.css (light `:root` + `.dark`),
        // so `bg-surface`, `text-text-primary`, `border-border`, etc. adapt to
        // the active theme. Brand colors (accent / success) stay fixed.
        background: 'rgb(var(--ds-background) / <alpha-value>)',
        surface: 'rgb(var(--ds-surface) / <alpha-value>)',
        card: 'rgb(var(--ds-card) / <alpha-value>)',
        border: 'rgb(var(--ds-border) / <alpha-value>)',
        accent: {
          DEFAULT: '#9333EA',
          secondary: '#8B5CF6',
        },
        'accent-secondary': '#8B5CF6',
        success: '#10B981',
        'text-primary': 'rgb(var(--ds-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--ds-text-secondary) / <alpha-value>)',
        // Legacy tokens (kept for backwards compatibility)
        dark: {
          bg: '#0a0a0f',
          card: '#12121a',
          border: '#1f1f2e',
          text: '#e5e5e5',
          muted: '#a1a1aa',
        },
        light: {
          bg: '#ffffff',
          card: '#f8fafc',
          border: '#e2e8f0',
          text: '#0f172a',
          muted: '#475569',
        },
        // Accent consistency: the app historically mixed blue and purple for
        // primary actions/links. Remap the full `blue` scale to Tailwind's
        // `purple` values so every `*-blue-*` utility renders as the purple
        // brand accent (purple-600 = #9333EA), matching `accent`. Chart colors
        // are set via JS/hex and are unaffected by this mapping.
        blue: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
      boxShadow: {
        // Glow effects for the design system (purple accent)
        glow: '0 0 20px rgba(147, 51, 234, 0.35)',
        'glow-sm': '0 0 10px rgba(147, 51, 234, 0.25)',
        'glow-lg': '0 0 40px rgba(147, 51, 234, 0.45)',
        'glow-secondary': '0 0 20px rgba(139, 92, 246, 0.35)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.35)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      transitionDuration: {
        250: '250ms',
      },
    },
  },
  plugins: [],
};
