import type { NextRequest } from 'next/server'
import { register } from '@/backend/services/auth.service'
import { setSessionCookie } from '@/backend/services/session.service'
import { registerSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import {
  RATE_LIMITS,
  clientIp,
  consumeRateLimit,
} from '@/backend/utils/rateLimiter.util'
import { hashPhoneNumber, normalisePhoneNumber } from '@/backend/utils/crypto.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register
 *
 * Creates an account and issues the one-time voting token.
 *
 * This is the ONLY endpoint in the application that ever returns a raw voting
 * token, and it does so exactly once — the value is not persisted in plaintext,
 * not logged, and cannot be retrieved again by any route.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const payload = await parseBody(request, registerSchema)

    // Two independent buckets: one per IP (blocks a single machine farming
    // accounts) and one per phone number (blocks the same number being retried
    // across many IPs).
    const ip = clientIp(request)
    const phoneKey = hashPhoneNumber(normalisePhoneNumber(payload.phoneNumber)).slice(0, 32)

    const byIp = await consumeRateLimit(`register:ip:${ip}`, RATE_LIMITS.registerByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many registration attempts from this connection. Please try again later.',
        byIp.retryAfter,
      )
    }

    const byPhone = await consumeRateLimit(
      `register:phone:${phoneKey}`,
      RATE_LIMITS.registerByPhone,
    )
    if (!byPhone.allowed) {
      throw ApiError.tooManyRequests(
        'Too many registration attempts for this phone number. Please try again later.',
        byPhone.retryAfter,
      )
    }

    const result = await register(payload)

    // Sign the citizen in so they land on the Voter Card already authenticated
    // and can go straight to rating candidates.
    await setSessionCookie({
      userId: result.userId,
      name: result.name,
      serial: result.serial,
    })

    return ok(result, { status: 201 })
  })
}
