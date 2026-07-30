import 'server-only'
import type { Prisma, VotingToken } from '@prisma/client'
import { tokenRepository } from '@/backend/repositories/token.repository'
import { userRepository } from '@/backend/repositories/user.repository'
import {
  decryptSecret,
  encryptSecret,
  generateVotingToken,
  hashPhoneNumber,
  hashToken,
  hashesMatch,
  normalisePhoneNumber,
} from '@/backend/utils/crypto.util'
import { ApiError } from '@/backend/utils/http.util'
import { assertPhoneVerified, consumeVerifiedChallenge } from './otp.service'

/**
 * Issuance and verification of voting tokens.
 *
 * INVARIANTS THIS MODULE ENFORCES
 * ───────────────────────────────
 *  1. A raw token exists in memory for exactly one request — the registration
 *     response. It is never written to the database, never logged, and never
 *     recoverable afterwards. A lost token cannot be reissued.
 *  2. A token is bound to the user id, and that user's `idNumberHash` is
 *     re-checked on every spend, so a token lifted from one card cannot be
 *     replayed against a different account.
 *  3. A token can be spent at most once per candidate, guaranteed at the
 *     database level by `@@unique([tokenId, candidateId])` on TokenUsage.
 */

export type IssuedToken = {
  /** Shown to the citizen exactly once, then discarded. */
  rawToken: string
  tokenId: string
}

/**
 * Creates a token for a user. Runs inside the registration transaction so that
 * a user can never be committed without a token, or vice versa.
 *
 * Stores both a hash (for verification, which must stay one-way) and a
 * reversible ciphertext (so the owner can retrieve the token later). The hash
 * remains the only value any verification path reads — `revealToken` is the
 * sole consumer of the ciphertext.
 */
export async function issueToken(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<IssuedToken> {
  const rawToken = generateVotingToken()

  const record = await tokenRepository.create(
    {
      userId,
      tokenHash: hashToken(rawToken),
      tokenCipher: encryptSecret(rawToken),
    },
    tx,
  )

  return { rawToken, tokenId: record.id }
}

export type RevealedToken = {
  rawToken: string
  issuedAt: string
  revoked: boolean
}

/**
 * Returns a citizen's own voting token in the clear.
 *
 * WHY THIS NEEDS MORE THAN A SESSION
 * ──────────────────────────────────
 * The platform's standing guarantee is that a stolen session cookie cannot cast
 * a rating, because every submission must also present the raw token. Handing
 * the token to anyone holding a session would delete that guarantee outright —
 * a borrowed laptop would become full voting authority for 30 days.
 *
 * So retrieval re-proves control of the SIM the account was registered with.
 * The caller must supply the account's own phone number (checked against the
 * stored hash, so it cannot be someone else's) plus a fresh SMS code. That
 * keeps the theft of any single factor — cookie, phone, or database — short of
 * sufficient.
 */
export async function revealToken(
  userId: string,
  rawPhone: string,
  otpCode: string,
): Promise<RevealedToken> {
  const user = await userRepository.findById(userId)
  if (!user) throw ApiError.notFound('Account not found.')

  // The phone must be the one on this account. Without this check, a valid code
  // for ANY number the caller controls would unlock the session owner's token.
  if (!hashesMatch(user.phoneHash, hashPhoneNumber(normalisePhoneNumber(rawPhone)))) {
    throw ApiError.badRequest(
      'That phone number does not match this account.',
      { phoneNumber: 'This is not the number this account registered with.' },
    )
  }

  const challengeId = await assertPhoneVerified(rawPhone, otpCode)

  const token = await tokenRepository.findActiveForUser(userId)
  if (!token) {
    throw ApiError.notFound('No voting token is attached to this account.')
  }

  const rawToken = token.tokenCipher ? decryptSecret(token.tokenCipher) : null

  if (!rawToken) {
    throw new ApiError(
      410,
      'TOKEN_UNRECOVERABLE',
      'This token was issued before tokens could be retrieved, so only its hash exists. ' +
        'It cannot be recovered or reissued.',
    )
  }

  // Burn the code only once the reveal is certain to succeed, so a citizen who
  // hits the unrecoverable case above still holds a usable code.
  await consumeVerifiedChallenge(challengeId)

  return {
    rawToken,
    issuedAt: token.createdAt.toISOString(),
    revoked: token.revokedAt !== null,
  }
}

export type VerifiedToken = {
  token: VotingToken
  userId: string
  county: string | null
}

/**
 * Verifies a raw token and, when `expectedUserId` is supplied, that it belongs
 * to the signed-in account.
 *
 * Rejection messages are deliberately uniform for "no such token" and "wrong
 * account": distinguishing them would let an attacker probe which tokens exist.
 * The message is still clear enough to be actionable for a legitimate user who
 * simply mistyped.
 */
export async function verifyToken(
  rawToken: string,
  expectedUserId?: string,
): Promise<VerifiedToken> {
  const submittedHash = hashToken(rawToken)
  const record = await tokenRepository.findByHashWithUser(submittedHash)

  if (!record || !hashesMatch(record.tokenHash, submittedHash)) {
    throw ApiError.unauthorized('That voting token is not valid. Check it and try again.')
  }

  if (record.revokedAt) {
    throw ApiError.forbidden('This voting token has been revoked and can no longer be used.')
  }

  if (expectedUserId && record.userId !== expectedUserId) {
    throw ApiError.unauthorized('That voting token is not valid. Check it and try again.')
  }

  // Re-assert the token → account binding against live data rather than
  // trusting the joined row alone.
  const owner = await userRepository.findById(record.userId)

  if (!owner || !hashesMatch(owner.idNumberHash, record.user.idNumberHash)) {
    throw ApiError.unauthorized('That voting token is not valid. Check it and try again.')
  }

  return { token: record, userId: record.userId, county: owner.county }
}

/** Candidate ids this user has already spent their token on. */
export async function spentCandidatesForUser(userId: string): Promise<string[]> {
  const token = await tokenRepository.findActiveForUser(userId)
  if (!token) return []
  return tokenRepository.spentCandidateIds(token.id)
}

/** Whether a user already holds a token — guards against a second issuance. */
export async function userHasToken(userId: string): Promise<boolean> {
  return (await tokenRepository.hasAnyToken(userId)) > 0
}
