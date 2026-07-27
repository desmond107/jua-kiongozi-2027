import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { tokenRepository } from '@/backend/repositories/token.repository'
import type { SubmitFlagPayload } from '@/backend/validators'
import { ApiError } from '@/backend/utils/http.util'
import { verifyToken } from './token.service'
import { ensureUsageRecorded } from './vote.service'

/**
 * Trust-flag submission.
 *
 * Follows the identical verification chain as `vote.service`: re-hash the
 * token, confirm the account binding, confirm the candidate, then write under
 * the `@@unique([userId, candidateId])` constraint that caps each citizen at
 * one flag per candidate.
 */

export type FlagReceipt = {
  candidateId: string
  candidateName: string
  color: SubmitFlagPayload['color']
  recordedAt: string
}

export async function submitFlag(
  payload: SubmitFlagPayload,
  sessionUserId: string,
): Promise<FlagReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)

  const candidate = await candidateRepository.findById(payload.candidateId)
  if (!candidate) throw ApiError.notFound('That candidate could not be found.')

  const existing = await flagRepository.findForUserAndCandidate(userId, candidate.id)
  if (existing) {
    throw ApiError.conflict('You have already flagged this candidate.')
  }

  try {
    await prisma.$transaction(async (tx) => {
      await flagRepository.create(
        { userId, candidateId: candidate.id, color: payload.color, county },
        tx,
      )
      await ensureUsageRecorded(token.id, candidate.id, tx)
      await tokenRepository.markFirstUse(token.id, tx)
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ApiError.conflict('You have already flagged this candidate.')
    }
    throw error
  }

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    color: payload.color,
    recordedAt: new Date().toISOString(),
  }
}
