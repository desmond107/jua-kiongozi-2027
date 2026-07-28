import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { revealToken } from '@/backend/services/token.service'
import { submitBallot } from '@/backend/services/vote.service'
import type { SubmitBallotPayload } from '@/backend/validators'
import {
  expireResendCooldown,
  obtainOtp,
  registerCitizen,
  resetDatabase,
  seedCandidates,
} from './helpers'

/**
 * Token retrieval — the feature that traded "hashes only" for recoverability.
 *
 * The platform's central guarantee is that a stolen session cookie cannot cast
 * a vote, because every submission needs the raw token too. Retrieval is the
 * one path that could hand the token to a session holder, so it must demand a
 * second factor the cookie thief does not have: control of the registered SIM.
 *
 * These tests exist to make sure that second factor can never be skipped.
 */

let candidates: Awaited<ReturnType<typeof seedCandidates>>

beforeEach(async () => {
  await resetDatabase()
  candidates = await seedCandidates(1)
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

describe('revealing your own token', () => {
  it('returns the exact token that was issued at registration', async () => {
    const citizen = await registerCitizen()
    const code = await obtainOtp(citizen.phoneNumber)

    const revealed = await revealToken(citizen.userId, citizen.phoneNumber, code)

    expect(revealed.rawToken).toBe(citizen.rawToken)
    expect(revealed.revoked).toBe(false)
  })

  it('returns a token that actually works for voting', async () => {
    const citizen = await registerCitizen()
    const code = await obtainOtp(citizen.phoneNumber)
    const { rawToken } = await revealToken(citizen.userId, citizen.phoneNumber, code)

    await submitBallot(
      { candidateId: candidates[0]!.id, token: rawToken, choice: 'YES', color: 'GREEN' } as
        SubmitBallotPayload,
      citizen.userId,
    )

    expect(await prisma.vote.count()).toBe(1)
  })

  it('accepts the registered number in any written format', async () => {
    const citizen = await registerCitizen({ phoneNumber: '0712345678' } as never)
    const code = await obtainOtp('0712345678')

    const revealed = await revealToken(citizen.userId, '+254712345678', code)
    expect(revealed.rawToken).toBe(citizen.rawToken)
  })
})

describe('the second factor cannot be skipped', () => {
  it('refuses a session holder who does not have the code', async () => {
    const citizen = await registerCitizen()

    // A stolen cookie alone. This is the whole point of the design.
    await expect(revealToken(citizen.userId, citizen.phoneNumber, '000000')).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('refuses a valid code sent to a DIFFERENT number the attacker controls', async () => {
    const victim = await registerCitizen()
    const attackerPhone = '0799888777'

    // The attacker has the victim's session and a code for their own phone.
    // Without the phone/account binding this would hand over the victim's token.
    const attackerCode = await obtainOtp(attackerPhone)

    await expect(revealToken(victim.userId, attackerPhone, attackerCode)).rejects.toThrow(
      /does not match this account/i,
    )
  })

  it('burns the code so it cannot be replayed', async () => {
    const citizen = await registerCitizen()
    const code = await obtainOtp(citizen.phoneNumber)

    await revealToken(citizen.userId, citizen.phoneNumber, code)

    await expect(revealToken(citizen.userId, citizen.phoneNumber, code)).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('does not burn the code when the reveal fails for an unrelated reason', async () => {
    const citizen = await registerCitizen()

    // Wipe the cipher so the reveal hits the "unrecoverable" branch.
    await prisma.votingToken.updateMany({ data: { tokenCipher: null } })

    const code = await obtainOtp(citizen.phoneNumber)
    await expect(revealToken(citizen.userId, citizen.phoneNumber, code)).rejects.toThrow(
      /cannot be recovered/i,
    )

    // The citizen should still hold a usable code rather than having spent it
    // on a failure that was not their fault.
    const challenge = await prisma.phoneVerification.findFirst({
      orderBy: { createdAt: 'desc' },
    })
    expect(challenge?.consumedAt ?? null).toBeNull()
  })

  it('refuses an expired code', async () => {
    const citizen = await registerCitizen()
    const code = await obtainOtp(citizen.phoneNumber)

    await prisma.phoneVerification.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    await expect(revealToken(citizen.userId, citizen.phoneNumber, code)).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('locks a challenge after repeated wrong guesses', async () => {
    const citizen = await registerCitizen()
    const realCode = await obtainOtp(citizen.phoneNumber)

    // Burn through the attempt allowance with wrong codes.
    for (let i = 0; i < 5; i += 1) {
      await expect(
        revealToken(citizen.userId, citizen.phoneNumber, String(100000 + i)),
      ).rejects.toThrow()
    }

    // Even the correct code must now fail — the challenge is dead.
    await expect(revealToken(citizen.userId, citizen.phoneNumber, realCode)).rejects.toThrow(
      /not valid or has expired/i,
    )
  })

  it('does not let one citizen reveal another citizen’s token', async () => {
    const alice = await registerCitizen()
    const mallory = await registerCitizen()

    await expireResendCooldown(mallory.phoneNumber)
    const mallorysCode = await obtainOtp(mallory.phoneNumber)

    // Mallory's own session, Mallory's own verified phone and code — but she
    // must still only ever receive her own token.
    const revealed = await revealToken(mallory.userId, mallory.phoneNumber, mallorysCode)

    expect(revealed.rawToken).toBe(mallory.rawToken)
    expect(revealed.rawToken).not.toBe(alice.rawToken)
  })
})
