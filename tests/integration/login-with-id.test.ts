import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { login, loginWithIdNumber } from '@/backend/services/auth.service'
import type { LoginWithIdPayload } from '@/backend/validators'
import { expireResendCooldown, obtainOtp, registerCitizen, resetDatabase } from './helpers'

/**
 * Signing in with a national ID number.
 *
 * This route exists to end the lost-token lockout: signing in used to require
 * the token, and retrieving the token required a session, so a citizen who lost
 * their card had no way back in at all.
 *
 * It is also the weakest credential the platform accepts, because a Kenyan ID
 * number is not a secret. These tests are mostly about the guards that make it
 * safe rather than about the happy path.
 */

beforeEach(resetDatabase)
afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

const attempt = (phoneNumber: string, idNumber: string, otpCode: string) =>
  loginWithIdNumber({ phoneNumber, idNumber, otpCode } as LoginWithIdPayload)

describe('signing in with an ID number', () => {
  it('lets a citizen back in without their token', async () => {
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    const session = await attempt(citizen.phoneNumber, citizen.idNumber, code)
    expect(session.userId).toBe(citizen.userId)
    expect(session.name).toBe(citizen.name)
  })

  it('accepts the ID however it is written', async () => {
    const citizen = await registerCitizen({ idNumber: '12345678' } as never)
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    // Same physical ID, leading zero and spacing — must resolve identically.
    const session = await attempt(citizen.phoneNumber, '012345678', code)
    expect(session.userId).toBe(citizen.userId)
  })

  it('never returns the voting token', async () => {
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    const session = await attempt(citizen.phoneNumber, citizen.idNumber, code)
    expect(JSON.stringify(session)).not.toContain(citizen.rawToken.replace(/-/g, ''))
  })
})

describe('the SMS code cannot be skipped', () => {
  it('refuses phone + ID with no valid code', async () => {
    // The heart of it: an ID number alone is a photocopy away from public, so
    // knowing one must not be enough to open a session.
    const citizen = await registerCitizen()

    await expect(attempt(citizen.phoneNumber, citizen.idNumber, '000000')).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('refuses a code issued to a different phone', async () => {
    const victim = await registerCitizen()
    const attackerPhone = '0799111222'
    const attackerCode = await obtainOtp(attackerPhone)

    // A code the attacker can actually receive, against the victim's identity.
    await expect(attempt(victim.phoneNumber, victim.idNumber, attackerCode)).rejects.toThrow()
  })

  it('burns the code even when the ID is wrong', async () => {
    // Otherwise one SMS would fund unlimited ID guesses.
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    await expect(attempt(citizen.phoneNumber, '99999999', code)).rejects.toThrow(/do not match/i)

    // The same code must now be dead, even with the correct ID.
    await expect(attempt(citizen.phoneNumber, citizen.idNumber, code)).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('cannot reuse a code that already signed someone in', async () => {
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    await attempt(citizen.phoneNumber, citizen.idNumber, code)
    await expect(attempt(citizen.phoneNumber, citizen.idNumber, code)).rejects.toThrow(
      /not valid or has expired/i,
    )
  })
})

describe('it does not become an enumeration oracle', () => {
  it('gives the same message for an unregistered phone and a wrong ID', async () => {
    const citizen = await registerCitizen()

    // Wrong ID on a real account.
    await expireResendCooldown(citizen.phoneNumber)
    const realCode = await obtainOtp(citizen.phoneNumber)
    const wrongId = await attempt(citizen.phoneNumber, '98765432', realCode).catch((e) => e)

    // A phone that was never registered.
    const strangerPhone = '0733444555'
    const strangerCode = await obtainOtp(strangerPhone)
    const unknown = await attempt(strangerPhone, '12345678', strangerCode).catch((e) => e)

    // Someone holding a SIM must not be able to learn whether a given ID — or a
    // given phone — belongs to a registered voter.
    expect(unknown.message).toBe(wrongId.message)
    expect(unknown.status).toBe(wrongId.status)
  })

  it('does not name the ID as the failing field', async () => {
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    const error = await attempt(citizen.phoneNumber, '55555555', code).catch((e) => e)
    expect(error.fields?.idNumber).toBeUndefined()
  })
})

describe('the two sign-in routes stay independent', () => {
  it('leaves the token route working unchanged', async () => {
    const citizen = await registerCitizen()

    const session = await login({
      phoneNumber: citizen.phoneNumber,
      token: citizen.rawToken,
    } as never)

    expect(session.userId).toBe(citizen.userId)
  })

  it('still refuses another citizen’s token on the token route', async () => {
    const a = await registerCitizen()
    const b = await registerCitizen()

    await expect(
      login({ phoneNumber: a.phoneNumber, token: b.rawToken } as never),
    ).rejects.toThrow(/do not match/i)
  })

  it('an ID sign-in does not spend or invalidate the voting token', async () => {
    const citizen = await registerCitizen()
    await expireResendCooldown(citizen.phoneNumber)
    const code = await obtainOtp(citizen.phoneNumber)

    await attempt(citizen.phoneNumber, citizen.idNumber, code)

    // The token must still work afterwards — signing in is not spending.
    const session = await login({
      phoneNumber: citizen.phoneNumber,
      token: citizen.rawToken,
    } as never)
    expect(session.userId).toBe(citizen.userId)
    expect(await prisma.tokenUsage.count()).toBe(0)
  })
})
