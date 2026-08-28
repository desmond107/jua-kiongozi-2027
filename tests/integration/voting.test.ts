import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { submitBallot, submitVote } from '@/backend/services/vote.service'
import type { BallotReceipt } from '@/backend/services/vote.service'
import { submitFlag } from '@/backend/services/flag.service'
import type { FlagReceipt } from '@/backend/services/flag.service'
import { citizenRatingFor } from '@/backend/services/vote.service'
import { verifyToken, spentCandidatesForUser } from '@/backend/services/token.service'
import type { SubmitBallotPayload } from '@/backend/validators'
import { race, registerCitizen, resetDatabase, seedCandidates } from './helpers'

/**
 * "One rating per citizen per candidate" — the invariant the published results
 * rest on.
 *
 * The invariant caps voices, not submissions: a citizen may come back and
 * change what they said, and the existing row is updated rather than joined by
 * a second one. These tests attack both halves of that — that a revision moves
 * the answer, and that it can never inflate a citizen into two — including
 * under genuine concurrency, because a read-then-write in application code
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

const ballot = (
  candidateId: string,
  token: string,
  choice: SubmitBallotPayload['choice'] = 'YES',
  color: SubmitBallotPayload['color'] = 'GREEN',
): SubmitBallotPayload => ({ candidateId, token, choice, color }) as SubmitBallotPayload

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

  it('never lets a second submission become a second rating', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'NO', 'RED'), citizen.userId)

    // The whole point of the constraint: two submissions, one voice.
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

describe('changing a rating', () => {
  it('moves the answer without adding a row', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitBallot(ballot(candidate.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)
    const receipt = await submitBallot(
      ballot(candidate.id, citizen.rawToken, 'NO', 'BLACK'),
      citizen.userId,
    )

    expect(receipt.revised).toBe(true)
    expect(receipt.choice).toBe('NO')
    expect(receipt.color).toBe('BLACK')

    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect((await prisma.vote.findFirstOrThrow()).choice).toBe('NO')
    expect((await prisma.flag.findFirstOrThrow()).color).toBe('BLACK')
  })

  it('reports the first rating as not a revision', async () => {
    const citizen = await registerCitizen()
    const receipt = await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)

    expect(receipt.revised).toBe(false)
  })

  it('does not spend the token a second time', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)
    const before = (await prisma.votingToken.findFirstOrThrow()).usedAt

    const receipt = await submitBallot(
      ballot(candidate.id, citizen.rawToken, 'NOT_SURE', 'ORANGE'),
      citizen.userId,
    )

    // A revision is the same voice speaking again, so the ledger, the count of
    // candidates rated, and the first-use stamp must all be untouched.
    expect(await prisma.tokenUsage.count()).toBe(1)
    expect(receipt.candidatesRated).toBe(1)
    expect((await prisma.votingToken.findFirstOrThrow()).usedAt).toEqual(before)
  })

  it('keeps createdAt and moves updatedAt', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)
    const original = await prisma.vote.findFirstOrThrow()

    await submitBallot(ballot(candidate.id, citizen.rawToken, 'NO', 'RED'), citizen.userId)
    const revised = await prisma.vote.findFirstOrThrow()

    // The pair is what tells a surface "recorded on X" from "last changed on X".
    expect(revised.createdAt).toEqual(original.createdAt)
    expect(revised.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime())
  })

  it('still requires the citizen\'s own token', async () => {
    const alice = await registerCitizen()
    const mallory = await registerCitizen()
    const candidate = candidates[0]!

    await submitBallot(ballot(candidate.id, alice.rawToken), alice.userId)

    // Revising is not a session privilege. Mallory holds a valid session and a
    // valid token — just not the one that owns this rating.
    await expect(
      submitBallot(ballot(candidate.id, mallory.rawToken), alice.userId),
    ).rejects.toThrow(/not valid/i)

    expect((await prisma.vote.findFirstOrThrow()).choice).toBe('YES')
  })

  it('reports the standing answer, and whether it has been changed', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    expect(await citizenRatingFor(citizen.userId, candidate.id)).toBeNull()

    await submitBallot(ballot(candidate.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)
    const first = await citizenRatingFor(citizen.userId, candidate.id)
    expect(first).toMatchObject({ choice: 'YES', color: 'GREEN', revised: false })

    await submitBallot(ballot(candidate.id, citizen.rawToken, 'NO', 'RED'), citizen.userId)
    const after = await citizenRatingFor(citizen.userId, candidate.id)
    expect(after).toMatchObject({ choice: 'NO', color: 'RED', revised: true })
    // The first answer's timestamp is what "recorded" means; it does not move.
    expect(after!.recordedAt).toBe(first!.recordedAt)
  })

  it('leaves other candidates and other citizens alone', async () => {
    const alice = await registerCitizen()
    const bob = await registerCitizen()

    await submitBallot(ballot(candidates[0]!.id, alice.rawToken, 'YES', 'GREEN'), alice.userId)
    await submitBallot(ballot(candidates[1]!.id, alice.rawToken, 'YES', 'GREEN'), alice.userId)
    await submitBallot(ballot(candidates[0]!.id, bob.rawToken, 'YES', 'GREEN'), bob.userId)

    await submitBallot(ballot(candidates[0]!.id, alice.rawToken, 'NO', 'BLACK'), alice.userId)

    expect(await prisma.vote.count()).toBe(3)
    const untouched = await prisma.vote.findMany({ where: { choice: 'YES' } })
    expect(untouched).toHaveLength(2)
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

  it('revises the vote after a vote-then-flag sequence, without touching the flag', async () => {
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

    const receipt = await submitVote(
      { candidateId: candidate.id, token: citizen.rawToken, choice: 'YES' } as never,
      citizen.userId,
    )

    expect(receipt.revised).toBe(true)
    expect(await prisma.vote.count()).toBe(1)
    expect((await prisma.vote.findFirstOrThrow()).choice).toBe('YES')
    // The vote endpoint says nothing about flags, so the flag must be left as
    // it was rather than reset to a default by a vote-only submission.
    expect((await prisma.flag.findFirstOrThrow()).color).toBe('RED')
  })

  /**
   * The reverse ordering, which used to lose the vote outright.
   *
   * `submitBallot` created the flag unconditionally, so a flag recorded earlier
   * by `/api/flag` collided with `@@unique([userId, candidateId])`, rolled the
   * whole transaction back, and surfaced as "you have already rated this
   * candidate" — while no vote existed. Every retry failed identically, so the
   * citizen could never cast that vote at all.
   */
  it('accepts a combined ballot after the flag was recorded separately', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitFlag(
      { candidateId: candidate.id, token: citizen.rawToken, color: 'RED' } as never,
      citizen.userId,
    )

    const receipt = await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)

    // The vote — the half that was missing — is what had to land.
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect(await prisma.tokenUsage.count()).toBe(1)
    expect(receipt.candidatesRated).toBe(1)
  })

  it('moves a separately-recorded flag to the colour the ballot submitted', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitFlag(
      { candidateId: candidate.id, token: citizen.rawToken, color: 'RED' } as never,
      citizen.userId,
    )

    // `ballot()` submits GREEN. Both halves of a ballot are answers the citizen
    // just gave on one screen, so GREEN must win — silently keeping RED would
    // report a colour they did not choose as their current position.
    const receipt = await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)

    expect(receipt.color).toBe('GREEN')
    const stored = await prisma.flag.findFirstOrThrow({ where: { userId: citizen.userId } })
    expect(stored.color).toBe('GREEN')
    expect(await prisma.flag.count()).toBe(1)
  })

  it('keeps one row through a flag, a ballot and a revision of that ballot', async () => {
    const citizen = await registerCitizen()
    const candidate = candidates[0]!

    await submitFlag(
      { candidateId: candidate.id, token: citizen.rawToken, color: 'RED' } as never,
      citizen.userId,
    )
    await submitBallot(ballot(candidate.id, citizen.rawToken), citizen.userId)
    await submitBallot(ballot(candidate.id, citizen.rawToken, 'NOT_SURE', 'ORANGE'), citizen.userId)

    // Three submissions across two endpoints, one standing answer.
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect(await prisma.tokenUsage.count()).toBe(1)
    expect((await prisma.vote.findFirstOrThrow()).choice).toBe('NOT_SURE')
    expect((await prisma.flag.findFirstOrThrow()).color).toBe('ORANGE')
  })
})

