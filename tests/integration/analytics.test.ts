import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import { getSnapshot, toCsv } from '@/backend/services/analytics.service'
import { submitBallot } from '@/backend/services/vote.service'
import type { SubmitBallotPayload } from '@/backend/validators'
import { registerCitizen, resetDatabase, seedCandidates } from './helpers'

/**
 * The public analytics surface.
 *
 * Two obligations are tested here: the numbers must be arithmetically right,
 * and nothing served publicly may be traceable to an individual. The second is
 * the one that would end the project if it were ever wrong, so it is asserted
 * against the real payloads rather than reasoned about.
 */

let candidates: Awaited<ReturnType<typeof seedCandidates>>

beforeEach(async () => {
  await resetDatabase()
  candidates = await seedCandidates(2)
})

afterAll(async () => {
  await resetDatabase()
  await prisma.$disconnect()
})

const ballot = (
  candidateId: string,
  token: string,
  choice: 'YES' | 'NO' | 'NOT_SURE',
  color: 'GREEN' | 'ORANGE' | 'RED' | 'BLACK',
) => ({ candidateId, token, choice, color }) as SubmitBallotPayload

describe('aggregate correctness', () => {
  it('reports zeros for a freshly seeded platform without dividing by zero', async () => {
    const snapshot = await getSnapshot()

    expect(snapshot.totals.registeredVoters).toBe(0)
    expect(snapshot.totals.totalVotes).toBe(0)
    expect(snapshot.totals.participationRate).toBe(0)
    expect(snapshot.candidates).toHaveLength(2)
    expect(snapshot.candidates[0]!.approvalRate).toBe(0)
  })

  it('tallies votes and flags per candidate', async () => {
    const a = await registerCitizen()
    const b = await registerCitizen()
    const c = await registerCitizen()

    await submitBallot(ballot(candidates[0]!.id, a.rawToken, 'YES', 'GREEN'), a.userId)
    await submitBallot(ballot(candidates[0]!.id, b.rawToken, 'YES', 'ORANGE'), b.userId)
    await submitBallot(ballot(candidates[0]!.id, c.rawToken, 'NO', 'RED'), c.userId)

    const snapshot = await getSnapshot()
    const row = snapshot.candidates.find((r) => r.candidateId === candidates[0]!.id)!

    expect(row.votes).toEqual({ YES: 2, NO: 1, NOT_SURE: 0 })
    expect(row.flags).toEqual({ GREEN: 1, ORANGE: 1, RED: 1, BLACK: 0 })
    expect(row.totalVotes).toBe(3)
    expect(row.approvalRate).toBeCloseTo(66.7, 1)
    expect(row.trustRate).toBeCloseTo(33.3, 1)
  })

  it('keeps candidates independent', async () => {
    const citizen = await registerCitizen()

    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    const snapshot = await getSnapshot()
    const rated = snapshot.candidates.find((r) => r.candidateId === candidates[0]!.id)!
    const untouched = snapshot.candidates.find((r) => r.candidateId === candidates[1]!.id)!

    expect(rated.totalVotes).toBe(1)
    expect(untouched.totalVotes).toBe(0)
  })

  it('computes participation against the full candidate field', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    // 1 rating of a possible 1 voter x 2 candidates = 50%.
    expect((await getSnapshot()).totals.participationRate).toBe(50)
  })

  it('aggregates participation by county', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    const snapshot = await getSnapshot()
    expect(snapshot.byCounty).toEqual([{ county: 'Nairobi', votes: 1 }])
  })
})

describe('public payloads leak nothing personal', () => {
  it('carries no identifying field anywhere in the snapshot', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    const serialised = JSON.stringify(await getSnapshot())

    // Nothing that identifies the respondent, and nothing that authorises a vote.
    expect(serialised).not.toContain(citizen.userId)
    expect(serialised).not.toContain(citizen.rawToken.replace(/-/g, ''))
    expect(serialised).not.toContain(citizen.phoneNumber)
    expect(serialised).not.toContain(citizen.idNumber)
    expect(serialised).not.toContain(citizen.name)
    expect(serialised.toLowerCase()).not.toMatch(/idnumberhash|phonehash|tokenhash|tokencipher/)
  })

  it('exposes no per-respondent rows — only counts', async () => {
    const a = await registerCitizen()
    const b = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, a.rawToken, 'YES', 'GREEN'), a.userId)
    await submitBallot(ballot(candidates[0]!.id, b.rawToken, 'NO', 'BLACK'), b.userId)

    const snapshot = await getSnapshot()

    // Two respondents, but the payload has one row per candidate, not per person.
    expect(snapshot.candidates).toHaveLength(2)
    for (const row of snapshot.candidates) {
      expect(Object.keys(row)).not.toContain('userId')
      expect(Object.keys(row)).not.toContain('votes.userId')
    }
  })
})

