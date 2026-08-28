import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { deleteAccount, register } from '@/backend/services/auth.service'
import { getSnapshot } from '@/backend/services/analytics.service'
import { submitBallot } from '@/backend/services/vote.service'
import { hashIdNumber, hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'
import type { RegisterPayload } from '@/backend/validators'
import {
  obtainOtp,
  race,
  registerCitizen,
  resetDatabase,
  seedCandidates,
} from './helpers'

/**
 * Account erasure.
 *
 * Two properties are load-bearing and both are asserted here rather than
 * assumed:
 *
 *   1. Erasure is total. No vote, flag, token or usage row outlives the account,
 *      and the published aggregates stop counting them.
 *   2. Erasure is NOT a way to vote twice. The tombstone must refuse the same
 *      national ID a second registration — otherwise "delete my account" is an
 *      unlimited ballot supply and every published figure is forgeable.
 */

beforeEach(async () => {
  await resetDatabase()
  await prisma.deletedIdentity.deleteMany({})
})

async function rateEverything(citizen: Awaited<ReturnType<typeof registerCitizen>>, candidates: Awaited<ReturnType<typeof seedCandidates>>) {
  for (const candidate of candidates) {
    await submitBallot(
      { token: citizen.rawToken, candidateId: candidate.id, choice: 'YES', color: 'GREEN' },
      citizen.userId,
    )
  }
}

describe('erasure removes everything', () => {
  it('deletes the account, its token, its usages, its votes and its flags', async () => {
    const candidates = await seedCandidates(3)
    const citizen = await registerCitizen({ county: 'Nairobi' })
    await rateEverything(citizen, candidates)

    expect(await prisma.vote.count()).toBe(3)
    expect(await prisma.flag.count()).toBe(3)
    expect(await prisma.tokenUsage.count()).toBe(3)

    const code = await obtainOtp(citizen.phoneNumber)
    const receipt = await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    expect(receipt.votesRemoved).toBe(3)
    expect(receipt.flagsRemoved).toBe(3)
    expect(receipt.tokensRemoved).toBe(1)

    // Nothing survives the cascade.
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.vote.count()).toBe(0)
    expect(await prisma.flag.count()).toBe(0)
    expect(await prisma.votingToken.count()).toBe(0)
    expect(await prisma.tokenUsage.count()).toBe(0)
  })

  it('takes the erased ratings out of the published totals', async () => {
    const candidates = await seedCandidates(2)
    const staying = await registerCitizen({ county: 'Nairobi' })
    const leaving = await registerCitizen({ county: 'Nairobi' })

    await rateEverything(staying, candidates)
    await rateEverything(leaving, candidates)

    const before = await getSnapshot()
    expect(before.totals.totalVotes).toBe(4)
    expect(before.totals.registeredVoters).toBe(2)

    const code = await obtainOtp(leaving.phoneNumber)
    await deleteAccount(leaving.userId, leaving.phoneNumber, code)

    const after = await getSnapshot()

    // The published figures go DOWN. That is the intended behaviour: someone
    // who withdraws should not still be counted.
    expect(after.totals.totalVotes).toBe(2)
    expect(after.totals.registeredVoters).toBe(1)

    // And the citizen who stayed is untouched.
    expect(after.candidates.every((row) => row.votes.YES === 1)).toBe(true)
  })

  it('leaves other citizens’ accounts completely alone', async () => {
    const candidates = await seedCandidates(1)
    const staying = await registerCitizen({ county: 'Kisumu' })
    const leaving = await registerCitizen({ county: 'Nairobi' })

    await rateEverything(staying, candidates)
    await rateEverything(leaving, candidates)

    const code = await obtainOtp(leaving.phoneNumber)
    await deleteAccount(leaving.userId, leaving.phoneNumber, code)

    expect(await prisma.user.count()).toBe(1)
    const survivor = await prisma.user.findFirstOrThrow()
    expect(survivor.id).toBe(staying.userId)
    expect(await prisma.votingToken.count({ where: { userId: staying.userId } })).toBe(1)
  })

  it('keeps only two hashes, and nothing that describes a person', async () => {
    const citizen = await registerCitizen({ name: 'Asha Mwangi', county: 'Nairobi' })

    const code = await obtainOtp(citizen.phoneNumber)
    await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    const tombstone = await prisma.deletedIdentity.findFirstOrThrow()

    // The hashes are the peppered lookup hashes, not the raw values.
    expect(tombstone.phoneHash).toBe(hashPhoneNumber(normalisePhoneNumber(citizen.phoneNumber)))
    expect(tombstone.idNumberHash).toBe(hashIdNumber(citizen.idNumber))

    // Nothing readable about the person is retained.
    const serialised = JSON.stringify(tombstone)
    expect(serialised).not.toContain('Asha')
    expect(serialised).not.toContain('Nairobi')
    expect(serialised).not.toContain(citizen.phoneNumber)
    expect(serialised).not.toContain(citizen.idNumber)
  })
})

