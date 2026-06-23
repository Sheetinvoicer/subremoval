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
        // Phase 1 design system tokens
        background: '#0A0A0A',
        surface: '#111111',
        card: '#1A1A1A',
        border: '#2A2A2A',
        accent: {
          DEFAULT: '#6366F1',
          secondary: '#8B5CF6',
        },
        'accent-secondary': '#8B5CF6',
        success: '#10B981',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1AA',
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
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
      boxShadow: {
        // Glow effects for the dark design system
        glow: '0 0 20px rgba(99, 102, 241, 0.35)',
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.25)',
        'glow-lg': '0 0 40px rgba(99, 102, 241, 0.45)',
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
