import 'server-only'
import type { Admin } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/**
 * Data access for the operator console.
 *
 * ONE RULE GOVERNS THIS ENTIRE FILE
 * ─────────────────────────────────
 * No query here may return a row that pairs an identifiable person with how
 * they rated a candidate. Counts per person are fine ("has rated 5 of 7");
 * choices per person are not.
 *
 * That is not squeamishness, it is the promise the privacy policy makes to
 * every registrant — "individual responses are never published, never exported,
 * and are not available through any endpoint on this platform" — and an
 * operator endpoint is still an endpoint. Under the Data Protection Act 2019 a
 * political opinion tied to a named citizen is sensitive personal data, so a
 * table joining the two would also be the single most damaging artefact this
 * system could leak.
 *
 * `select` clauses below are therefore explicit and narrow, never a bare
 * `include`. If you extend this file, keep them that way.
 */

export const adminRepository = {
  findByUsername(username: string): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { username } })
  },

  touchLastLogin(id: string): Promise<Admin> {
    return prisma.admin.update({ where: { id }, data: { lastLoginAt: new Date() } })
  },

  count(): Promise<number> {
    return prisma.admin.count()
  },

  /**
   * A page of registrants.
   *
   * Returns the masked identifiers only — `phoneMasked` / `idMasked` are the
   * sole stored representations that are readable at all. The raw phone number
   * and national ID were HMAC-hashed at registration and are not recoverable by
   * this query, by any other query, or by anyone holding the database.
   *
   * `_count` gives participation without disclosing content: how many
   * candidates this person has rated, never which way.
   */
  async listRegistrants(params: {
    county?: string
    search?: string
    skip: number
    take: number
  }): Promise<{
    rows: Array<{
      id: string
      name: string
      county: string | null
      phoneMasked: string
      idMasked: string
      createdAt: Date
      votesCast: number
      flagsCast: number
    }>
    total: number
  }> {
    // Name is the only free-text field on the record, so it is the only thing
    // search can match. Phone and ID are hashes; searching them is impossible
    // by construction, which is a feature rather than a gap.
    const where = {
      ...(params.county ? { county: params.county } : {}),
      ...(params.search
        ? { name: { contains: params.search, mode: 'insensitive' as const } }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          county: true,
          phoneMasked: true,
          idMasked: true,
          createdAt: true,
          _count: { select: { votes: true, flags: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.user.count({ where }),
    ])

    return {
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        county: row.county,
        phoneMasked: row.phoneMasked,
        idMasked: row.idMasked,
        createdAt: row.createdAt,
        votesCast: row._count.votes,
        flagsCast: row._count.flags,
      })),
      total,
    }
  },

  /** Vote totals per county per candidate, per choice. Pure GROUP BY. */
  countyVoteMatrix(): Promise<
    Array<{ county: string | null; candidateId: string; choice: string; count: number }>
  > {
    return prisma.vote
      .groupBy({
        by: ['county', 'candidateId', 'choice'],
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          county: row.county,
          candidateId: row.candidateId,
          choice: String(row.choice),
          count: row._count._all,
        })),
      )
  },

  /** Trust-flag totals per county per candidate. Pure GROUP BY. */
  countyFlagMatrix(): Promise<
    Array<{ county: string | null; candidateId: string; color: string; count: number }>
  > {
    return prisma.flag
      .groupBy({
        by: ['county', 'candidateId', 'color'],
        _count: { _all: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          county: row.county,
          candidateId: row.candidateId,
          color: String(row.color),
          count: row._count._all,
        })),
      )
  },

  /** Registrations per county. */
  async registrationsByCounty(): Promise<Array<{ county: string | null; users: number }>> {
    const rows = await prisma.user.groupBy({ by: ['county'], _count: { _all: true } })
    return rows.map((row) => ({ county: row.county, users: row._count._all }))
  },

  /**
   * Registrations per day for the last `days` days.
   *
   * Grouped in SQL rather than by loading rows, and cast to `date` in the
   * database so the bucket boundary is the server's, not the reader's. Useful
   * as an abuse signal: a flat baseline with one enormous spike is what a
   * scripted registration run looks like.
   */
  registrationVelocity(days = 30): Promise<Array<{ day: Date; users: bigint }>> {
    return prisma.$queryRaw<Array<{ day: Date; users: bigint }>>`
      SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*)::bigint AS users
      FROM users
      -- The ::int cast is required: Prisma binds a JS number as bigint, and
      -- make_interval has no bigint overload, so without it Postgres raises
      -- 42883 "function make_interval(days => bigint) does not exist".
      WHERE "createdAt" >= NOW() - MAKE_INTERVAL(days => ${days}::int)
      GROUP BY 1
      ORDER BY 1 ASC
    `
  },
}
