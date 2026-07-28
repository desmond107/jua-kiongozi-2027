import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { submitBallot, submitVote } from '@/backend/services/vote.service'
import type { BallotReceipt } from '@/backend/services/vote.service'
import { submitFlag } from '@/backend/services/flag.service'
import type { FlagReceipt } from '@/backend/services/flag.service'
import { verifyToken, spentCandidatesForUser } from '@/backend/services/token.service'
import type { SubmitBallotPayload } from '@/backend/validators'
import { race, registerCitizen, resetDatabase, seedCandidates } from './helpers'

/**
 * "One rating per citizen per candidate" — the invariant the published results
 * rest on.
 *
 * The application checks it, but the authoritative guarantee is a pair of
 * database constraints. These tests attack the property directly, including
 * under genuine concurrency, because a check-then-write in application code
 * looks correct right up until two requests interleave.
 */

let candidates: Awaited<ReturnType<typeof seedCandidates>>

beforeEach(async () => {
  await resetDatabase()
  candidates = await seedCandidates(3)
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

const ballot = (candidateId: string, token: string): SubmitBallotPayload =>
  ({ candidateId, token, choice: 'YES', color: 'GREEN' }) as SubmitBallotPayload

describe('casting a ballot', () => {
  it('records the vote and the flag together', async () => {
    const citizen = await registerCitizen()
    const receipt = await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)

    expect(receipt.candidatesRated).toBe(1)
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
  })

  it('denormalises the county onto the vote so analytics never joins to users', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)

    const vote = await prisma.vote.findFirstOrThrow()
    expect(vote.county).toBe('Nairobi')
  })

  it('lets one citizen rate every candidate exactly once', async () => {
    const citizen = await registerCitizen()

    for (const candidate of candidates) {
      await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)
    }

    expect(await prisma.vote.count()).toBe(candidates.length)
    expect(await spentCandidatesForUser(citizen.userId)).toHaveLength(candidates.length)
  })

  it('refuses a second rating for the same candidate', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)

    await expect(
      submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId),
    ).rejects.toThrow(/already rated/i)

    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
  })

  it('records a token usage per candidate spent', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)
    await submitBallot(ballot(candidates[1]!.id, citizen.rawToken), citizen.userId)

    expect(await prisma.tokenUsage.count()).toBe(2)
  })

  it('stamps usedAt on first use and leaves it stable afterwards', async () => {
    const citizen = await registerCitizen()

    expect((await prisma.votingToken.findFirstOrThrow()).usedAt).toBeNull()

    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)
    const firstUse = (await prisma.votingToken.findFirstOrThrow()).usedAt
    expect(firstUse).not.toBeNull()

    await submitBallot(ballot(candidates[1]!.id, citizen.rawToken), citizen.userId)
    expect((await prisma.votingToken.findFirstOrThrow()).usedAt).toEqual(firstUse)
  })
})

describe('token authority', () => {
  it('rejects a token that belongs to a different account', async () => {
    const alice = await registerCitizen()
    const mallory = await registerCitizen()

    // Mallory presents Alice's token under her own session.
    await expect(
      submitBallot(ballot(candidates[0]!.id, alice.rawToken), mallory.userId),
    ).rejects.toThrow(/not valid/i)

    expect(await prisma.vote.count()).toBe(0)
  })

  it('rejects a fabricated token', async () => {
    const citizen = await registerCitizen()

    await expect(
      submitBallot(ballot(candidates[0]!.id, 'A'.repeat(52)), citizen.userId),
    ).rejects.toThrow(/not valid/i)
  })

  it('accepts the token with or without its display hyphens', async () => {
    const citizen = await registerCitizen()

    await submitBallot(
      ballot(candidates[0]!.id, citizen.rawToken.replace(/-/g, '')),
      citizen.userId,
    )

    expect(await prisma.vote.count()).toBe(1)
  })

  it('refuses a revoked token', async () => {
    const citizen = await registerCitizen()
    await prisma.votingToken.updateMany({ data: { revokedAt: new Date() } })

    await expect(verifyToken(citizen.rawToken, citizen.userId)).rejects.toThrow(/revoked/i)
  })

  it('rejects voting for a candidate that does not exist', async () => {
    const citizen = await registerCitizen()

    await expect(
      submitBallot(ballot('clh0000000000000000000000', citizen.rawToken), citizen.userId),
    ).rejects.toThrow(/could not be found/i)
  })
})

