import type { NextRequest } from 'next/server'
import { authenticateAdmin } from '@/backend/services/admin.service'
import { setAdminSessionCookie } from '@/backend/services/adminSession.service'
import { adminLoginSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/login
 *
 * Two independent buckets are consumed before the password is ever checked:
 * one keyed by IP, one by the submitted username. The username bucket is the
 * one that matters against a botnet, where every request arrives from a fresh
 * address and an IP-only limit never fills.
 *
 * The username is lowercased for the bucket key so that "OneTerm" and "oneterm"
 * cannot be used as two separate allowances against the same account.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const payload = await parseBody(request, adminLoginSchema)

    const byIp = await consumeIpRateLimit(request, 'admin-login:ip', RATE_LIMITS.adminLoginByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many sign-in attempts. Please wait and try again.',
        byIp.retryAfter,
      )
    }

    const byUsername = await consumeRateLimit(
      `admin-login:user:${payload.username.toLowerCase()}`,
      RATE_LIMITS.adminLoginByUsername,
    )
    if (!byUsername.allowed) {
      throw ApiError.tooManyRequests(
        'This account is temporarily locked after too many attempts.',
        byUsername.retryAfter,
      )
    }

    const claims = await authenticateAdmin({
      username: payload.username.toLowerCase(),
      password: payload.password,
    })

    await setAdminSessionCookie(claims)

    // A failed attempt is worth a server-side log line; a successful one more
    // so. This is the only record that an operator opened the console.
    console.info(`[admin] sign-in: ${claims.username}`)

    return ok({ username: claims.username })
  })
}
