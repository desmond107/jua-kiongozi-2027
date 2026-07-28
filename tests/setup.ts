import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Test environment bootstrap.
 *
 * Loads `.env.test` if present, otherwise `.env`. A dedicated `.env.test` is
 * strongly recommended: the integration suite TRUNCATES tables, and pointing it
 * at a database with real registrations would destroy them.
 *
 * The guard below is the backstop for that mistake.
 */

const envTest = resolve(process.cwd(), '.env.test')
config({ path: existsSync(envTest) ? envTest : resolve(process.cwd(), '.env'), quiet: true })

// Deterministic secrets for tests. Set before any module reads `env`, so unit
// tests never depend on whatever happens to be in the developer's .env.
process.env.JWT_SECRET ??= 'test-jwt-secret-value-at-least-32-characters-long'
process.env.TOKEN_HASH_SECRET ??= 'test-token-hash-secret-at-least-32-characters'
process.env.IDENTITY_HASH_SECRET ??= 'test-identity-hash-secret-at-least-32-chars!!'
// 32 bytes, base64 — the length is validated by backend/config/env.ts.
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64')

// Never send a real SMS from a test run.
process.env.SMS_PROVIDER = 'console'
// NODE_ENV is set to "test" by vitest itself and is read-only in TS's typing.

/**
 * Refuse to run against anything that does not look like a throwaway database.
 *
 * The integration suite truncates every table between tests. This check is
 * cheap and the failure it prevents is unrecoverable.
 */
const url = process.env.DATABASE_URL ?? ''

if (url && !/test|_ci\b|localhost|127\.0\.0\.1/i.test(url)) {
  throw new Error(
    'Refusing to run tests against DATABASE_URL that does not look like a test database.\n' +
      'The integration suite truncates tables. Point DATABASE_URL at a disposable database ' +
      '(name it something containing "test", or run it on localhost).',
  )
}
