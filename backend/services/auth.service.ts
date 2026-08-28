import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'
import { userRepository } from '@/backend/repositories/user.repository'
import { tokenRepository } from '@/backend/repositories/token.repository'
import { deletedIdentityRepository } from '@/backend/repositories/deletedIdentity.repository'
import type { LoginPayload, LoginWithIdPayload, RegisterPayload } from '@/backend/validators'
import {
  hashIdNumber,
  hashPhoneNumber,
  hashToken,
  hashesMatch,
  maskTail,
  normalisePhoneNumber,
  publicSerial,
} from '@/backend/utils/crypto.util'
import { ApiError } from '@/backend/utils/http.util'
import { assertPhoneVerified, consumeVerifiedChallenge } from './otp.service'
import { issueToken } from './token.service'

/**
 * Registration and login.
 *
 * Nothing in this module ever persists, returns or logs a raw national ID
 * number, a raw phone number, or a raw voting token. The only place a raw
 * token exists is the `rawToken` field of a registration result, which the API
 * route hands straight to the Voter Card screen and then forgets.
 */

export type RegistrationResult = {
  userId: string
  name: string
  serial: string
  phoneMasked: string
  idMasked: string
  county: string | null
  issuedAt: string
  /** Shown exactly once. Never retrievable again. */
  rawToken: string
}

export async function register(payload: RegisterPayload): Promise<RegistrationResult> {
  const phone = normalisePhoneNumber(payload.phoneNumber)
  const phoneHash = hashPhoneNumber(phone)
  const idNumberHash = hashIdNumber(payload.idNumber)

  // Gate everything behind proof of phone control. This runs FIRST — before any
  // lookup that could reveal whether an identity exists — so an unverified
  // caller learns nothing about who is registered no matter what they submit.
  // The code is checked here but only spent once the account commits, below.
  const challengeId = await assertPhoneVerified(phone, payload.otpCode)

  const [existing, erased] = await Promise.all([
    userRepository.findExistingIdentity(phoneHash, idNumberHash),
    deletedIdentityRepository.findErased(phoneHash, idNumberHash),
  ])

  /**
   * An erased identity may not register again.
   *
   * Without this, deleting an account would hand back a fresh ballot: register,
   * rate every candidate, delete, repeat. One national ID could then cast
   * unlimited ratings, which is precisely the guarantee this platform stakes
   * its results on. The tombstone table exists for this check alone.
   *
   * Same disclosure asymmetry as below — the phone can be named because the
   * caller just proved they hold the SIM; the ID never can.
   */
  if (erased.phoneErased) {
    throw ApiError.conflict(
      'The account for this phone number was permanently deleted at its owner’s request. ' +
        'Deletion cannot be undone, and this number cannot be registered again.',
      { phoneNumber: 'This number’s account was permanently deleted.' },
    )
  }

  if (erased.idErased) {
    throw ApiError.conflict(
      'These details cannot be registered. If you have registered before, sign in with your ' +
        'voting token. If you believe this is an error, contact support.',
    )
  }

  // The caller has just proven they hold this SIM, so naming the phone as the
  // duplicate tells them only a fact about their own number.
  if (existing.phoneTaken) {
    throw ApiError.conflict(
      'This phone number is already registered. Sign in with your voting token instead.',
      { phoneNumber: 'This phone number is already registered.' },
    )
  }

  // The ID is deliberately NOT named. Proving control of one phone must not buy
  // the ability to test arbitrary national ID numbers for registration — that
  // would reveal a stranger's political participation. The message is identical
  // whichever way the ID collides, and carries no field annotation for the form
  // to highlight.
  if (existing.idTaken) {
    throw ApiError.conflict(
      'These details cannot be registered. If you have registered before, sign in with your ' +
        'voting token. If you believe this is an error, contact support.',
    )
  }

  try {
    // One transaction: either the account and its token both exist, or neither
    // does. A user without a token could never vote and could never re-register.
    const result = await prisma.$transaction(async (tx) => {
      // Burn the code first inside the transaction. If two requests race with
      // the same code, the loser fails here and rolls back without having
      // created anything.
      await consumeVerifiedChallenge(challengeId, tx)

      const user = await userRepository.create(
        {
          name: payload.name,
          phoneHash,
          phoneMasked: maskTail(phone),
          idNumberHash,
          idMasked: maskTail(payload.idNumber),
          // Required at registration, so every new account carries one. The
          // column stays nullable for accounts created before county was
          // mandatory — see prisma/schema.prisma.
          county: payload.county,
        },
        tx,
      )

      const { rawToken } = await issueToken(user.id, tx)
      return { user, rawToken }
    })

    return {
      userId: result.user.id,
      name: result.user.name,
      serial: publicSerial(result.user.id),
      phoneMasked: result.user.phoneMasked,
      idMasked: result.user.idMasked,
      county: result.user.county,
      issuedAt: result.user.createdAt.toISOString(),
      rawToken: result.rawToken,
    }
  } catch (error) {
    // P2002 = unique constraint violation. Reached when two registrations for
    // the same person race past the pre-check above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ApiError.conflict('This person is already registered. Each citizen may register once.')
    }
    throw error
  }
}

