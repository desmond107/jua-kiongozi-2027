import 'server-only'
import type { Prisma } from '@prisma/client'
import { phoneVerificationRepository } from '@/backend/repositories/phoneVerification.repository'
import {
  generateOtpCode,
  hashOtpCode,
  hashPhoneNumber,
  hashesMatch,
  maskTail,
  normalisePhoneNumber,
} from '@/backend/utils/crypto.util'
import { ApiError } from '@/backend/utils/http.util'
import { sendSms } from '@/backend/utils/sms.util'

/**
 * Phone verification: prove control of a number before an account exists.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 * ─────────────────────────────────
 * It proves the registrant can receive SMS on the number they gave. It does NOT
 * prove the national ID they type belongs to them — no data source available to
 * this platform can establish that. What it changes is the economics: an
 * attacker who wants a thousand fake voters now needs a thousand real SIM cards
 * instead of a thousand made-up eight-digit numbers.
 *
 * It is also what makes the registration conflict messages safe. Telling a
 * caller "this phone is already registered" is only a privacy leak if anyone can
 * ask about any number; once the caller has proven they hold the SIM, they are
 * being told a fact about their own number.
 */

/** Codes live for ten minutes — long enough for slow SMS, short enough to matter. */
const CODE_TTL_SECONDS = 10 * 60

/** Wrong guesses permitted per challenge before it is dead. */
export const MAX_OTP_ATTEMPTS = 5

/** Minimum gap between code requests for one number, in seconds. */
const RESEND_COOLDOWN_SECONDS = 60

export type OtpChallenge = {
  /** Masked for display: "a code was sent to ***456". */
  phoneMasked: string
  expiresInSeconds: number
  /** Present only outside production, so the dev flow needs no SMS account. */
  devCode?: string
}

/**
 * Issues a verification code for a phone number.
 *
 * Deliberately returns the same shape whether or not the number is already
 * registered: this endpoint must not become the enumeration oracle that the
 * registration endpoint used to be.
 */
export async function requestPhoneVerification(rawPhone: string): Promise<OtpChallenge> {
  const phone = normalisePhoneNumber(rawPhone)
  const phoneHash = hashPhoneNumber(phone)

  const latest = await phoneVerificationRepository.findLatest(phoneHash)

  if (latest) {
    const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000

    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw ApiError.tooManyRequests(
        'A code was just sent to that number. Please wait a moment before asking for another.',
        Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      )
    }
  }

  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000)

  // Send BEFORE recording. If the provider is down, the citizen gets an honest
  // error instead of a challenge row for a code that never arrived — and the
  // cooldown above is not consumed by a failure that was not their fault.
  await sendSms(
    phone,
    `${code} is your Jua Kiongozi '27 verification code. It expires in 10 minutes. ` +
      `We will never ask you for this code.`,
  )

  // Any older live challenge is superseded, so only the newest code works.
  await phoneVerificationRepository.consumeAllFor(phoneHash)
  await phoneVerificationRepository.create({
    phoneHash,
    codeHash: hashOtpCode(code, phoneHash),
    expiresAt,
  })

  return {
    phoneMasked: maskTail(phone),
    expiresInSeconds: CODE_TTL_SECONDS,
    ...(process.env.NODE_ENV === 'production' ? {} : { devCode: code }),
  }
}

/** Raised for every verification failure, so no variant is distinguishable. */
function invalidCode(): ApiError {
  return ApiError.badRequest(
    'That verification code is not valid or has expired. Request a new one.',
    { otpCode: 'Incorrect or expired code.' },
  )
}

/**
 * Checks a submitted code WITHOUT burning it, returning the challenge id.
 *
 * Separated from consumption so the caller can verify early — before any lookup
 * that could reveal whether an identity is registered — but only spend the code
 * at the moment the account is actually created. A citizen whose registration
 * fails for an unrelated reason keeps a working code.
 *
 * Wrong guesses are counted here, so the attempt cap applies to probing even
 * when no registration follows.
 */
export async function assertPhoneVerified(rawPhone: string, code: string): Promise<string> {
  const phoneHash = hashPhoneNumber(normalisePhoneNumber(rawPhone))

  const challenge = await phoneVerificationRepository.findActive(phoneHash, MAX_OTP_ATTEMPTS)
  if (!challenge) throw invalidCode()

  if (!hashesMatch(challenge.codeHash, hashOtpCode(code, phoneHash))) {
    await phoneVerificationRepository.recordFailedAttempt(challenge.id)
    throw invalidCode()
  }

  return challenge.id
}

/**
 * Burns a verified challenge. Call inside the transaction that creates the
 * account, so the code and the account commit or roll back together.
 *
 * The repository's conditional update is the atomic point of no return: two
 * concurrent registrations carrying the same valid code both pass
 * `assertPhoneVerified`, and exactly one wins here.
 */
export async function consumeVerifiedChallenge(
  challengeId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const consumed = await phoneVerificationRepository.consume(challengeId, tx)
  if (!consumed) throw invalidCode()
}
