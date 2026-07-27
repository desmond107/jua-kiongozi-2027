import 'server-only'
import type { Prisma, User } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/**
 * All User table access. Note that every lookup key here is a hash — no query
 * in this file ever accepts a raw phone number or a raw national ID.
 */

export const userRepository = {
  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } })
  },

  findByPhoneHash(phoneHash: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { phoneHash } })
  },

  findByIdNumberHash(idNumberHash: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { idNumberHash } })
  },

  /**
   * Returns whichever identifier is already taken, so registration can tell the
   * citizen precisely which field is the duplicate instead of a vague "already
   * registered".
   */
  async findExistingIdentity(
    phoneHash: string,
    idNumberHash: string,
  ): Promise<{ phoneTaken: boolean; idTaken: boolean }> {
    const matches = await prisma.user.findMany({
      where: { OR: [{ phoneHash }, { idNumberHash }] },
      select: { phoneHash: true, idNumberHash: true },
    })

    return {
      phoneTaken: matches.some((m) => m.phoneHash === phoneHash),
      idTaken: matches.some((m) => m.idNumberHash === idNumberHash),
    }
  },

  create(data: Prisma.UserCreateInput, tx?: Prisma.TransactionClient): Promise<User> {
    return (tx ?? prisma).user.create({ data })
  },

  count(): Promise<number> {
    return prisma.user.count()
  },

  /** Registrations grouped by county, for the participation-by-region panel. */
  async countByCounty(): Promise<Array<{ county: string; users: number }>> {
    const rows = await prisma.user.groupBy({
      by: ['county'],
      _count: { _all: true },
      where: { county: { not: null } },
    })

    return rows
      .map((row) => ({ county: row.county as string, users: row._count._all }))
      .sort((a, b) => b.users - a.users)
  },
}
