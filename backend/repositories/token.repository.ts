import 'server-only'
import type { Prisma, VotingToken } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/** All VotingToken and TokenUsage access. Lookups are by hash only. */

export const tokenRepository = {
  create(
    data: { userId: string; tokenHash: string; tokenCipher?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<VotingToken> {
    return (tx ?? prisma).votingToken.create({ data })
  },

  findByHash(tokenHash: string): Promise<VotingToken | null> {
    return prisma.votingToken.findUnique({ where: { tokenHash } })
  },

  /** Token plus its owner — the vote path needs both to verify the binding. */
  findByHashWithUser(tokenHash: string) {
    return prisma.votingToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })
  },

  findActiveForUser(userId: string): Promise<VotingToken | null> {
    return prisma.votingToken.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  },

  hasAnyToken(userId: string): Promise<number> {
    return prisma.votingToken.count({ where: { userId } })
  },

  /** Candidate ids this token has already been spent on. */
  async spentCandidateIds(tokenId: string): Promise<string[]> {
    const usages = await prisma.tokenUsage.findMany({
      where: { tokenId },
      select: { candidateId: true },
    })
    return usages.map((usage) => usage.candidateId)
  },

  /**
   * Records that this token has been spent on a candidate, exactly once.
   *
   * Idempotent by construction: `skipDuplicates` compiles to `INSERT … ON
   * CONFLICT DO NOTHING`, so a second call — a citizen revising their rating,
   * or the vote and flag halves arriving together — is a no-op instead of a
   * P2002. That matters because a duplicate-key error inside a transaction
   * aborts the whole transaction in Postgres, which would take the legitimate
   * revision down with it.
   *
   * The `@@unique([tokenId, candidateId])` constraint is still the authority:
   * it is what makes the conflict clause fire, and what caps the ledger at one
   * row per candidate however many times a citizen changes their mind.
   */
  async recordUsage(
    tokenId: string,
    candidateId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? prisma).tokenUsage.createMany({
      data: [{ tokenId, candidateId }],
      skipDuplicates: true,
    })
  },

  markFirstUse(tokenId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).votingToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    })
  },
}