describe('separate vote and flag endpoints', () => {
  it('allows a vote first, then a flag, for the same candidate', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitVote(
      { candidateId: candidate.id, token: citizen.rawToken, choice: 'NO' } as never,
      citizen.userId,
    )
    await submitFlag(
      { candidateId: candidate.id, token: citizen.rawToken, color: 'RED' } as never,
      citizen.userId,
    )

    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    // Only one usage row despite two calls for the same candidate.
    expect(await prisma.tokenUsage.count()).toBe(1)
  })

  it('still refuses a second vote after a vote-then-flag sequence', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitVote(
      { candidateId: candidate.id, token: citizen.rawToken, choice: 'NO' } as never,
      citizen.userId,
    )
    await submitFlag(
      { candidateId: candidate.id, token: citizen.rawToken, color: 'RED' } as never,
      citizen.userId,
    )

    await expect(
      submitVote(
        { candidateId: candidate.id, token: citizen.rawToken, choice: 'YES' } as never,
        citizen.userId,
      ),
    ).rejects.toThrow(/already voted/i)
  })
})

describe('voting under concurrency', () => {
  it('records exactly one vote when the same ballot is submitted 10 times at once', async () => {
    const citizen = await registerCitizen()

    // The check-then-write in vote.service cannot survive this on its own; the
    // @@unique([userId, candidateId]) constraint is what holds.
    const outcome = await race(10, () =>
      submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId),
    )

    expect(outcome.fulfilled).toBe(1)
    expect(outcome.rejected).toBe(9)
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect(await prisma.tokenUsage.count()).toBe(1)
  })

  it('reports the duplicate as a conflict, not an internal error', async () => {
    const citizen = await registerCitizen()

    const outcome = await race(6, () =>
      submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId),
    )

    // A raw P2002 leaking to the user as a 500 would be a bug; every loser must
    // get the friendly conflict message.
    for (const reason of outcome.reasons) {
      expect(reason).toMatch(/already rated/i)
    }
  })

  it('allows simultaneous ratings of DIFFERENT candidates by one citizen', async () => {
    const citizen = await registerCitizen()

    const outcome = await race(candidates.length, (i) =>
      submitBallot(ballot(candidates[i]!.id, citizen.rawToken), citizen.userId),
    )

    expect(outcome.fulfilled).toBe(candidates.length)
    expect(await prisma.vote.count()).toBe(candidates.length)
  })

  it('allows many citizens to rate one candidate simultaneously', async () => {
    const citizens: Awaited<ReturnType<typeof registerCitizen>>[] = []
    for (let i = 0; i < 6; i += 1) citizens.push(await registerCitizen())

    const outcome = await race(citizens.length, (i) =>
      submitBallot(ballot(candidates[0]!.id, citizens[i]!.rawToken), citizens[i]!.userId),
    )

    expect(outcome.fulfilled).toBe(citizens.length)
    expect(await prisma.vote.count()).toBe(citizens.length)
  })

  it('does not let a vote and a flag race into two token usages', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await race<BallotReceipt | FlagReceipt>(2, (i) =>
      i === 0
        ? submitVote(
            { candidateId: candidate.id, token: citizen.rawToken, choice: 'YES' } as never,
            citizen.userId,
          )
        : submitFlag(
            { candidateId: candidate.id, token: citizen.rawToken, color: 'GREEN' } as never,
            citizen.userId,
          ),
    )

    expect(await prisma.tokenUsage.count()).toBeLessThanOrEqual(1)
    expect(await prisma.vote.count()).toBeLessThanOrEqual(1)
    expect(await prisma.flag.count()).toBeLessThanOrEqual(1)
  })
})
