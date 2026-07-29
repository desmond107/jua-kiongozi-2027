import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'
import { userRepository } from '@/backend/repositories/user.repository'
import { tokenRepository } from '@/backend/repositories/token.repository'
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

  const existing = await userRepository.findExistingIdentity(phoneHash, idNumberHash)

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
