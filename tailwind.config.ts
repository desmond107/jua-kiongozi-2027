import type { Config } from 'tailwindcss'

/**
 * "Vibrant elegance with depth".
 *
 * The palette is a deep near-black navy base carrying three vibrant accents
 * drawn from the Kenyan flag. Accents are used as *light* — glows, gradient
 * meshes, card edges — rather than as flat filled blocks, which is what keeps
 * the result feeling premium rather than gaudy.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './frontend/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Layered background depths, darkest to lightest.
        ink: {
          950: '#05070D',
          900: '#070A12',
          800: '#0A0E1A',
          700: '#111726',
          600: '#1A2233',
          500: '#252F45',
          400: '#36425C',
        },
        bone: {
          DEFAULT: '#F7F5F0',
          muted: '#C9CEDA',
          dim: '#8A93A6',
        },
        verdant: {
          DEFAULT: '#1EB854',
          soft: '#4ADE80',
          deep: '#0E7A38',
        },
        flame: {
          DEFAULT: '#E23D3D',
          soft: '#F87171',
          deep: '#991B1B',
        },
        gold: {
          DEFAULT: '#F5B942',
          soft: '#FCD34D',
          deep: '#B47A0C',
        },
        // Trust-flag ordinal ramp and the vote-choice palette. Both mirror
        // FLAG_META / VOTE_CHOICE_COLORS in backend/validators/vote.validator.ts
        // — see that file for how the steps were derived and validated.
        flag: {
          green: '#1DB456',
          orange: '#C26A05',
          red: '#CB2727',
          black: '#566070',
        },
        choice: {
          yes: '#2F8FD9',
          no: '#D06D9E',
          unsure: '#C2871F',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Fluid display sizes, so the hero holds its weight from 360px upward
        // without a pile of breakpoint overrides.
        'display-sm': [
          'clamp(2rem, 6vw, 2.75rem)',
          { lineHeight: '1.1', letterSpacing: '-0.02em' },
        ],
        'display-md': [
          'clamp(2.5rem, 8vw, 4rem)',
          { lineHeight: '1.05', letterSpacing: '-0.03em' },
        ],
        'display-lg': [
          'clamp(3rem, 9vw, 5.5rem)',
          { lineHeight: '1', letterSpacing: '-0.035em' },
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'mesh-primary':
          'radial-gradient(60% 60% at 20% 15%, rgb(30 184 84 / 0.18) 0%, transparent 60%), radial-gradient(50% 50% at 85% 20%, rgb(245 185 66 / 0.14) 0%, transparent 60%), radial-gradient(70% 70% at 60% 90%, rgb(226 61 61 / 0.12) 0%, transparent 65%)',
        sheen:
          'linear-gradient(115deg, transparent 20%, rgb(247 245 240 / 0.14) 45%, rgb(247 245 240 / 0.05) 55%, transparent 75%)',
        'flag-stripe':
          'linear-gradient(90deg, #1EB854 0%, #1EB854 33%, #E23D3D 33%, #E23D3D 66%, #F5B942 66%, #F5B942 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(247 245 240 / 0.06), 0 20px 60px -20px rgb(0 0 0 / 0.8)',
        'glow-verdant': '0 0 40px -8px rgb(30 184 84 / 0.45)',
        'glow-gold': '0 0 40px -8px rgb(245 185 66 / 0.4)',
        lift: '0 30px 80px -30px rgb(0 0 0 / 0.9)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-rise': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%, 100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-rise': 'fade-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24, 0, 0.38, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