export type LoginResult = {
  userId: string
  name: string
  serial: string
  phoneMasked: string
  county: string | null
}

/**
 * Authenticates with phone number + voting token.
 *
 * Both a missing account and a wrong token produce the same message and the
 * same amount of work, so the endpoint cannot be used to enumerate which phone
 * numbers are registered.
 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const phone = normalisePhoneNumber(payload.phoneNumber)
  const user = await userRepository.findByPhoneHash(hashPhoneNumber(phone))

  const invalid = ApiError.unauthorized(
    'Those details do not match a registered voter. Check your phone number and token.',
  )

  // Both lookups run unconditionally, even when the phone is unknown. Returning
  // early here would make an unregistered number measurably faster than a
  // registered one and turn this endpoint into the enumeration oracle the
  // uniform error message exists to prevent.
  const submittedHash = hashToken(payload.token)
  const token = await tokenRepository.findByHash(submittedHash)

  if (!user) throw invalid

  if (!token || token.userId !== user.id || !hashesMatch(token.tokenHash, submittedHash)) {
    throw invalid
  }

  // Same status and message as any other failure: a distinct "revoked" response
  // would confirm to a prober that this phone/token pair is real.
  if (token.revokedAt) throw invalid

  return {
    userId: user.id,
    name: user.name,
    serial: publicSerial(user.id),
    phoneMasked: user.phoneMasked,
    county: user.county,
  }
}

/**
 * Signs in with a national ID number and an SMS code, for a citizen who no
 * longer has their voting token.
 *
 * This exists because losing the token used to mean permanent lockout: signing
 * in required the token, and retrieving the token required being signed in.
 * That loop had no entrance. This is the entrance — and note what it does NOT
 * grant. A session is not voting authority: every rating still has to present
 * the raw token, so someone who gets in this way can see their own status and
 * use the SMS-verified reveal flow, but cannot cast anything in another
 * citizen's name.
 *
 * THE CODE IS SPENT WHETHER OR NOT THE ID MATCHES
 * ───────────────────────────────────────────────
 * Deliberate. If a wrong ID left the code usable, someone holding the handset
 * could sit and guess ID numbers against a single SMS. Burning the code on
 * every attempt means each guess costs one message, which the per-phone OTP
 * limit then caps at a handful an hour.
 */
export async function loginWithIdNumber(payload: LoginWithIdPayload): Promise<LoginResult> {
  const phone = normalisePhoneNumber(payload.phoneNumber)

  // Proof of SIM control comes first, before any lookup that could reveal
  // whether this number is registered.
  const challengeId = await assertPhoneVerified(phone, payload.otpCode)
  await consumeVerifiedChallenge(challengeId)

  const user = await userRepository.findByPhoneHash(hashPhoneNumber(phone))

  // Uniform for "no such account" and "wrong ID", so a caller who holds the SIM
  // still cannot use this endpoint to test whether a given ID is registered.
  const invalid = ApiError.unauthorized(
    'Those details do not match a registered voter. Check your ID number and try again.',
  )

  // Computed unconditionally: returning early on an unknown phone would make
  // that case measurably faster and reintroduce the oracle.
  const submittedIdHash = hashIdNumber(payload.idNumber)

  if (!user) throw invalid
  if (!hashesMatch(user.idNumberHash, submittedIdHash)) throw invalid

  return {
    userId: user.id,
    name: user.name,
    serial: publicSerial(user.id),
    phoneMasked: user.phoneMasked,
    county: user.county,
  }
}

export type AccountStatus = {
  userId: string
  name: string
  serial: string
  county: string | null
  registeredAt: string
  ratedCandidateIds: string[]
  candidatesRated: number
}

