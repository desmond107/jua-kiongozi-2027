import 'server-only'
import type { Prisma, Vote, VoteChoice } from '@prisma/client'
import { prisma } from '@/backend/db/client'

export const voteRepository = {
  create(
    data: { userId: string; candidateId: string; choice: VoteChoice; county: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<Vote> {
    return (tx ?? prisma).vote.create({ data })
  },

  findForUserAndCandidate(userId: string, candidateId: string): Promise<Vote | null> {
    return prisma.vote.findUnique({
      where: { userId_candidateId: { userId, candidateId } },
    })
  },

  /** Every candidate this user has already rated, for the "already voted" UI. */
  async candidateIdsRatedBy(userId: string): Promise<string[]> {
    const rows = await prisma.vote.findMany({
      where: { userId },
      select: { candidateId: true },
    })
    return rows.map((row) => row.candidateId)
  },

  count(): Promise<number> {
    return prisma.vote.count()
  },

  /** Vote breakdown for a single candidate, without scanning the whole table. */
  async tallyForCandidate(candidateId: string): Promise<Record<VoteChoice, number>> {
    const rows = await prisma.vote.groupBy({
      by: ['choice'],
      _count: { _all: true },
      where: { candidateId },
    })

    const counts: Record<VoteChoice, number> = { YES: 0, NO: 0, NOT_SURE: 0 }
    for (const row of rows) counts[row.choice] = row._count._all
    return counts
  },

  /**
   * Aggregate tally of every (candidate, choice) pair in a single grouped query
   * — the analytics path never loads individual vote rows.
   */
  async tallyByCandidate(): Promise<
    Array<{ candidateId: string; choice: VoteChoice; count: number }>
  > {
    const rows = await prisma.vote.groupBy({
      by: ['candidateId', 'choice'],
      _count: { _all: true },
    })

    return rows.map((row) => ({
      candidateId: row.candidateId,
      choice: row.choice,
      count: row._count._all,
    }))
  },

  async tallyByCounty(): Promise<Array<{ county: string; votes: number }>> {
    const rows = await prisma.vote.groupBy({
      by: ['county'],
      _count: { _all: true },
      where: { county: { not: null } },
    })

    return rows
      .map((row) => ({ county: row.county as string, votes: row._count._all }))
      .sort((a, b) => b.votes - a.votes)
  },
}
