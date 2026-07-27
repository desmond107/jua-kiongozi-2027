import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto'
import { env } from '@/backend/config/env'

/**
 * All hashing and token generation for the platform.
 *
 * WHY PEPPERED HMAC RATHER THAN PER-RECORD SALTED BCRYPT
 * ─────────────────────────────────────────────────────
 * National ID hashes, phone hashes and token hashes are all *lookup* keys: the
 * database must be able to answer "does this ID already exist?" and "which
 * token is this?" without iterating every row. A per-record random salt (as in
 * bcrypt) makes those lookups impossible by construction.
 *
 * The construction used instead is HMAC-SHA256 keyed with a long server-side
 * secret (a "pepper") that lives only in the environment, never in the
 * database. That gives the property that actually matters here: an attacker who
 * exfiltrates the entire database still cannot brute-force the ~8-digit Kenyan
 * ID number space, because they lack the key. Anyone who has *both* the dump
 * and the environment secret has already compromised the server outright.
 */

const TOKEN_BYTES = 32

/**
 * Crockford base32 without I, L, O and U — the characters people most often
 * mistranscribe. Keeps the printed Voter Card readable and unambiguous.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function toBase32(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Generates a cryptographically random voting token.
 *
 * The value derives from `crypto.randomBytes` only — it is never a function of
 * the user's ID number, phone number, name or registration time, so knowing any
 * of those tells an attacker nothing about the token.
 *
 * Returned in hyphenated groups of four purely for legibility on the Voter
 * Card. `hashToken` strips the formatting before hashing, so the grouping is
 * cosmetic and users may type the token with or without hyphens.
 */
export function generateVotingToken(): string {
  const raw = toBase32(randomBytes(TOKEN_BYTES))
  const groups = raw.match(/.{1,4}/g) ?? []
  return groups.join('-')
}

/** Strips formatting so "ABCD-EF12" and "abcdef12" hash identically. */
function canonicaliseToken(token: string): string {
  return token.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
}

function hmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex')
}

/**
 * Hashes a voting token for storage and comparison. The raw token is shown to
 * the citizen exactly once at issuance and is never persisted or logged.
 */
export function hashToken(token: string): string {
  return hmac(canonicaliseToken(token), env.tokenHashSecret)
}

/**
 * Six-digit phone verification code.
 *
 * `randomInt` is used rather than `Math.random()` because this value is a
 * credential: it is the only thing standing between an attacker and a free
 * account, and a predictable PRNG would let it be guessed rather than received.
 * The range is padded to a fixed six digits so codes never vary in length.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/**
 * Hashes a verification code for storage.
 *
 * Domain-separated from voting tokens by the `otp:` prefix and bound to the
 * phone number it was issued for, so a code intercepted for one number cannot be
 * replayed against another even if the same digits come up again.
 */
export function hashOtpCode(code: string, phoneHash: string): string {
  return hmac(`otp:${phoneHash}:${code.replace(/\D/g, '')}`, env.tokenHashSecret)
}

/**
 * Hashes a national ID number. Normalises away spaces and leading zeros so the
 * same physical ID cannot be re-registered by typing it differently.
 */
export function hashIdNumber(idNumber: string): string {
  const canonical = idNumber.replace(/\D/g, '').replace(/^0+/, '')
  return hmac(`id:${canonical}`, env.identityHashSecret)
}

/**
 * Hashes a phone number. Expects the E.164 form produced by
 * `normalisePhoneNumber`, so 0712345678 and +254712345678 collide correctly.
 */
export function hashPhoneNumber(phone: string): string {
  return hmac(`phone:${normalisePhoneNumber(phone)}`, env.identityHashSecret)
}

/**
 * Normalises Kenyan mobile numbers to E.164 (+2547XXXXXXXX / +2541XXXXXXXX).
 * Accepts 07…, 01…, 2547…, +2547… and bare 7…/1… nine-digit forms.
 */
export function normalisePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.length === 9) return `+254${digits}`

  return `+${digits}`
}

/**
 * Reversibly encrypts a secret for storage, so its owner can be shown it again.
 *
 * AES-256-GCM, random 12-byte IV per record, authentication tag retained. GCM
 * rather than CBC because the ciphertext must be tamper-evident: a token that
 * decrypts to attacker-chosen plaintext would be worse than one that cannot be
 * recovered at all.
 *
 * Format: `v1.<iv>.<authTag>.<ciphertext>`, all base64url. The version prefix
 * exists so the scheme can be changed later without guessing at old rows.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', env.tokenEncryptionKey, iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

/**
 * Reverses `encryptSecret`. Returns null rather than throwing when the value is
 * unreadable — a rotated key or a pre-encryption row is a "cannot show you
 * this" outcome, not a server fault.
 */
export function decryptSecret(payload: string): string | null {
  try {
    const [version, iv, authTag, ciphertext] = payload.split('.')
    if (version !== 'v1' || !iv || !authTag || !ciphertext) return null

    const decipher = createDecipheriv(
      'aes-256-gcm',
      env.tokenEncryptionKey,
      Buffer.from(iv, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'))

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}

/** "***456" — the last three digits, for user-facing account recognition. */
export function maskTail(value: string, visible = 3): string {
  const digits = value.replace(/\D/g, '')
  return `***${digits.slice(-visible)}`
}

/**
 * Constant-time hash comparison. Both inputs are hex digests of identical
 * length, so a length mismatch can only mean a malformed value.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Public, non-secret reference printed on the Voter Card. Derived from the user
 * id so it can be quoted in a support request or encoded in the card's QR code
 * without ever exposing the token itself.
 */
export function publicSerial(userId: string): string {
  const digest = createHmac('sha256', 'jk27-public-serial').update(userId).digest('hex')
  return `JK27-${digest.slice(0, 4).toUpperCase()}-${digest.slice(4, 8).toUpperCase()}`
}
