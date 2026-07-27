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
   * Records a spend. The `@@unique([tokenId, candidateId])` constraint means a
   * concurrent duplicate request loses here with P2002 rather than producing a
   * second vote — this is the hard, race-proof single-use guarantee.
   */
  recordUsage(
    tokenId: string,
    candidateId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    return (tx ?? prisma).tokenUsage.create({
      data: { tokenId, candidateId },
      select: { id: true },
    })
  },

  markFirstUse(tokenId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).votingToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: new Date() },
    })
  },
}
