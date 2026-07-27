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

  findForUserAndCandidate(userId: string, candidateId: string): Promise<Flag | null> {
    return prisma.flag.findUnique({
      where: { userId_candidateId: { userId, candidateId } },
    })
  },

  count(): Promise<number> {
    return prisma.flag.count()
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