describe('erasure is not a second ballot', () => {
  it('refuses to re-register a deleted national ID', async () => {
    const candidates = await seedCandidates(1)
    const citizen = await registerCitizen({ county: 'Nairobi' })
    await rateEverything(citizen, candidates)

    const code = await obtainOtp(citizen.phoneNumber)
    await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    // Same person, same ID, but a brand-new phone number — the case an
    // ID-only check would catch and a phone-only check would miss.
    const freshPhone = '0798765432'
    const freshCode = await obtainOtp(freshPhone)

    await expect(
      register({
        name: 'Asha Mwangi',
        phoneNumber: freshPhone,
        idNumber: citizen.idNumber,
        county: 'Nairobi',
        otpCode: freshCode,
        acceptedTerms: true,
        acknowledgedNotIebc: true,
      } as RegisterPayload),
    ).rejects.toThrow(/cannot be registered/)

    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.vote.count()).toBe(0)
  })

  it('refuses to re-register a deleted phone number, and says so plainly', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })

    const code = await obtainOtp(citizen.phoneNumber)
    await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    const freshCode = await obtainOtp(citizen.phoneNumber)

    // The phone CAN be named: the caller just proved they hold the SIM, so this
    // discloses only a fact about their own number.
    await expect(
      register({
        name: 'Asha Mwangi',
        phoneNumber: citizen.phoneNumber,
        idNumber: '19998888',
        county: 'Nairobi',
        otpCode: freshCode,
        acceptedTerms: true,
        acknowledgedNotIebc: true,
      } as RegisterPayload),
    ).rejects.toThrow(/permanently deleted/)
  })

  it('does not reveal that a stranger’s ID was deleted', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })
    const code = await obtainOtp(citizen.phoneNumber)
    await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    const probePhone = '0787654321'

    const erasedIdMessage = await register({
      name: 'Prober Person',
      phoneNumber: probePhone,
      idNumber: citizen.idNumber,
      county: 'Nairobi',
      otpCode: await obtainOtp(probePhone),
      acceptedTerms: true,
      acknowledgedNotIebc: true,
    } as RegisterPayload).catch((error: Error) => error.message)

    // A live registered ID produces this exact message. The erased one must be
    // indistinguishable from it, or the endpoint becomes a way to ask "did this
    // person delete their account?" about any ID number.
    const other = await registerCitizen({ county: 'Nairobi' })
    const takenIdMessage = await register({
      name: 'Prober Person',
      phoneNumber: probePhone,
      idNumber: other.idNumber,
      county: 'Nairobi',
      otpCode: await obtainOtp(probePhone),
      acceptedTerms: true,
      acknowledgedNotIebc: true,
    } as RegisterPayload).catch((error: Error) => error.message)

    expect(erasedIdMessage).toBe(takenIdMessage)
  })
})

describe('erasure is gated', () => {
  it('rejects a phone number that is not the one on the account', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })
    const attackerPhone = '0733222111'
    const code = await obtainOtp(attackerPhone)

    await expect(deleteAccount(citizen.userId, attackerPhone, code)).rejects.toThrow(
      /does not match this account/,
    )

    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects a wrong verification code', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })
    await obtainOtp(citizen.phoneNumber)

    await expect(deleteAccount(citizen.userId, citizen.phoneNumber, '000000')).rejects.toThrow()

    expect(await prisma.user.count()).toBe(1)
  })

  it('rejects an unknown account', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })
    const code = await obtainOtp(citizen.phoneNumber)

    await expect(deleteAccount('cltnotarealuserid0000000', citizen.phoneNumber, code)).rejects.toThrow(
      /Account not found/,
    )

    expect(await prisma.user.count()).toBe(1)
  })

  it('burns the code, so it cannot delete a second account', async () => {
    const citizen = await registerCitizen({ county: 'Nairobi' })
    const code = await obtainOtp(citizen.phoneNumber)

    await deleteAccount(citizen.userId, citizen.phoneNumber, code)

    const other = await registerCitizen({ county: 'Nairobi' })
    await expect(deleteAccount(other.userId, other.phoneNumber, code)).rejects.toThrow()
    expect(await prisma.user.count()).toBe(1)
  })

  it('survives concurrent delete requests without double-deleting', async () => {
    const candidates = await seedCandidates(1)
    const citizen = await registerCitizen({ county: 'Nairobi' })
    await rateEverything(citizen, candidates)

    const code = await obtainOtp(citizen.phoneNumber)

    // The challenge is single-use and consumed inside the transaction, so
    // exactly one of these may win however they interleave.
    const { fulfilled } = await race(5, () =>
      deleteAccount(citizen.userId, citizen.phoneNumber, code),
    )

    expect(fulfilled).toBe(1)
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.deletedIdentity.count()).toBe(1)
  })
})
