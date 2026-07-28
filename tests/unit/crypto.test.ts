import { describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  generateOtpCode,
  generateVotingToken,
  hashIdNumber,
  hashOtpCode,
  hashPhoneNumber,
  hashToken,
  hashesMatch,
  maskTail,
  normalisePhoneNumber,
  publicSerial,
} from '@/backend/utils/crypto.util'

/**
 * The cryptographic floor the whole platform stands on.
 *
 * These assert properties, not implementations — "the same physical ID cannot
 * be re-registered by typing it differently" is a product rule, and it happens
 * to be enforced by normalisation inside the hash.
 */

describe('generateVotingToken', () => {
  it('is unpredictable across many draws', () => {
    const tokens = new Set(Array.from({ length: 2_000 }, generateVotingToken))
    expect(tokens.size).toBe(2_000)
  })

  it('carries at least 128 bits of entropy in its alphabet', () => {
    // 32 random bytes in base32 = 52 significant characters.
    const stripped = generateVotingToken().replace(/-/g, '')
    expect(stripped.length).toBeGreaterThanOrEqual(51)
  })

  it('avoids the characters people mistranscribe', () => {
    // Crockford base32 drops I, L, O and U.
    const sample = Array.from({ length: 200 }, generateVotingToken).join('')
    expect(sample).not.toMatch(/[ILOU]/)
  })

  it('hashes identically with or without the display hyphens', () => {
    const token = generateVotingToken()
    expect(hashToken(token)).toBe(hashToken(token.replace(/-/g, '')))
    expect(hashToken(token)).toBe(hashToken(token.toLowerCase()))
  })
})

describe('hashToken', () => {
  it('is deterministic and distinct per token', () => {
    const a = generateVotingToken()
    const b = generateVotingToken()
    expect(hashToken(a)).toBe(hashToken(a))
    expect(hashToken(a)).not.toBe(hashToken(b))
  })

  it('never returns the plaintext', () => {
    const token = generateVotingToken()
    expect(hashToken(token)).not.toContain(token.slice(0, 8))
  })
})

describe('hashIdNumber', () => {
  it('treats the same ID written differently as the same ID', () => {
    // This is what stops one person registering twice with "01234567",
    // "1234567" and "123 4567".
    const canonical = hashIdNumber('1234567')
    expect(hashIdNumber('01234567')).toBe(canonical)
    expect(hashIdNumber('123 4567')).toBe(canonical)
    expect(hashIdNumber('123-4567')).toBe(canonical)
  })

  it('separates different IDs', () => {
    expect(hashIdNumber('12345678')).not.toBe(hashIdNumber('12345679'))
  })

  it('is domain-separated from phone hashes', () => {
    // Without the "id:"/"phone:" prefixes, an ID and a phone that happened to
    // share digits would collide across two unique columns.
    expect(hashIdNumber('712345678')).not.toBe(hashPhoneNumber('712345678'))
  })
})

describe('normalisePhoneNumber', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['+254712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['0112345678', '+254112345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhoneNumber(input)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalisePhoneNumber('0712345678')
    expect(normalisePhoneNumber(once)).toBe(once)
  })

  it('makes every written form of one number hash the same', () => {
    const forms = ['0712345678', '+254712345678', '254712345678', '712 345 678']
    const hashes = new Set(forms.map(hashPhoneNumber))
    expect(hashes.size).toBe(1)
  })
})

describe('hashOtpCode', () => {
  it('binds a code to the phone it was issued for', () => {
    // A code intercepted for one number must not verify against another.
    const phoneA = hashPhoneNumber('0712345678')
    const phoneB = hashPhoneNumber('0722333444')
    expect(hashOtpCode('123456', phoneA)).not.toBe(hashOtpCode('123456', phoneB))
  })

  it('ignores incidental formatting in the code', () => {
    const phone = hashPhoneNumber('0712345678')
    expect(hashOtpCode('123 456', phone)).toBe(hashOtpCode('123456', phone))
  })
})

describe('generateOtpCode', () => {
  it('is always exactly six digits, including when the draw is small', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/)
    }
  })

  it('spans the full range rather than clustering', () => {
    const codes = Array.from({ length: 1_000 }, generateOtpCode)
    expect(new Set(codes).size).toBeGreaterThan(900)
    // Would fail if padStart were masking a truncated range.
    expect(codes.some((c) => c.startsWith('0'))).toBe(true)
  })
})

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a token', () => {
    const token = generateVotingToken()
    expect(decryptSecret(encryptSecret(token))).toBe(token)
  })

  it('produces different ciphertext each time for the same input', () => {
    // A fixed IV would make identical tokens visibly identical in the database.
    const token = generateVotingToken()
    expect(encryptSecret(token)).not.toBe(encryptSecret(token))
  })

  it('refuses tampered ciphertext rather than returning wrong plaintext', () => {
    const payload = encryptSecret(generateVotingToken())
    const [v, iv, tag, body] = payload.split('.')

    const flipped = Buffer.from(body!, 'base64url')
    flipped[0] ^= 0xff

    expect(decryptSecret([v, iv, tag, flipped.toString('base64url')].join('.'))).toBeNull()
  })

  it('refuses a swapped authentication tag', () => {
    const a = encryptSecret('token-a')
    const b = encryptSecret('token-b')
    const [av, aiv, , abody] = a.split('.')
    const [, , btag] = b.split('.')

    expect(decryptSecret([av, aiv, btag, abody].join('.'))).toBeNull()
  })

  it('returns null on malformed or unversioned input instead of throwing', () => {
    expect(decryptSecret('')).toBeNull()
    expect(decryptSecret('nonsense')).toBeNull()
    expect(decryptSecret('v2.a.b.c')).toBeNull()
  })
})

describe('hashesMatch', () => {
  it('matches equal digests and rejects unequal ones', () => {
    const digest = hashToken('ABCD')
    expect(hashesMatch(digest, digest)).toBe(true)
    expect(hashesMatch(digest, hashToken('EFGH'))).toBe(false)
  })

  it('rejects rather than throws on malformed input', () => {
    expect(hashesMatch('zz', 'zz')).toBe(false)
    expect(hashesMatch('abc', 'abcd')).toBe(false)
    expect(hashesMatch('', '')).toBe(true)
  })
})

describe('maskTail', () => {
  it('reveals only the last three digits', () => {
    expect(maskTail('+254712345678')).toBe('***678')
    expect(maskTail('12345678')).toBe('***678')
  })
})

describe('publicSerial', () => {
  it('is stable per user and different across users', () => {
    expect(publicSerial('user-a')).toBe(publicSerial('user-a'))
    expect(publicSerial('user-a')).not.toBe(publicSerial('user-b'))
  })

  it('does not leak the user id', () => {
    expect(publicSerial('clx123456789')).not.toContain('clx123')
  })
})
