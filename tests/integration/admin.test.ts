import bcrypt from 'bcryptjs'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/backend/db/client'
import {
  authenticateAdmin,
  buildExport,
  getCountyAnalysis,
  getOverview,
  getRegistrants,
} from '@/backend/services/admin.service'
import { submitBallot } from '@/backend/services/vote.service'
import { toCsv } from '@/backend/utils/export.util'
import { registrantQuerySchema } from '@/backend/validators'
import { registerCitizen, resetDatabase, seedCandidates } from './helpers'

/**
 * The operator console, against a real database.
 *
 * The tests that matter most here are the negative ones — that no console
 * surface leaks an individual's vote, and that the raw phone number and ID a
 * citizen typed at registration are genuinely gone. Those are promises the
 * privacy policy makes, so they get assertions rather than comments.
 */

/**
 * A throwaway credential for these tests only.
 *
 * Deliberately NOT the deployment's real operator password: this file is
 * committed, and a password in git history is a password that has to be treated
 * as disclosed forever. The tests care that bcrypt round-trips and that the
 * failure messages are indistinguishable — not what the string is.
 */
const PASSWORD = 'test-operator-pw-4Kz#9q'

async function seedAdmin(username = 'oneterm') {
  await prisma.admin.deleteMany({})

  return prisma.admin.create({
    data: { username, passwordHash: await bcrypt.hash(PASSWORD, 4) },
  })
}

beforeAll(async () => {
  await resetDatabase()
})

describe('operator authentication', () => {
  beforeEach(async () => {
    await seedAdmin()
  })

  it('accepts the correct credentials and records the sign-in', async () => {
    const claims = await authenticateAdmin({ username: 'oneterm', password: PASSWORD })

    expect(claims.username).toBe('oneterm')

    const admin = await prisma.admin.findUnique({ where: { username: 'oneterm' } })
    expect(admin?.lastLoginAt).toBeInstanceOf(Date)
  })

  it('rejects a wrong password', async () => {
    await expect(
      authenticateAdmin({ username: 'oneterm', password: 'test-operator-pw-WRONG' }),
    ).rejects.toThrow(/Incorrect username or password/)
  })

  it('gives an unknown username the SAME message as a wrong password', async () => {
    // Distinguishing them would turn a password guess into a way to enumerate
    // which operator accounts exist.
    const unknown = await authenticateAdmin({ username: 'nobody', password: PASSWORD }).catch(
      (error: Error) => error.message,
    )
    const wrongPassword = await authenticateAdmin({
      username: 'oneterm',
      password: 'wrong',
    }).catch((error: Error) => error.message)

    expect(unknown).toBe(wrongPassword)
  })

  it('never stores the password itself', async () => {
    const admin = await prisma.admin.findUnique({ where: { username: 'oneterm' } })

    expect(admin?.passwordHash).not.toContain(PASSWORD)
    expect(admin?.passwordHash.startsWith('$2')).toBe(true)
  })
})

describe('registrant listing', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('returns masked identifiers, and the raw ones are unrecoverable', async () => {
    const citizen = await registerCitizen({ name: 'Asha Mwangi', county: 'Nairobi' })

    const page = await getRegistrants(registrantQuerySchema.parse({}))
    const row = page.rows.find((r) => r.name === 'Asha Mwangi')

    expect(row).toBeDefined()
    expect(row!.county).toBe('Nairobi')

    // Masked values are the last three digits only.
    expect(row!.phoneMasked).toMatch(/^\*{3}\d{3}$/)
    expect(row!.idMasked).toMatch(/^\*{3}\d{3}$/)

    // The full values the citizen typed must not appear anywhere in the row.
    const serialised = JSON.stringify(row)
    expect(serialised).not.toContain(citizen.phoneNumber)
    expect(serialised).not.toContain(citizen.idNumber)
  })

  it('never exposes an individual vote choice', async () => {
    const [candidate] = await seedCandidates(1)
    const citizen = await registerCitizen({ county: 'Nairobi' })

    await submitBallot(
      { token: citizen.rawToken, candidateId: candidate.id, choice: 'NO', color: 'BLACK' },
      citizen.userId,
    )

    const page = await getRegistrants(registrantQuerySchema.parse({}))
    const row = page.rows[0]

    // Participation is visible…
    expect(row.votesCast).toBe(1)
    expect(row.flagsCast).toBe(1)

    // …the choice is not, anywhere in the payload.
    const serialised = JSON.stringify(page)
    expect(serialised).not.toContain('NO')
    expect(serialised).not.toContain('BLACK')
    expect(serialised).not.toContain(candidate.id)
  })

  it('filters by county', async () => {
    await registerCitizen({ name: 'Nairobi Person', county: 'Nairobi' })
    await registerCitizen({ name: 'Kisumu Person', county: 'Kisumu' })

    const page = await getRegistrants(registrantQuerySchema.parse({ county: 'Kisumu' }))

    expect(page.total).toBe(1)
    expect(page.rows[0].name).toBe('Kisumu Person')
  })

  it('searches by name, case-insensitively', async () => {
    await registerCitizen({ name: 'Asha Mwangi', county: 'Nairobi' })
    await registerCitizen({ name: 'Brian Otieno', county: 'Nairobi' })

    const page = await getRegistrants(registrantQuerySchema.parse({ search: 'asha' }))

    expect(page.total).toBe(1)
    expect(page.rows[0].name).toBe('Asha Mwangi')
  })

  it('reports a page count consistent with the total', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const page = await getRegistrants(registrantQuerySchema.parse({}))

    expect(page.page).toBe(1)
    expect(page.pageCount).toBe(1)
    expect(page.total).toBe(1)
  })
})

