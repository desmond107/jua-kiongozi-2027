import type { Config } from 'tailwindcss'

/**
 * The Kenyan flag, as a palette.
 *
 *   ink     — the black band: the ground everything sits on
 *   bone    — the white fimbriations: type, hairlines, focus rings
 *   flame   — the red band: the signature accent (CTAs, links, eyebrows)
 *   verdant — the green band: verification, success, progress
 *
 * The flag's own reds and greens are deep (#BB0000, #006B3F): right for a
 * filled button carrying white text, too dark to read AS text on black. So each
 * hue has a `deep` step that is the flag colour itself and lighter steps tuned
 * to clear WCAG AA against the ink surfaces. Accents are still used mostly as
 * *light* — glows, washes, card edges — which is what keeps a black, red and
 * green page feeling elegant rather than loud.
 *
 * Contrast, against ink-800:
 *   bone 18.1  ·  bone-muted 12.8  ·  bone-dim 6.5
 *   flame 5.2  ·  flame-soft 7.5   ·  verdant 6.7  ·  verdant-soft 9.8
 *   bone on flame-deep 6.8  ·  bone on verdant-deep 6.6
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './frontend/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Layered background depths, darkest to lightest.
        // Layered blacks, darkest to lightest. Neutral with the faintest warmth,
        // so they read as the flag's black rather than as a cold grey.
        ink: {
          950: '#060606',
          900: '#0B0B0C',
          800: '#101011',
          700: '#18181A',
          600: '#222225',
          500: '#2E2E32',
          400: '#44444A',
        },
        bone: {
          DEFAULT: '#FAF9F6',
          muted: '#D6D4CE',
          dim: '#9A968F',
        },
        verdant: {
          DEFAULT: '#22B05F',
          soft: '#4ED18A',
          deep: '#006B3F',
        },
        flame: {
          DEFAULT: '#F0464B',
          soft: '#FF7A7A',
          deep: '#BB0000',
          ember: '#7E0A0E',
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
        'display-lg': ['clamp(3rem, 9vw, 5.5rem)', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      // Tailwind's opacity scale steps in fives, so `border-white/12` silently
      // matched nothing and inputs fell back to the default light-grey border —
      // a bright white outline on a black page.
      opacity: {
        12: '0.12',
      },
      backgroundImage: {
        'mesh-primary':
          'radial-gradient(55% 55% at 12% 8%, rgb(0 107 63 / 0.30) 0%, transparent 60%), radial-gradient(50% 50% at 92% 18%, rgb(187 0 0 / 0.20) 0%, transparent 62%), radial-gradient(70% 60% at 55% 105%, rgb(187 0 0 / 0.10) 0%, transparent 65%)',
        sheen:
          'linear-gradient(115deg, transparent 20%, rgb(250 249 246 / 0.14) 45%, rgb(250 249 246 / 0.05) 55%, transparent 75%)',
        // The flag read top to bottom — black, white, red, white, green — laid
        // out left to right. The thin white bands are the fimbriations. The
        // black band is lifted to charcoal: true black vanishes into the page
        // and makes the stripe look as though it starts a third of the way in.
        'flag-stripe':
          'linear-gradient(90deg, #2E2E32 0%, #2E2E32 30%, #FAF9F6 30%, #FAF9F6 33%, #BB0000 33%, #BB0000 64%, #FAF9F6 64%, #FAF9F6 67%, #006B3F 67%, #006B3F 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(250 249 246 / 0.06), 0 20px 60px -20px rgb(0 0 0 / 0.8)',
        'glow-verdant': '0 0 40px -8px rgb(34 176 95 / 0.45)',
        'glow-flame': '0 0 40px -8px rgb(187 0 0 / 0.55)',
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
