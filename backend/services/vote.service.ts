import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { tokenRepository } from '@/backend/repositories/token.repository'
import { voteRepository } from '@/backend/repositories/vote.repository'
import type { SubmitBallotPayload, SubmitVotePayload } from '@/backend/validators'
import { ApiError } from '@/backend/utils/http.util'
import { verifyToken } from './token.service'

/**
 * Vote submission.
 *
 * THE SINGLE-USE CHAIN, in the order it is enforced:
 *   1. Re-hash the submitted token and look it up. Unknown hash → reject.
 *   2. Confirm the token belongs to the signed-in account, and that the
 *      account's ID hash still matches the one the token was bound to.
 *   3. Confirm the candidate exists.
 *   4. Inside a transaction, write the Vote row and record the TokenUsage.
 *      `@@unique([userId, candidateId])` on Vote and `@@unique([tokenId,
 *      candidateId])` on TokenUsage are the authoritative guarantees — steps
 *      1–3 produce good error messages, but these constraints are what hold
 *      under concurrent duplicate requests.
 */

export type BallotReceipt = {
  candidateId: string
  candidateName: string
  choice: SubmitBallotPayload['choice']
  color?: SubmitBallotPayload['color']
  recordedAt: string
  candidatesRated: number
}

/** Translates a duplicate-key race into the same message the pre-check gives. */
function asDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw ApiError.conflict('You have already rated this candidate. Each candidate is rated once.')
  }
  throw error
}

async function requireCandidate(candidateId: string) {
  const candidate = await candidateRepository.findById(candidateId)
  if (!candidate) throw ApiError.notFound('That candidate could not be found.')
  return candidate
}

/**
 * Records a vote and a flag together in one transaction.
 *
 * This is the path the product UI uses: the two answers are collected on one
 * screen, so writing them atomically means a citizen can never end up with a
 * vote counted but their trust flag lost (or the reverse).
 */
export async function submitBallot(
  payload: SubmitBallotPayload,
  sessionUserId: string,
): Promise<BallotReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)
  const candidate = await requireCandidate(payload.candidateId)

  const alreadyVoted = await voteRepository.findForUserAndCandidate(userId, candidate.id)
  if (alreadyVoted) {
    throw ApiError.conflict('You have already rated this candidate. Each candidate is rated once.')
  }

  try {
    await prisma.$transaction(async (tx) => {
      await voteRepository.create(
        { userId, candidateId: candidate.id, choice: payload.choice, county },
        tx,
      )
      await flagRepository.create(
        { userId, candidateId: candidate.id, color: payload.color, county },
        tx,
      )
      // Spends the token against this candidate. Any concurrent duplicate
      // request fails here and the whole transaction rolls back.
      await tokenRepository.recordUsage(token.id, candidate.id, tx)
      await tokenRepository.markFirstUse(token.id, tx)
    })
  } catch (error) {
    asDuplicate(error)
  }

  const rated = await tokenRepository.spentCandidateIds(token.id)

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    choice: payload.choice,
    color: payload.color,
    recordedAt: new Date().toISOString(),
    candidatesRated: rated.length,
  }
}

/**
 * Records a vote only.
 *
 * Kept separate from `submitBallot` so the vote and flag endpoints can be used
 * independently by API consumers. The token usage record is created on
 * whichever of the two arrives first, and the per-model unique constraints
 * still cap each citizen at one vote and one flag per candidate.
 */
export async function submitVote(
  payload: SubmitVotePayload,
  sessionUserId: string,
): Promise<BallotReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)
  const candidate = await requireCandidate(payload.candidateId)

  const alreadyVoted = await voteRepository.findForUserAndCandidate(userId, candidate.id)
  if (alreadyVoted) {
    throw ApiError.conflict('You have already voted on this candidate.')
  }

  try {
    await prisma.$transaction(async (tx) => {
      await voteRepository.create(
        { userId, candidateId: candidate.id, choice: payload.choice, county },
        tx,
      )
      await ensureUsageRecorded(token.id, candidate.id, tx)
      await tokenRepository.markFirstUse(token.id, tx)
    })
  } catch (error) {
    asDuplicate(error)
  }

  const rated = await tokenRepository.spentCandidateIds(token.id)

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    choice: payload.choice,
    recordedAt: new Date().toISOString(),
    candidatesRated: rated.length,
  }
}

/**
 * Records the token spend, tolerating the case where the paired flag (or vote)
 * submission already recorded it for this candidate.
 */
export async function ensureUsageRecorded(
  tokenId: string,
  candidateId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const existing = await tx.tokenUsage.findUnique({
    where: { tokenId_candidateId: { tokenId, candidateId } },
  })

  if (!existing) {
    await tokenRepository.recordUsage(tokenId, candidateId, tx)
  }
}
