import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ANALYTICS_CACHE_TAG } from '@/backend/services/analytics.service'
import { getSession } from '@/backend/services/session.service'
import { submitBallot, submitVote } from '@/backend/services/vote.service'
import { submitBallotSchema, submitVoteSchema } from '@/backend/validators'
import { ApiError, handle, ok } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/vote
 *
 * Records a sentiment vote. If the body also carries a `color`, the vote and
 * the trust flag are written together in a single transaction — that is the
 * path the product UI uses, since both answers are collected on one screen.
 *
 * Token verification, account binding and single-use enforcement all happen in
 * `vote.service`; this handler only validates shape and applies rate limits.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await getSession()
    if (!session) {
      throw ApiError.unauthorized('Please sign in with your voter card before rating a candidate.')
    }

    const byIp = await consumeIpRateLimit(request, 'vote:ip', RATE_LIMITS.voteByIp)
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many submissions from this connection. Please try again shortly.',
        byIp.retryAfter,
      )
    }

    const byUser = await consumeRateLimit(
      `vote:user:${session.userId}`,
      RATE_LIMITS.voteByUser,
    )
    if (!byUser.allowed) {
      throw ApiError.tooManyRequests(
        'Too many submissions. Please try again shortly.',
        byUser.retryAfter,
      )
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw ApiError.badRequest('Request body must be valid JSON.')
    }

    // A combined ballot (vote + flag) is the normal case; a vote on its own is
    // still accepted for API consumers that submit the two separately.
    const combined = submitBallotSchema.safeParse(raw)

    const receipt = combined.success
      ? await submitBallot(combined.data, session.userId)
      : await submitVote(submitVoteSchema.parse(raw), session.userId)

    // Push fresh numbers to the cached public pages. The tag invalidates the
    // shared analytics computation; the paths drop the rendered HTML.
    revalidateTag(ANALYTICS_CACHE_TAG)
    revalidatePath('/transparency')
    revalidatePath('/candidates')
    revalidatePath('/')

    return ok(receipt, { status: 201 })
  })
}
