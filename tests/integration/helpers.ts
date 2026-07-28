import { expect } from 'vitest'
import { prisma } from '@/backend/db/client'
import { requestPhoneVerification } from '@/backend/services/otp.service'
import { register } from '@/backend/services/auth.service'
import type { RegistrationResult } from '@/backend/services/auth.service'
import type { RegisterPayload } from '@/backend/validators'
import { hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'

/**
 * Shared fixtures for the integration suite.
 *
 * Everything here talks to a real Postgres. That is the point: the invariants
 * under test ("one rating per candidate", "one registration per ID") are
 * enforced by database constraints, so a mocked client would assert nothing
 * about the property that actually protects the results.
 */

/** Wipes every table. Order matters — children before parents. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      token_usages, votes, flags, voting_tokens,
      phone_verifications, rate_limits, users, candidates
    RESTART IDENTITY CASCADE
  `)
}

export async function seedCandidates(count = 3) {
  const created = []

  for (let i = 0; i < count; i += 1) {
    created.push(
      await prisma.candidate.create({
        data: {
          slug: `candidate-${i}`,
          fullName: `Candidate ${i}`,
          role: 'Test candidate',
          bio: 'Seeded for integration tests.',
          orderIndex: i,
        },
      }),
    )
  }

  return created
}

/** Distinct, schema-valid identities so tests never collide by accident. */
let identityCounter = 0

export function nextIdentity() {
  identityCounter += 1
  const n = String(identityCounter).padStart(6, '0')

  return {
    name: `Test Citizen ${identityCounter}`,
    // 07 + 8 digits
    phoneNumber: `07${n}${String(identityCounter % 100).padStart(2, '0')}`.slice(0, 10),
    idNumber: `${10_000_000 + identityCounter}`,
    county: 'Nairobi' as const,
  }
}

/**
 * Drives the real OTP service to obtain a live code.
 *
 * Deliberately not a stub: the OTP challenge lifecycle (supersede-on-resend,
 * attempt counting, single consumption) is itself under test, so the tests must
 * exercise the same path production does. `SMS_PROVIDER=console` keeps delivery
 * on the server log.
 */
export async function obtainOtp(phoneNumber: string): Promise<string> {
  // Production enforces a 60-second gap between codes for one number. Tests
  // request several codes within milliseconds, so elapsed time is simulated by
  // backdating the previous challenge rather than by weakening the rule or
  // sleeping for a real minute. The cooldown itself is covered directly by
  // "enforces a resend cooldown" in registration.test.ts.
  await expireResendCooldown(phoneNumber)

  const challenge = await requestPhoneVerification(phoneNumber)

  // Outside production the service returns the code so the flow is testable
  // without an SMS account.
  expect(challenge.devCode, 'devCode must be present outside production').toBeDefined()
  return challenge.devCode!
}

/** Backdates any live challenge for this number so a resend is permitted. */
export async function expireResendCooldown(phoneNumber: string): Promise<void> {
  await prisma.phoneVerification.updateMany({
    where: { phoneHash: hashPhoneNumber(normalisePhoneNumber(phoneNumber)) },
    data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
  })
}

/** Registers a fresh citizen end to end, returning the issued raw token. */
export async function registerCitizen(
  overrides: Partial<RegisterPayload> = {},
): Promise<RegistrationResult & { phoneNumber: string; idNumber: string }> {
  const identity = { ...nextIdentity(), ...overrides }
  const otpCode = await obtainOtp(identity.phoneNumber)

  const result = await register({
    name: identity.name,
    phoneNumber: identity.phoneNumber,
    idNumber: identity.idNumber,
    county: identity.county,
    otpCode,
    acceptedTerms: true,
    acknowledgedNotIebc: true,
  } as RegisterPayload)

  return { ...result, phoneNumber: identity.phoneNumber, idNumber: identity.idNumber }
}

/**
 * Runs `fn` concurrently `times` over and reports how many fulfilled.
 *
 * The race tests depend on these genuinely overlapping, so the calls are
 * started together and only then awaited.
 */
export async function race<T>(times: number, fn: (index: number) => Promise<T>) {
  const settled = await Promise.allSettled(Array.from({ length: times }, (_, i) => fn(i)))

  return {
    fulfilled: settled.filter((s) => s.status === 'fulfilled').length,
    rejected: settled.filter((s) => s.status === 'rejected').length,
    reasons: settled
      .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
      .map((s) => (s.reason as Error)?.message ?? String(s.reason)),
    // `Promise.allSettled` unwraps to Awaited<T>, so the predicate must too —
    // narrowing to PromiseFulfilledResult<T> is not assignable to the parameter.
    values: settled
      .filter((s): s is PromiseFulfilledResult<Awaited<T>> => s.status === 'fulfilled')
      .map((s) => s.value),
  }
}
