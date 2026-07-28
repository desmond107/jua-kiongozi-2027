import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import {
  getCandidateBySlug,
  getCandidateNeighbours,
  listCandidates,
} from '@/backend/services/candidate.service'
import { submitBallot } from '@/backend/services/vote.service'
import type { SubmitBallotPayload } from '@/backend/validators'
import { registerCitizen, resetDatabase, seedCandidates } from './helpers'

/**
 * The candidate browse and profile surfaces.
 *
 * These back the two UX changes that matter most for participation: the grid
 * has to carry approval so the field can be compared without opening every
 * profile, and a profile has to lead somewhere so rating all seven is not seven
 * round trips through the grid.
 */

let candidates: Awaited<ReturnType<typeof seedCandidates>>

beforeEach(async () => {
  await resetDatabase()
  candidates = await seedCandidates(4)
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

describe('approval on the grid', () => {
  it('is zero for a candidate nobody has rated, not undefined', () => {
    // The card only renders the figure when totalVotes > 0, but the field must
    // still be a number so sorting never sees NaN.
    return listCandidates().then((rows) => {
      for (const row of rows) {
        expect(row.approvalRate).toBe(0)
        expect(row.totalVotes).toBe(0)
        expect(row.votes).toEqual({ YES: 0, NO: 0, NOT_SURE: 0 })
      }
    })
  })

  it('reports the YES share once ratings exist', async () => {
    const a = await registerCitizen()
    const b = await registerCitizen()
    const c = await registerCitizen()
    const target = candidates[0]!

    for (const [citizen, choice] of [
      [a, 'YES'],
      [b, 'YES'],
      [c, 'NO'],
    ] as const) {
      await submitBallot(
        { candidateId: target.id, token: citizen.rawToken, choice, color: 'GREEN' } as
          SubmitBallotPayload,
        citizen.userId,
      )
    }

    const row = (await listCandidates()).find((r) => r.id === target.id)!
    expect(row.votes).toEqual({ YES: 2, NO: 1, NOT_SURE: 0 })
    expect(row.totalVotes).toBe(3)
    expect(row.approvalRate).toBeCloseTo(66.7, 1)
  })

  it('agrees between the grid and the single-candidate lookup', async () => {
    const citizen = await registerCitizen()
    const target = candidates[1]!

    await submitBallot(
      { candidateId: target.id, token: citizen.rawToken, choice: 'YES', color: 'ORANGE' } as
        SubmitBallotPayload,
      citizen.userId,
    )

    // getCandidateBySlug takes a different query path than listCandidates; the
    // two must not be able to disagree about the same candidate.
    const fromGrid = (await listCandidates()).find((r) => r.id === target.id)!
    const fromProfile = await getCandidateBySlug(target.slug)

    expect(fromProfile.votes).toEqual(fromGrid.votes)
    expect(fromProfile.approvalRate).toBe(fromGrid.approvalRate)
    expect(fromProfile.flags).toEqual(fromGrid.flags)
    expect(fromProfile.totalVotes).toBe(fromGrid.totalVotes)
  })
})

describe('profile navigation', () => {
  it('gives every candidate a next, so a profile is never a dead end', async () => {
    for (const candidate of candidates) {
      const n = await getCandidateNeighbours(candidate.slug)
      expect(n.next).not.toBeNull()
      expect(n.previous).not.toBeNull()
    }
  })

  it('wraps from the last candidate back to the first', async () => {
    const last = candidates[candidates.length - 1]!
    const first = candidates[0]!

    expect((await getCandidateNeighbours(last.slug)).next?.slug).toBe(first.slug)
    expect((await getCandidateNeighbours(first.slug)).previous?.slug).toBe(last.slug)
  })

  it('reports position and total for the progress line', async () => {
    const second = await getCandidateNeighbours(candidates[1]!.slug)
    expect(second.position).toBe(2)
    expect(second.total).toBe(candidates.length)
  })

  it('walking next repeatedly visits every candidate exactly once', async () => {
    // The property that makes "rate them all" work without the grid.
    const seen: string[] = []
    let slug = candidates[0]!.slug

    for (let i = 0; i < candidates.length; i += 1) {
      seen.push(slug)
      slug = (await getCandidateNeighbours(slug)).next!.slug
    }

    expect(new Set(seen).size).toBe(candidates.length)
    expect(slug).toBe(candidates[0]!.slug)
  })

  it('rejects an unknown slug rather than guessing a neighbour', async () => {
    await expect(getCandidateNeighbours('not-a-candidate')).rejects.toThrow(/could not be found/i)
  })
})
