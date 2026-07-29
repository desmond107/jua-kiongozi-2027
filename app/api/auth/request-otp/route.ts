import type { NextRequest } from 'next/server'
import { requestPhoneVerification } from '@/backend/services/otp.service'
import { requestOtpSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'
import { SmsDeliveryError } from '@/backend/utils/sms.util'
import { hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/request-otp
 *
 * Sends a six-digit code to a phone number, which `/api/auth/register` then
 * requires. This is the cost that makes fake registrations expensive.
 *
 * The response is identical whether or not the number is already registered.
 * Making it otherwise would move the enumeration oracle out of registration and
 * into here rather than removing it.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const payload = await parseBody(request, requestOtpSchema)

    const phoneKey = hashPhoneNumber(normalisePhoneNumber(payload.phoneNumber)).slice(0, 32)

    const byIp = await consumeIpRateLimit(request, 'otp:ip', RATE_LIMITS.otpByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many codes requested from this connection. Please try again later.',
        byIp.retryAfter,
      )
    }

    const byPhone = await consumeRateLimit(`otp:phone:${phoneKey}`, RATE_LIMITS.otpByPhone)
    if (!byPhone.allowed) {
      throw ApiError.tooManyRequests(
        'Too many codes requested for this number. Please try again later.',
        byPhone.retryAfter,
      )
    }

    try {
      return ok(await requestPhoneVerification(payload.phoneNumber))
    } catch (error) {
      if (error instanceof SmsDeliveryError) {
        // The underlying reason is a deployment fault (missing credentials,
        // provider outage) and is logged, not shown — it would tell an attacker
        // about the infrastructure and means nothing to a citizen.
        console.error('[request-otp] SMS delivery failed:', error.message)
        throw new ApiError(
          503,
          'SMS_UNAVAILABLE',
          'We could not send your code right now. Please try again in a few minutes.',
        )
      }
      throw error
    }
  })
}
