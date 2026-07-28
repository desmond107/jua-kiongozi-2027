import { describe, expect, it } from 'vitest'
import {
  loginSchema,
  registerSchema,
  submitBallotSchema,
  KENYAN_COUNTIES,
  FLAG_COLOR_ORDER,
  FLAG_META,
  VOTE_CHOICE_COLORS,
  VOTE_CHOICE_ORDER,
} from '@/backend/validators'

/**
 * The shared schemas are the contract between the React forms and the API — the
 * same objects are imported by both. A regression here silently desynchronises
 * client-side validation from server-side enforcement.
 */

const validRegistration = {
  name: 'Wanjiku Kamau',
  phoneNumber: '0712345678',
  idNumber: '12345678',
  otpCode: '123456',
  county: 'Nairobi',
  acceptedTerms: true,
  acknowledgedNotIebc: true,
}

describe('registerSchema', () => {
  it('accepts a well-formed registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true)
  })

  it('requires a county', () => {
    // County is mandatory so the participation-by-region breakdown covers
    // everyone rather than a self-selected subset.
    const { county, ...withoutCounty } = validRegistration
    const result = registerSchema.safeParse(withoutCounty)

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'county')
      expect(issue?.message).toBe('Select your county')
    }
  })

  it('gives a readable message for an unselected county rather than listing 47 options', () => {
    const result = registerSchema.safeParse({ ...validRegistration, county: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'county')
      expect(issue?.message).toBe('Select your county')
      expect(issue?.message).not.toContain('Baringo')
    }
  })

  it('rejects a county that is not one of the 47', () => {
    expect(registerSchema.safeParse({ ...validRegistration, county: 'Atlantis' }).success).toBe(
      false,
    )
  })

  it('accepts every one of the 47 counties', () => {
    for (const county of KENYAN_COUNTIES) {
      expect(registerSchema.safeParse({ ...validRegistration, county }).success).toBe(true)
    }
  })

  it.each(['0712345678', '+254712345678', '254712345678', '0112345678', '0712 345 678'])(
    'accepts phone format %s',
    (phoneNumber) => {
      expect(registerSchema.safeParse({ ...validRegistration, phoneNumber }).success).toBe(true)
    },
  )

  it.each(['', '071234567', '0812345678', '07123456789', 'not-a-phone', '+1 555 0100'])(
    'rejects phone %s',
    (phoneNumber) => {
      expect(registerSchema.safeParse({ ...validRegistration, phoneNumber }).success).toBe(false)
    },
  )

  it.each(['1234567', '12345678', '123456789'])('accepts ID length %s', (idNumber) => {
    expect(registerSchema.safeParse({ ...validRegistration, idNumber }).success).toBe(true)
  })

  it.each(['123456', '1234567890', 'ABCDEFG', ''])('rejects ID %s', (idNumber) => {
    expect(registerSchema.safeParse({ ...validRegistration, idNumber }).success).toBe(false)
  })

  it('requires both consent gates to be explicitly true', () => {
    expect(
      registerSchema.safeParse({ ...validRegistration, acceptedTerms: false }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({ ...validRegistration, acknowledgedNotIebc: false }).success,
    ).toBe(false)
  })

  it('rejects a name that is a single word', () => {
    expect(registerSchema.safeParse({ ...validRegistration, name: 'Wanjiku' }).success).toBe(false)
  })

  it('accepts names with apostrophes and hyphens', () => {
    for (const name of ["Fred Matiang'i", 'Mary-Jane Achieng', 'Wanjiku Kamau']) {
      expect(registerSchema.safeParse({ ...validRegistration, name }).success).toBe(true)
    }
  })

  it('rejects a six-digit code that is not six digits', () => {
    for (const otpCode of ['12345', '1234567', 'abcdef', '']) {
      expect(registerSchema.safeParse({ ...validRegistration, otpCode }).success).toBe(false)
    }
  })

  it('normalises the phone number on output so hashing is stable', () => {
    const result = registerSchema.parse({ ...validRegistration, phoneNumber: '0712 345 678' })
    expect(result.phoneNumber).toBe('0712345678')
  })
})

