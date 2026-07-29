import type { NextRequest } from 'next/server'
import { getSession } from '@/backend/services/session.service'
import { revealToken } from '@/backend/services/token.service'
import { revealTokenSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/reveal-token
 *
 * Returns the signed-in citizen's own voting token in the clear.
 *
 * Three things must hold at once: a valid session, the phone number this
 * account registered with, and a fresh SMS code sent to it. A session alone is
 * deliberately not enough — see `revealToken` in token.service.ts for why that
 * matters to the platform's central guarantee.
 *
 * The response is never cached and the token never appears in a URL, so it
 * cannot land in browser history, a referrer header or an access log.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await getSession()
    if (!session) {
      throw ApiError.unauthorized('Please sign in before retrieving your voting token.')
    }


    const byIp = await consumeIpRateLimit(request, 'reveal:ip', RATE_LIMITS.revealByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many attempts from this connection. Please wait a few minutes.',
        byIp.retryAfter,
      )
    }

    // Keyed on the account rather than the phone, so the limit follows the
    // session being used to probe rather than the number being guessed.
    const byUser = await consumeRateLimit(`reveal:user:${session.userId}`, RATE_LIMITS.revealByUser)
    if (!byUser.allowed) {
      throw ApiError.tooManyRequests(
        'Too many attempts for this account. Please wait a few minutes.',
        byUser.retryAfter,
      )
    }

    const payload = await parseBody(request, revealTokenSchema)
    const revealed = await revealToken(session.userId, payload.phoneNumber, payload.otpCode)

    const response = ok(revealed)

    // This body carries voting authority and must not sit in a shared cache or
    // a browser's back-forward cache.
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')

    return response
  })
}