describe('voting under concurrency', () => {
  it('records exactly one vote when the same ballot is submitted 10 times at once', async () => {
    const citizen = await registerCitizen()

    // A double-click, a retried request, a flaky connection: none of them may
    // produce a second row. The read-then-upsert in vote.service cannot survive
    // this on its own; `INSERT … ON CONFLICT` against
    // @@unique([userId, candidateId]) is what holds.
    const outcome = await race(10, () =>
      submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId),
    )

    // Every one of them is now a legitimate submission rather than a duplicate
    // to reject — they simply converge on one row.
    expect(outcome.rejected).toBe(0)
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect(await prisma.tokenUsage.count()).toBe(1)
  })

  it('settles on one of the submitted answers when revisions collide', async () => {
    const citizen = await registerCitizen()
    const choices = ['YES', 'NO', 'NOT_SURE'] as const
    const colors = ['GREEN', 'RED', 'BLACK'] as const

    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken), citizen.userId)

    // Three different revisions of the same rating, at once. Last writer wins
    // is the acceptable outcome; a second row, a lost row, or a raw database
    // error surfacing to the citizen is not.
    const outcome = await race(3, (i) =>
      submitBallot(
        ballot(candidates[0]!.id, citizen.rawToken, choices[i]!, colors[i]!),
        citizen.userId,
      ),
    )

    expect(outcome.rejected).toBe(0)
    expect(await prisma.vote.count()).toBe(1)
    expect(await prisma.flag.count()).toBe(1)
    expect(choices).toContain((await prisma.vote.findFirstOrThrow()).choice)
    expect(colors).toContain((await prisma.flag.findFirstOrThrow()).color)
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
