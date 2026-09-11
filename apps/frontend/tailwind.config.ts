import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        subtle: 'rgb(var(--color-subtle) / <alpha-value>)',
        primary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          muted: 'rgba(99,102,241,0.15)',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          muted: 'rgba(34,211,238,0.15)',
        },
        amber: {
          DEFAULT: '#FBBF24',
          muted: 'rgba(251,191,36,0.15)',
        },
        success: '#22C55E',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
} satisfies Config
