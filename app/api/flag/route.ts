import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ANALYTICS_CACHE_TAG } from '@/backend/services/analytics.service'
import { getSession } from '@/backend/services/session.service'
import { submitFlag } from '@/backend/services/flag.service'
import { submitFlagSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/flag
 *
 * Records a trust flag on its own. The product UI submits flags through
 * `/api/vote` alongside the sentiment vote; this endpoint exists so the two can
 * be submitted independently.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await getSession()
    if (!session) {
      throw ApiError.unauthorized('Please sign in with your voter card before flagging a candidate.')
    }

    const byIp = await consumeIpRateLimit(request, 'flag:ip', RATE_LIMITS.voteByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many submissions from this connection. Please try again shortly.',
        byIp.retryAfter,
      )
    }

    // Keyed on the account, and NOT optional. `consumeIpRateLimit` skips itself
    // entirely where no trustworthy client IP exists, so without this layer a
    // deployment lacking `request.ip` and `TRUSTED_PROXY_HOPS` would leave this
    // endpoint with no rate limiting at all. `/api/vote` has always had both;
    // this one was missing its per-user half.
    const byUser = await consumeRateLimit(`flag:user:${session.userId}`, RATE_LIMITS.voteByUser)
    if (!byUser.allowed) {
      throw ApiError.tooManyRequests(
        'Too many submissions. Please try again shortly.',
        byUser.retryAfter,
      )
    }

    const payload = await parseBody(request, submitFlagSchema)
    const receipt = await submitFlag(payload, session.userId)

    revalidateTag(ANALYTICS_CACHE_TAG)
    revalidatePath('/transparency')
    revalidatePath('/candidates')
    revalidatePath('/')

    return ok(receipt, { status: 201 })
  })
}
