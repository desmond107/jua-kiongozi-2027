import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/**
 * The erased-account tombstones.
 *
 * Every method here deals only in hashes. Nothing in this file reads or writes
 * a name, a county, a masked digit or a timestamp tied to a person's activity —
 * see the model comment in schema.prisma for why the hashes outlive the account
 * and why nothing else does.
 */

export const deletedIdentityRepository = {
  /**
   * Reports which of the two identifiers belongs to an erased account.
   *
   * Shaped like `userRepository.findExistingIdentity` on purpose: registration
   * has to ask both tables the same question, and matching shapes keep the two
   * checks from drifting into different answers.
   */
  async findErased(
    phoneHash: string,
    idNumberHash: string,
  ): Promise<{ phoneErased: boolean; idErased: boolean }> {
    const matches = await prisma.deletedIdentity.findMany({
      where: { OR: [{ phoneHash }, { idNumberHash }] },
      select: { phoneHash: true, idNumberHash: true },
    })

    return {
      phoneErased: matches.some((match) => match.phoneHash === phoneHash),
      idErased: matches.some((match) => match.idNumberHash === idNumberHash),
    }
  },

  create(
    data: { phoneHash: string; idNumberHash: string },
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    return (tx ?? prisma).deletedIdentity.create({ data, select: { id: true } })
  },

  /** Total erasures, for the transparency note. A count, never a list. */
  count(): Promise<number> {
    return prisma.deletedIdentity.count()
  },
}
