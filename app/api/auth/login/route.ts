import type { NextRequest } from 'next/server'
import { login } from '@/backend/services/auth.service'
import { setSessionCookie } from '@/backend/services/session.service'
import { loginSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, clientIp, consumeRateLimit } from '@/backend/utils/rateLimiter.util'
import { hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login
 *
 * Authenticates a returning citizen with phone number + voting token so they
 * can check their voting status. Logging in never issues a new token and never
 * returns the existing one.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const payload = await parseBody(request, loginSchema)

    const ip = clientIp(request)
    const phoneKey = hashPhoneNumber(normalisePhoneNumber(payload.phoneNumber)).slice(0, 32)

    const byIp = await consumeRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many sign-in attempts. Please wait a few minutes and try again.',
        byIp.retryAfter,
      )
    }

    // Rate limiting the phone number too is what makes brute-forcing a token
    // against a known number impractical.
    const byPhone = await consumeRateLimit(`login:phone:${phoneKey}`, RATE_LIMITS.loginByPhone)
    if (!byPhone.allowed) {
      throw ApiError.tooManyRequests(
        'Too many sign-in attempts for this number. Please wait a few minutes.',
        byPhone.retryAfter,
      )
    }

    const result = await login(payload)

    await setSessionCookie({
      userId: result.userId,
      name: result.name,
      serial: result.serial,
    })

    return ok(result)
  })
}
