import 'server-only'

/**
 * Validated, fail-fast access to server secrets.
 *
 * Every secret is read through this module so that a missing or placeholder
 * value surfaces as a loud startup error rather than as a silently weak hash
 * somewhere deep in the request path.
 */

function required(name: string): string {
  const value = process.env[name]

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and generate a value with: openssl rand -base64 48`,
    )
  }

  // A short secret defeats the point of having one. 32 characters of base64 is
  // ~24 bytes of entropy, which is the floor we accept.
  if (value.length < 32) {
    throw new Error(
      `Environment variable ${name} is too short (${value.length} chars). ` +
        `Use at least 32 characters: openssl rand -base64 48`,
    )
  }

  return value
}

/**
 * The AES-256 key used to keep voting tokens recoverable by their owner.
 *
 * Unlike the hash peppers, this one is *reversible* by design — that is the
 * whole point, and it is a genuine weakening of the "hashes only" posture. It
 * is a separate variable rather than a reuse of TOKEN_HASH_SECRET so that the
 * blast radius of a leak is bounded: leaking this exposes tokens, leaking the
 * pepper exposes lookup ability, and neither one hands over both.
 */
function encryptionKey(): Buffer {
  const raw = required('TOKEN_ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')

  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        `Generate one with: openssl rand -base64 32`,
    )
  }

  return key
}

export const env = {
  get jwtSecret() {
    return required('JWT_SECRET')
  },
  get tokenEncryptionKey() {
    return encryptionKey()
  },
  get tokenHashSecret() {
    return required('TOKEN_HASH_SECRET')
  },
  get identityHashSecret() {
    return required('IDENTITY_HASH_SECRET')
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
}

/** Session cookie lifetime: 30 days. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const SESSION_COOKIE_NAME = 'jk27_session'

/**
 * Admin sessions expire in 8 hours, not 30 days.
 *
 * A citizen's session unlocks their own ballot; an operator's unlocks the
 * registrant list for the entire platform. A month-long cookie on a shared or
 * borrowed machine is an acceptable risk for the first and not for the second,
 * so this is scoped to roughly one working day.
 */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8

/**
 * A distinct cookie name from the voter session, so the two never overwrite
 * each other and signing out of one does not silently sign out of the other.
 */
export const ADMIN_SESSION_COOKIE_NAME = 'jk27_admin'
