import 'server-only'
import type { Flag, FlagColor, Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'

export const flagRepository = {
  create(
    data: { userId: string; candidateId: string; color: FlagColor; county: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<Flag> {
    return (tx ?? prisma).flag.create({ data })
  },

  /**
   * Accepts a transaction client so a caller writing a vote and a flag together
   * can check for an existing flag INSIDE that transaction. Checking outside it
   * would read a snapshot that the transaction may already have moved past.
   */
  findForUserAndCandidate(
    userId: string,
    candidateId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Flag | null> {
    return (tx ?? prisma).flag.findUnique({
      where: { userId_candidateId: { userId, candidateId } },
    })
  },

  count(): Promise<number> {
    return prisma.flag.count()
  },

  /** Flag counts for a single candidate, without tallying the whole table. */
  async tallyForCandidate(candidateId: string): Promise<Record<FlagColor, number>> {
    const rows = await prisma.flag.groupBy({
      by: ['color'],
      _count: { _all: true },
      where: { candidateId },
    })

    const counts: Record<FlagColor, number> = { GREEN: 0, ORANGE: 0, RED: 0, BLACK: 0 }
    for (const row of rows) counts[row.color] = row._count._all
    return counts
  },

  async tallyByCandidate(): Promise<
    Array<{ candidateId: string; color: FlagColor; count: number }>
  > {
    const rows = await prisma.flag.groupBy({
      by: ['candidateId', 'color'],
      _count: { _all: true },
    })

    return rows.map((row) => ({
      candidateId: row.candidateId,
      color: row.color,
      count: row._count._all,
    }))
  },
}
