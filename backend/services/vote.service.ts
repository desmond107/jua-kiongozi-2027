import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { tokenRepository } from '@/backend/repositories/token.repository'
import { voteRepository } from '@/backend/repositories/vote.repository'
import type { FlagColor, SubmitBallotPayload, SubmitVotePayload, VoteChoice } from '@/backend/validators'
import { ApiError } from '@/backend/utils/http.util'
import { verifyToken } from './token.service'

/**
 * Vote submission.
 *
 * THE CHAIN, in the order it is enforced:
 *   1. Re-hash the submitted token and look it up. Unknown hash → reject.
 *   2. Confirm the token belongs to the signed-in account, and that the
 *      account's ID hash still matches the one the token was bound to.
 *   3. Confirm the candidate exists.
 *   4. Inside a transaction, write the Vote row and record the TokenUsage.
 *
 * WHAT THE SINGLE-USE RULE ACTUALLY CAPS
 * ──────────────────────────────────────
 * One *voice* per citizen per candidate, not one submission. A citizen who
 * comes back and rates the same candidate again REVISES what they said: the
 * existing row is updated in place, so the published totals still count them
 * exactly once — they simply count what the person currently thinks rather than
 * what they thought the first time they clicked.
 *
 * This is the honest reading of the guarantee. A platform that publishes
 * sentiment and then refuses to hear that sentiment change is not protecting
 * the totals, it is preserving stale ones; and the citizen's alternative was to
 * delete their account and re-register, which the tombstone table exists to
 * prevent. `@@unique([userId, candidateId])` on Vote and Flag is still the
 * authoritative guarantee, and it is what makes the upserts below collapse a
 * concurrent double-submission into one row.
 */

export type BallotReceipt = {
  candidateId: string
  candidateName: string
  choice: SubmitBallotPayload['choice']
  color?: SubmitBallotPayload['color']
  recordedAt: string
  candidatesRated: number
  /**
   * True when this replaced an answer the citizen had already given. Drives the
   * "updated" wording in the UI and the 200-vs-201 status on the endpoint —
   * a revision creates nothing.
   */
  revised: boolean
}

/** A citizen's standing answer on one candidate, for prefilling the widget. */
export type CitizenRating = {
  candidateId: string
  choice: VoteChoice | null
  color: FlagColor | null
  recordedAt: string
  /** Last time either half changed. Equal to `recordedAt` if never revised. */
  updatedAt: string
  revised: boolean
}

async function requireCandidate(candidateId: string) {
  const candidate = await candidateRepository.findById(candidateId)
  if (!candidate) throw ApiError.notFound('That candidate could not be found.')
  return candidate
}

/**
 * Records a vote and a flag together in one transaction, replacing either half
 * the citizen had already answered.
 *
 * This is the path the product UI uses: the two answers are collected on one
 * screen, so writing them atomically means a citizen can never end up with a
 * vote counted but their trust flag lost — nor, on a revision, with a new vote
 * sitting beside a stale flag.
 */
export async function submitBallot(
  payload: SubmitBallotPayload,
  sessionUserId: string,
): Promise<BallotReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)
  const candidate = await requireCandidate(payload.candidateId)

  const { revised, recordedAt } = await prisma.$transaction(async (tx) => {
    // Read inside the transaction: whether this is a first rating or a revision
    // is the one thing the receipt cannot recover afterwards, and a read taken
    // outside could be answering about a snapshot this write has moved past.
    const previous = await voteRepository.findForUserAndCandidate(userId, candidate.id, tx)

    const vote = await voteRepository.upsert(
      { userId, candidateId: candidate.id, choice: payload.choice, county },
      tx,
    )

    // The flag half is upserted on the same terms. It used to be preserved once
    // written, so a citizen who changed their mind kept the old colour and the
    // receipt had to report a colour they had not chosen. Both halves now move
    // together, which is what the screen they were collected on implies.
    await flagRepository.upsert(
      { userId, candidateId: candidate.id, color: payload.color, county },
      tx,
    )

    await ensureUsageRecorded(token.id, candidate.id, tx)
    await tokenRepository.markFirstUse(token.id, tx)

    return { revised: previous !== null, recordedAt: vote.updatedAt }
  })

  const rated = await tokenRepository.spentCandidateIds(token.id)

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    choice: payload.choice,
    color: payload.color,
    recordedAt: recordedAt.toISOString(),
    candidatesRated: rated.length,
    revised,
  }
}