describe('loginSchema', () => {
  it('rejects a token that is too short to be real', () => {
    expect(loginSchema.safeParse({ phoneNumber: '0712345678', token: 'ABC' }).success).toBe(false)
  })

  it('accepts a token with or without hyphens', () => {
    const bare = 'A'.repeat(52)
    const hyphenated = (bare.match(/.{1,4}/g) ?? []).join('-')

    expect(loginSchema.safeParse({ phoneNumber: '0712345678', token: bare }).success).toBe(true)
    expect(loginSchema.safeParse({ phoneNumber: '0712345678', token: hyphenated }).success).toBe(
      true,
    )
  })
})

describe('submitBallotSchema', () => {
  const base = {
    candidateId: 'clh1234567890abcdefghijkl',
    choice: 'YES',
    color: 'GREEN',
    token: 'A'.repeat(52),
  }

  it('accepts a well-formed ballot', () => {
    expect(submitBallotSchema.safeParse(base).success).toBe(true)
  })

  it('rejects choices and colours outside the enums', () => {
    expect(submitBallotSchema.safeParse({ ...base, choice: 'MAYBE' }).success).toBe(false)
    expect(submitBallotSchema.safeParse({ ...base, color: 'PURPLE' }).success).toBe(false)
  })

  it('rejects a candidate id that is not a cuid', () => {
    expect(submitBallotSchema.safeParse({ ...base, candidateId: '../../etc/passwd' }).success).toBe(
      false,
    )
    expect(submitBallotSchema.safeParse({ ...base, candidateId: '1 OR 1=1' }).success).toBe(false)
  })
})

describe('display metadata', () => {
  it('defines every flag colour and vote choice exactly once', () => {
    expect(FLAG_COLOR_ORDER).toHaveLength(4)
    expect(new Set(FLAG_COLOR_ORDER).size).toBe(4)
    expect(VOTE_CHOICE_ORDER).toHaveLength(3)
    expect(new Set(VOTE_CHOICE_ORDER).size).toBe(3)
  })

  it('gives every flag a label, a description and a distinct colour', () => {
    const hexes = FLAG_COLOR_ORDER.map((c) => FLAG_META[c].hex)
    expect(new Set(hexes).size).toBe(FLAG_COLOR_ORDER.length)

    for (const colour of FLAG_COLOR_ORDER) {
      expect(FLAG_META[colour].label.length).toBeGreaterThan(0)
      expect(FLAG_META[colour].description.length).toBeGreaterThan(0)
      expect(FLAG_META[colour].hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('keeps the flag ramp monotonically darkening, which is what carries the ordering under colour blindness', () => {
    // Green -> Orange -> Red -> Black must decrease in PERCEPTUAL lightness, so
    // the severity ordering survives for readers who cannot separate the hues.
    //
    // This uses OKLCH L, the metric the palette was designed and validated
    // against. A naive 0.2126R + 0.7152G + 0.0722B over raw 8-bit channels is
    // NOT a substitute and reports this ramp as non-monotone: it skips gamma
    // decoding, and its green coefficient overweights a saturated green against
    // a desaturated slate. Expected values here: 0.676, 0.613, 0.555, 0.486.
    const oklabLightness = (hex: string) => {
      const toLinear = (c: number) => {
        const v = c / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }

      const n = parseInt(hex.slice(1), 16)
      const r = toLinear((n >> 16) & 255)
      const g = toLinear((n >> 8) & 255)
      const b = toLinear(n & 255)

      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

      return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    }

    const values = FLAG_COLOR_ORDER.map((c) => oklabLightness(FLAG_META[c].hex))

    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeLessThan(values[i - 1]!)
      // The validator's floor for a distinguishable ordinal step.
      expect(values[i - 1]! - values[i]!).toBeGreaterThanOrEqual(0.06)
    }
  })

  it('does not reuse a flag colour for a vote choice', () => {
    const flagHexes = new Set(FLAG_COLOR_ORDER.map((c) => FLAG_META[c].hex.toUpperCase()))
    for (const choice of VOTE_CHOICE_ORDER) {
      expect(flagHexes.has(VOTE_CHOICE_COLORS[choice].toUpperCase())).toBe(false)
    }
  })
})
