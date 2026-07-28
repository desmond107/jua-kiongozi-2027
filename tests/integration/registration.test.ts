import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { register } from '@/backend/services/auth.service'
import { login } from '@/backend/services/auth.service'
import { hashIdNumber, hashPhoneNumber } from '@/backend/utils/crypto.util'
import type { RegisterPayload } from '@/backend/validators'
import { requestPhoneVerification } from '@/backend/services/otp.service'
import { nextIdentity, obtainOtp, race, registerCitizen, resetDatabase } from './helpers'

/**
 * "One registration per citizen" — the rule everything else depends on.
 *
 * If this can be beaten, the published results are meaningless, so these tests
 * attack it directly rather than merely confirming the happy path.
 */

beforeEach(resetDatabase)
afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

async function registerWith(identity: ReturnType<typeof nextIdentity>, otpCode?: string) {
  return register({
    name: identity.name,
    phoneNumber: identity.phoneNumber,
    idNumber: identity.idNumber,
    county: identity.county,
    otpCode: otpCode ?? (await obtainOtp(identity.phoneNumber)),
    acceptedTerms: true,
    acknowledgedNotIebc: true,
  } as RegisterPayload)
}

describe('registration', () => {
  it('creates exactly one user and one token, and returns the raw token once', async () => {
    const result = await registerCitizen()

    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.votingToken.count()).toBe(1)
    expect(result.rawToken).toMatch(/^[0-9A-Z-]{50,}$/)
  })

  it('never stores the national ID or phone number in readable form', async () => {
    const identity = nextIdentity()
    await registerWith(identity)

    const user = await prisma.user.findFirstOrThrow()

    // The exact claim made on the privacy policy page.
    expect(JSON.stringify(user)).not.toContain(identity.idNumber)
    expect(JSON.stringify(user)).not.toContain(identity.phoneNumber)
    expect(user.idNumberHash).toBe(hashIdNumber(identity.idNumber))
    expect(user.phoneHash).toBe(hashPhoneNumber(identity.phoneNumber))
  })

  it('never stores the voting token in readable form, even though it is recoverable', async () => {
    const result = await registerCitizen()
    const token = await prisma.votingToken.findFirstOrThrow()

    const bare = result.rawToken.replace(/-/g, '')
    expect(token.tokenHash).not.toContain(bare)
    expect(token.tokenCipher ?? '').not.toContain(bare)
  })

  it('rejects a second registration with the same phone number', async () => {
    const first = nextIdentity()
    await registerWith(first)

    await expect(
      registerWith({ ...nextIdentity(), phoneNumber: first.phoneNumber }),
    ).rejects.toThrow(/already registered/i)

    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects a second registration with the same national ID', async () => {
    const first = nextIdentity()
    await registerWith(first)

    await expect(registerWith({ ...nextIdentity(), idNumber: first.idNumber })).rejects.toThrow()
    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects the same ID written with different formatting', async () => {
    const first = { ...nextIdentity(), idNumber: '12345678' }
    await registerWith(first)

    // Same physical ID, three cosmetic variations.
    for (const idNumber of ['012345678', '12345678', '1234 5678']) {
      await expect(registerWith({ ...nextIdentity(), idNumber })).rejects.toThrow()
    }

    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects the same phone written in a different format', async () => {
    const first = { ...nextIdentity(), phoneNumber: '0712345678' }
    await registerWith(first)

    for (const phoneNumber of ['+254712345678', '254712345678', '712345678']) {
      await expect(registerWith({ ...nextIdentity(), phoneNumber })).rejects.toThrow()
    }

    expect(await prisma.user.count()).toBe(1)
  })

  it('does not name the national ID as the duplicate, which would leak a stranger’s participation', async () => {
    const first = nextIdentity()
    await registerWith(first)

    // Proving control of one phone must not buy the ability to test whether an
    // arbitrary ID has registered.
    try {
      await registerWith({ ...nextIdentity(), idNumber: first.idNumber })
      expect.unreachable('expected a conflict')
    } catch (error) {
      const err = error as Error & { fields?: Record<string, string> }
      expect(err.message).not.toMatch(/national ID|ID number/i)
      expect(err.fields?.idNumber).toBeUndefined()
    }
  })

  it('enforces a resend cooldown so the SMS bill cannot be run up on one number', async () => {
    const identity = nextIdentity()

    // First request succeeds; an immediate second must be refused. This is the
    // rule the `obtainOtp` helper simulates around elsewhere.
    await requestPhoneVerification(identity.phoneNumber)

    await expect(requestPhoneVerification(identity.phoneNumber)).rejects.toThrow(
      /just sent|wait a moment/i,
    )
  })

  it('refuses registration without a valid OTP', async () => {
    const identity = nextIdentity()

    await expect(registerWith(identity, '000000')).rejects.toThrow(/not valid or has expired/i)
    expect(await prisma.user.count()).toBe(0)
  })

  it('will not let one OTP code create two accounts', async () => {
    const identity = nextIdentity()
    const code = await obtainOtp(identity.phoneNumber)

    await registerWith(identity, code)

    // Same code, different identity — the challenge is spent.
    await expect(
      registerWith({ ...nextIdentity(), phoneNumber: identity.phoneNumber }, code),
    ).rejects.toThrow()

    expect(await prisma.user.count()).toBe(1)
  })

  it('supersedes an older code when a new one is requested', async () => {
    const identity = nextIdentity()
    const first = await obtainOtp(identity.phoneNumber)
    const second = await obtainOtp(identity.phoneNumber)

    expect(first).not.toBe(second)

    await expect(registerWith(identity, first)).rejects.toThrow()
    await expect(registerWith(identity, second)).resolves.toBeDefined()
  })

  it('leaves no user behind when registration fails partway', async () => {
    const identity = nextIdentity()
    await expect(registerWith(identity, '999999')).rejects.toThrow()

    // The account and its token are created in one transaction; a failure must
    // roll both back rather than leaving an account that can never vote.
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.votingToken.count()).toBe(0)
  })

  it('issues a token that immediately works for sign-in', async () => {
    const citizen = await registerCitizen()

    const session = await login({
      phoneNumber: citizen.phoneNumber,
      token: citizen.rawToken,
    } as never)

    expect(session.userId).toBe(citizen.userId)
  })

  it('rejects sign-in with a token belonging to someone else', async () => {
    const a = await registerCitizen()
    const b = await registerCitizen()

    await expect(
      login({ phoneNumber: a.phoneNumber, token: b.rawToken } as never),
    ).rejects.toThrow(/do not match/i)
  })
})

describe('registration under concurrency', () => {
  it('creates exactly one account when the same identity registers 5 times at once', async () => {
    const identity = nextIdentity()
    const code = await obtainOtp(identity.phoneNumber)

    // All five carry the same valid code and the same identity. Exactly one
    // must win — this is the race the P2002 handler and the OTP consume-inside-
    // the-transaction design exist for.
    const outcome = await race(5, () => registerWith(identity, code))

    expect(outcome.fulfilled).toBe(1)
    expect(outcome.rejected).toBe(4)
    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.votingToken.count()).toBe(1)
  })

  it('creates one account per distinct citizen when many register simultaneously', async () => {
    const identities = Array.from({ length: 8 }, () => nextIdentity())
    const codes = await Promise.all(identities.map((i) => obtainOtp(i.phoneNumber)))

    const outcome = await race(identities.length, (i) => registerWith(identities[i]!, codes[i]!))

    expect(outcome.fulfilled).toBe(identities.length)
    expect(await prisma.user.count()).toBe(identities.length)
  })
})