describe('CSV export', () => {
  it('emits a header and one row per candidate', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    const csv = toCsv(await getSnapshot())
    const [header, ...rows] = csv.split('\n')

    expect(header).toContain('candidate')
    expect(header).toContain('votes_yes')
    expect(header).toContain('flags_green')
    expect(rows.filter((r) => r.startsWith('"Candidate'))).toHaveLength(2)
  })

  it('contains no personal data', async () => {
    const citizen = await registerCitizen()
    await submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'), citizen.userId)

    const csv = toCsv(await getSnapshot())

    expect(csv).not.toContain(citizen.name)
    expect(csv).not.toContain(citizen.idNumber)
    expect(csv).not.toContain(citizen.phoneNumber)
    expect(csv).not.toContain(citizen.userId)
  })

  it('neutralises spreadsheet formula injection in candidate names', async () => {
    // A malicious candidate name must not execute when the published dataset is
    // opened in Excel or Sheets.
    await prisma.candidate.create({
      data: {
        slug: 'formula',
        fullName: '=HYPERLINK("http://evil.example","click")',
        role: 'Test',
        bio: 'Test',
        orderIndex: 9,
      },
    })

    const csv = toCsv(await getSnapshot())

    expect(csv).toContain(`"'=HYPERLINK`)
    expect(csv).not.toMatch(/(^|,)"=HYPERLINK/m)
  })

  it('escapes embedded quotes rather than breaking the row', async () => {
    await prisma.candidate.create({
      data: {
        slug: 'quoted',
        fullName: 'A "quoted" name',
        role: 'Test',
        bio: 'Test',
        orderIndex: 8,
      },
    })

    expect(toCsv(await getSnapshot())).toContain('"A ""quoted"" name"')
  })
})

describe('the full citizen journey', () => {
  it('carries a real registration all the way through to the public tally', async () => {
    // End to end, through the same service layer the API routes call:
    // register -> receive token -> rate every candidate -> appear in analytics.

    // 1. A citizen registers and is issued a token.
    const citizen = await registerCitizen()
    expect(citizen.rawToken).toBeTruthy()
    expect(citizen.serial).toMatch(/^JK27-/)

    // 2. Nothing is counted yet.
    expect((await getSnapshot()).totals.totalVotes).toBe(0)

    // 3. They rate both candidates.
    await submitBallot(
      ballot(candidates[0]!.id, citizen.rawToken, 'YES', 'GREEN'),
      citizen.userId,
    )
    const receipt = await submitBallot(
      ballot(candidates[1]!.id, citizen.rawToken, 'NOT_SURE', 'ORANGE'),
      citizen.userId,
    )
    expect(receipt.candidatesRated).toBe(2)

    // 4. The public dashboard reflects it immediately and correctly.
    const snapshot = await getSnapshot()
    expect(snapshot.totals.registeredVoters).toBe(1)
    expect(snapshot.totals.totalVotes).toBe(2)
    expect(snapshot.totals.totalFlags).toBe(2)
    expect(snapshot.totals.participationRate).toBe(100)

    const first = snapshot.candidates.find((c) => c.candidateId === candidates[0]!.id)!
    const second = snapshot.candidates.find((c) => c.candidateId === candidates[1]!.id)!
    expect(first.votes.YES).toBe(1)
    expect(second.votes.NOT_SURE).toBe(1)
    expect(second.flags.ORANGE).toBe(1)

    // 5. They cannot vote again.
    await expect(
      submitBallot(ballot(candidates[0]!.id, citizen.rawToken, 'NO', 'BLACK'), citizen.userId),
    ).rejects.toThrow(/already rated/i)

    // 6. The tally is unchanged by the attempt.
    expect((await getSnapshot()).totals.totalVotes).toBe(2)

    // 7. The exported dataset is consistent with the dashboard.
    const csv = toCsv(await getSnapshot())
    expect(csv).toContain('Total votes cast,2')
  })
})
