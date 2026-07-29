import type { NextRequest } from 'next/server'
import { login, loginWithIdNumber } from '@/backend/services/auth.service'
import { setSessionCookie } from '@/backend/services/session.service'
import { loginRequestSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'
import { hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login
 *
 * Two ways back in, both keyed to the registered phone number:
 *
 *   method: "token" — phone + voting token. Instant, no SMS. The token is a
 *                     160-bit secret, so presenting it is proof enough.
 *   method: "id"    — phone + national ID + SMS code, for a citizen who no
 *                     longer has their token. An ID number is not a secret in
 *                     Kenya, so this route needs proof of SIM control too. See
 *                     `loginWithIdSchema` for the reasoning.
 *
 * Neither issues a token and neither returns one. Signing in is not voting
 * authority: every rating must still present the raw token separately.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const payload = await parseBody(request, loginRequestSchema)

    const phoneKey = hashPhoneNumber(normalisePhoneNumber(payload.phoneNumber)).slice(0, 32)

    const byIp = await consumeIpRateLimit(request, 'login:ip', RATE_LIMITS.loginByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many sign-in attempts. Please wait a few minutes and try again.',
        byIp.retryAfter,
      )
    }

    // Rate limiting the phone number too is what makes brute-forcing a token —
    // or an ID number — against a known phone impractical.
    const byPhone = await consumeRateLimit(`login:phone:${phoneKey}`, RATE_LIMITS.loginByPhone)
    if (!byPhone.allowed) {
      throw ApiError.tooManyRequests(
        'Too many sign-in attempts for this number. Please wait a few minutes.',
        byPhone.retryAfter,
      )
    }

    const result =
      payload.method === 'token'
        ? await login(payload)
        : await loginWithIdNumber(payload)

    await setSessionCookie({
      userId: result.userId,
      name: result.name,
      serial: result.serial,
    })

    return ok(result)
  })
}