/** Vote status for the signed-in citizen. Never returns a token. */
export async function accountStatus(userId: string): Promise<AccountStatus> {
  const user = await userRepository.findById(userId)
  if (!user) throw ApiError.notFound('Account not found.')

  const token = await tokenRepository.findActiveForUser(userId)
  const ratedCandidateIds = token ? await tokenRepository.spentCandidateIds(token.id) : []

  return {
    userId: user.id,
    name: user.name,
    serial: publicSerial(user.id),
    county: user.county,
    registeredAt: user.createdAt.toISOString(),
    ratedCandidateIds,
    candidatesRated: ratedCandidateIds.length,
  }
}

/* ──────────────────────────────── erasure ───────────────────────────────── */

export type DeletionReceipt = {
  votesRemoved: number
  flagsRemoved: number
  tokensRemoved: number
  deletedAt: string
}

/**
 * Permanently erases a citizen's account and everything attached to it.
 *
 * WHAT GOES
 * ─────────
 * The user row and, by cascade, the voting token, its usage ledger, and every
 * vote and trust flag that account ever cast. The ratings are removed from the
 * published aggregates too — a person who withdraws consent should not still be
 * counted in the totals, so the numbers on the transparency page can go down.
 * That is the correct behaviour, not a defect, and the transparency page says
 * so rather than letting a reader assume the counts only ever rise.
 *
 * WHAT STAYS, AND WHY
 * ───────────────────
 * Two hashes, in `deleted_identities`. `idNumberHash` is the sole mechanism
 * enforcing one-citizen-one-voice; releasing it would turn this endpoint into
 * an unlimited supply of fresh ballots for anyone willing to delete and
 * re-register. Neither hash is reversible and neither identifies a person on
 * its own. The deletion screen states this plainly before the citizen commits,
 * because "permanent" here also means "you cannot register again".
 *
 * WHY A SESSION IS NOT ENOUGH
 * ───────────────────────────
 * This is the most destructive action on the platform and it cannot be undone.
 * It therefore takes the same proof the token-reveal path takes: the phone
 * number this account registered with, plus a fresh code sent to it. A borrowed
 * or stolen session cannot erase somebody's participation on its own.
 */
export async function deleteAccount(
  userId: string,
  rawPhone: string,
  otpCode: string,
): Promise<DeletionReceipt> {
  const user = await userRepository.findById(userId)
  if (!user) throw ApiError.notFound('Account not found.')

  // The code must have been sent to THIS account's number. Without this, a
  // valid code for any number the caller controls would erase the session
  // owner's account.
  if (!hashesMatch(user.phoneHash, hashPhoneNumber(normalisePhoneNumber(rawPhone)))) {
    throw ApiError.badRequest('That phone number does not match this account.', {
      phoneNumber: 'This is not the number this account registered with.',
    })
  }

  const challengeId = await assertPhoneVerified(rawPhone, otpCode)

  try {
    return await prisma.$transaction(async (tx) => {
      // Burn the code first, inside the transaction. Two concurrent delete
      // requests carrying the same code cannot both proceed: the loser fails
      // here and rolls back having destroyed nothing.
      await consumeVerifiedChallenge(challengeId, tx)

      // Counted inside the transaction so the receipt reports what was actually
      // removed rather than what happened to be there a moment earlier.
      const [votesRemoved, flagsRemoved, tokensRemoved] = await Promise.all([
        tx.vote.count({ where: { userId } }),
        tx.flag.count({ where: { userId } }),
        tx.votingToken.count({ where: { userId } }),
      ])

      // The tombstone is written BEFORE the user row goes, so there is no
      // instant at which the identity is neither registered nor recorded as
      // erased — which is the window a re-registration would need.
      await deletedIdentityRepository.create(
        { phoneHash: user.phoneHash, idNumberHash: user.idNumberHash },
        tx,
      )

      // Cascades to voting_tokens → token_usages, votes and flags.
      await tx.user.delete({ where: { id: userId } })

      return {
        votesRemoved,
        flagsRemoved,
        tokensRemoved,
        deletedAt: new Date().toISOString(),
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 — the row went while we were working. P2002 — a tombstone for
      // this identity already exists. Both mean a concurrent request finished
      // first, so the caller's goal is already met and this is not an error
      // worth showing them as a failure.
      if (error.code === 'P2025' || error.code === 'P2002') {
        throw ApiError.conflict('This account has already been deleted.')
      }
    }
    throw error
  }
}