/**
 * Records a vote only.
 *
 * Kept separate from `submitBallot` so the vote and flag endpoints can be used
 * independently by API consumers. The token usage record is written by
 * whichever of the two arrives first, and the per-model unique constraints
 * still cap each citizen at one standing vote and one standing flag per
 * candidate.
 */
export async function submitVote(
  payload: SubmitVotePayload,
  sessionUserId: string,
): Promise<BallotReceipt> {
  const { token, userId, county } = await verifyToken(payload.token, sessionUserId)
  const candidate = await requireCandidate(payload.candidateId)

  const { revised, recordedAt } = await prisma.$transaction(async (tx) => {
    const previous = await voteRepository.findForUserAndCandidate(userId, candidate.id, tx)

    const vote = await voteRepository.upsert(
      { userId, candidateId: candidate.id, choice: payload.choice, county },
      tx,
    )
    await ensureUsageRecorded(token.id, candidate.id, tx)
    await tokenRepository.markFirstUse(token.id, tx)

    return { revised: previous !== null, recordedAt: vote.updatedAt }
  })

  const rated = await tokenRepository.spentCandidateIds(token.id)

  return {
    candidateId: candidate.id,
    candidateName: candidate.fullName,
    choice: payload.choice,
    recordedAt: recordedAt.toISOString(),
    candidatesRated: rated.length,
    revised,
  }
}

/**
 * This citizen's standing answer on a candidate, or null if they have not rated
 * them yet.
 *
 * The widget needs this to open pre-filled with what they said last time. A
 * "change your mind" flow that starts blank is a trap: the citizen cannot see
 * what they are replacing, and re-picking from scratch invites them to submit
 * a half-remembered answer as a deliberate revision.
 *
 * Either half can be null, because `/api/vote` and `/api/flag` may be used
 * separately.
 */
export async function citizenRatingFor(
  userId: string,
  candidateId: string,
): Promise<CitizenRating | null> {
  const [vote, flag] = await Promise.all([
    voteRepository.findForUserAndCandidate(userId, candidateId),
    flagRepository.findForUserAndCandidate(userId, candidateId),
  ])

  if (!vote && !flag) return null

  // The pair is one rating in the citizen's eyes, so it reports the earliest
  // first answer and the latest change across both halves.
  const halves = [vote, flag].filter((half) => half !== null)
  const recordedAt = new Date(Math.min(...halves.map((half) => half.createdAt.getTime())))
  const updatedAt = new Date(Math.max(...halves.map((half) => half.updatedAt.getTime())))

  return {
    candidateId,
    choice: vote?.choice ?? null,
    color: flag?.color ?? null,
    recordedAt: recordedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    /**
     * Compared WITHIN each half, never across the pair.
     *
     * The vote and the flag are two rows written microseconds apart, so the
     * flag's creation timestamp is routinely later than the vote's. Comparing
     * the aggregate `updatedAt` against the aggregate `recordedAt` therefore
     * reports every brand-new rating as already revised.
     */
    revised: halves.some((half) => half.updatedAt.getTime() > half.createdAt.getTime()),
  }
}

/**
 * Records the token spend for this candidate, once.
 *
 * Safe to call on every submission — including a revision, where the row
 * already exists and must not be duplicated. See `tokenRepository.recordUsage`
 * for why this cannot be a find-then-create inside a transaction.
 */
export async function ensureUsageRecorded(
  tokenId: string,
  candidateId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tokenRepository.recordUsage(tokenId, candidateId, tx)
}