describe('county analysis', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('attributes votes and flags to the voter county', async () => {
    const [candidate] = await seedCandidates(1)

    const nairobi = await registerCitizen({ county: 'Nairobi' })
    const kisumu = await registerCitizen({ county: 'Kisumu' })

    await submitBallot(
      { token: nairobi.rawToken, candidateId: candidate.id, choice: 'YES', color: 'GREEN' },
      nairobi.userId,
    )
    await submitBallot(
      { token: kisumu.rawToken, candidateId: candidate.id, choice: 'NO', color: 'RED' },
      kisumu.userId,
    )

    const analysis = await getCountyAnalysis()

    const nairobiRow = analysis.rows.find((row) => row.county === 'Nairobi')!
    const kisumuRow = analysis.rows.find((row) => row.county === 'Kisumu')!

    expect(nairobiRow.votes.YES).toBe(1)
    expect(nairobiRow.approvalRate).toBe(100)
    expect(nairobiRow.flags.GREEN).toBe(1)

    expect(kisumuRow.votes.NO).toBe(1)
    expect(kisumuRow.approvalRate).toBe(0)
    expect(kisumuRow.flags.RED).toBe(1)
  })

  it('lists counties with no registrations', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const analysis = await getCountyAnalysis()

    expect(analysis.unrepresented).not.toContain('Nairobi')
    expect(analysis.unrepresented).toContain('Turkana')
    expect(analysis.unrepresented).toHaveLength(46)
  })

  it('names the leading candidate per county', async () => {
    const [popular, unpopular] = await seedCandidates(2)
    const citizen = await registerCitizen({ county: 'Nairobi' })

    await submitBallot(
      { token: citizen.rawToken, candidateId: popular.id, choice: 'YES', color: 'GREEN' },
      citizen.userId,
    )
    await submitBallot(
      { token: citizen.rawToken, candidateId: unpopular.id, choice: 'NO', color: 'RED' },
      citizen.userId,
    )

    const analysis = await getCountyAnalysis()
    const nairobi = analysis.counties.find((row) => row.county === 'Nairobi')!

    expect(nairobi.leading?.candidateName).toBe(popular.fullName)
    expect(nairobi.leading?.approvalRate).toBe(100)
  })
})

describe('overview', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('serialises the raw-SQL velocity counts as numbers, not bigints', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const overview = await getOverview()

    // COUNT(*) returns bigint from $queryRaw, which JSON.stringify throws on.
    // Serialising here is the assertion.
    expect(() => JSON.stringify(overview)).not.toThrow()
    expect(overview.velocity.every((day) => typeof day.users === 'number')).toBe(true)
    expect(overview.registeredVoters).toBe(1)
  })

  it('returns a full 30-day timeline, zero-filled and in order', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const { velocity } = await getOverview()

    // Every day present, not just the days that had registrations — otherwise
    // the chart's x-axis is a list of busy days rather than a timeline, and a
    // spike cannot be distinguished from steady activity.
    expect(velocity).toHaveLength(30)

    const days = velocity.map((entry) => entry.day)
    expect([...days].sort()).toEqual(days)
    expect(new Set(days).size).toBe(30)

    // Today is the last bucket and holds the registration just created.
    expect(days.at(-1)).toBe(new Date().toISOString().slice(0, 10))
    expect(velocity.at(-1)!.users).toBe(1)

    // And the quiet days are genuinely zero rather than absent.
    expect(velocity.filter((entry) => entry.users === 0)).toHaveLength(29)
  })
})

describe('exports', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('includes masked identifiers and excludes raw ones', async () => {
    const citizen = await registerCitizen({ name: 'Asha Mwangi', county: 'Nairobi' })

    const { tables } = await buildExport('registrants')
    const csv = toCsv(tables[0])

    expect(csv).toContain('Asha Mwangi')
    expect(csv).toContain('Nairobi')
    expect(csv).not.toContain(citizen.phoneNumber)
    expect(csv).not.toContain(citizen.idNumber)
  })

  it('carries the privacy note into the file', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const { tables } = await buildExport('registrants')
    const csv = toCsv(tables[0])

    expect(csv).toContain('Individual voting choices are deliberately excluded')
    expect(csv).toContain('cannot be recovered')
  })

  it('exports beyond one page of registrants', async () => {
    // The screen pages at 50; the export must not silently stop there.
    for (let i = 0; i < 55; i += 1) {
      await registerCitizen({ county: 'Nairobi' })
    }

    const { tables } = await buildExport('registrants')

    expect(tables[0].rows).toHaveLength(55)
  })

  it('honours the county filter', async () => {
    await registerCitizen({ name: 'Nairobi Person', county: 'Nairobi' })
    await registerCitizen({ name: 'Kisumu Person', county: 'Kisumu' })

    const { tables, stem } = await buildExport('registrants', 'Kisumu')

    expect(tables[0].rows).toHaveLength(1)
    expect(stem).toContain('kisumu')
  })

  it('gives the summary workbook a second sheet', async () => {
    await registerCitizen({ county: 'Nairobi' })

    const { tables } = await buildExport('summary')

    expect(tables).toHaveLength(2)
    expect(tables[1].name).toBe('By county')
  })

  it('never emits an individual choice in the county exports', async () => {
    const [candidate] = await seedCandidates(1)
    const citizen = await registerCitizen({ county: 'Nairobi' })

    await submitBallot(
      { token: citizen.rawToken, candidateId: candidate.id, choice: 'YES', color: 'GREEN' },
      citizen.userId,
    )

    const votes = await buildExport('county-votes')
    const csv = toCsv(votes.tables[0])

    // The aggregate is there…
    expect(csv).toContain('Nairobi')
    // …but no user identifier is.
    expect(csv).not.toContain(citizen.userId)
    expect(csv).not.toContain(citizen.phoneNumber)
  })
})
