import 'server-only'
import type { PhoneVerification, Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/**
 * All PhoneVerification access. As everywhere else in this layer, every lookup
 * key is a hash — no query here accepts a raw phone number or a raw code.
 */

export const phoneVerificationRepository = {
  create(data: {
    phoneHash: string
    codeHash: string
    expiresAt: Date
  }): Promise<PhoneVerification> {
    return prisma.phoneVerification.create({ data })
  },

  /**
   * The newest challenge for a number that is still live: not consumed, not
   * expired, and not yet out of attempts.
   *
   * Ordered newest-first so requesting a fresh code supersedes an older one
   * rather than leaving two valid codes in play.
   */
  findActive(phoneHash: string, maxAttempts: number): Promise<PhoneVerification | null> {
    return prisma.phoneVerification.findFirst({
      where: {
        phoneHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: maxAttempts },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  /** Most recent challenge for a number regardless of state — used for cooldown. */
  findLatest(phoneHash: string): Promise<PhoneVerification | null> {
    return prisma.phoneVerification.findFirst({
      where: { phoneHash },
      orderBy: { createdAt: 'desc' },
    })
  },

  recordFailedAttempt(id: string): Promise<PhoneVerification> {
    return prisma.phoneVerification.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  },

  /**
   * Marks a challenge consumed, but only if it is still unconsumed.
   *
   * The `consumedAt: null` guard makes this the atomic point of no return: two
   * concurrent registrations submitting the same valid code will both pass
   * verification, and exactly one will match zero rows here and be rejected.
   */
  async consume(id: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    const { count } = await (tx ?? prisma).phoneVerification.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    })

    return count === 1
  },

  /** Supersedes every live challenge for a number when a new code is issued. */
  async consumeAllFor(phoneHash: string): Promise<number> {
    const { count } = await prisma.phoneVerification.updateMany({
      where: { phoneHash, consumedAt: null },
      data: { consumedAt: new Date() },
    })

    return count
  },

  /** Drops long-expired challenges. Safe to call from cron. */
  async pruneExpired(olderThanHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    const { count } = await prisma.phoneVerification.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    })

    return count
  },
}
