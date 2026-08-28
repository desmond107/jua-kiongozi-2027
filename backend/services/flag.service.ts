import 'server-only'
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
 * one *standing* flag per candidate. Re-flagging a candidate changes that
 * answer rather than being refused — see the note at the top of `vote.service`
 * for why the guarantee is read that way.
 */

export type FlagReceipt = {
  candidateId: string
  candidateName: string
  color: SubmitFlagPayload['color']
  recordedAt: string
  /** True when this replaced a flag the citizen had already set. */
  revised: boolean
}

export async function submitFlag(
  payload: SubmitFlagPayload,
  sessionUserId: string,
): Promise<FlagReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)

  const candidate = await candidateRepository.findById(payload.candidateId)
  if (!candidate) throw ApiError.notFound('That candidate could not be found.')

  const { revised, recordedAt } = await prisma.$transaction(async (tx) => {
    const previous = await flagRepository.findForUserAndCandidate(userId, candidate.id, tx)

    const flag = await flagRepository.upsert(
      { userId, candidateId: candidate.id, color: payload.color, county },
      tx,
    )
    await ensureUsageRecorded(token.id, candidate.id, tx)
    await tokenRepository.markFirstUse(token.id, tx)

    return { revised: previous !== null, recordedAt: flag.updatedAt }
  })

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    color: payload.color,
    recordedAt: recordedAt.toISOString(),
    revised,
  }
}
