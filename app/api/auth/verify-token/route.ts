import type { NextRequest } from 'next/server'
import { getSession } from '@/backend/services/session.service'
import { verifyToken } from '@/backend/services/token.service'
import { tokenRepository } from '@/backend/repositories/token.repository'
import { verifyTokenSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, clientIp, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/verify-token
 *
 * Checks a voting token without spending it — used by the voting widget to
 * confirm a token before the citizen commits to a rating, so a typo surfaces
 * before submission rather than after.
 *
 * Returns only which candidates the token has already been used on. It never
 * echoes the token back.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await getSession()
    if (!session) throw ApiError.unauthorized()

    const ip = clientIp(request)
    const limit = await consumeRateLimit(`verify:ip:${ip}`, RATE_LIMITS.loginByIp)
    if (!limit.allowed) {
      throw ApiError.tooManyRequests(
        'Too many verification attempts. Please wait a few minutes.',
        limit.retryAfter,
      )
    }

    const payload = await parseBody(request, verifyTokenSchema)
    const { token } = await verifyToken(payload.token, session.userId)
    const spentCandidateIds = await tokenRepository.spentCandidateIds(token.id)

    return ok({
      valid: true,
      spentCandidateIds,
      candidatesRated: spentCandidateIds.length,
    })
  })
}
