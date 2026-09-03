import type { NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { deleteAccount } from '@/backend/services/auth.service'
import { ANALYTICS_CACHE_TAG } from '@/backend/services/analytics.service'
import { clearSessionCookie, getSession } from '@/backend/services/session.service'
import { deleteAccountSchema } from '@/backend/validators'
import { ApiError, handle, ok, parseBody } from '@/backend/utils/http.util'
import { RATE_LIMITS, consumeIpRateLimit, consumeRateLimit } from '@/backend/utils/rateLimiter.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/delete-account
 *
 * Permanently erases the signed-in citizen's account, their voting token and
 * every rating they cast. There is no undo and no recovery path.
 *
 * POST rather than DELETE because the request carries a body — the phone number
 * and SMS code that authorise it. DELETE with a body is legal but poorly
 * supported by intermediaries, and this is the one request on the site that
 * must not be silently mangled in transit.
 *
 * Three things must hold together, exactly as for the token reveal: a valid
 * session, the phone number this account registered with, and a fresh code sent
 * to it. A session alone is deliberately insufficient — a borrowed handset must
 * not be able to destroy somebody's participation.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await getSession()
    if (!session) {
      throw ApiError.unauthorized('Please sign in before deleting your account.')
    }

    const byIp = await consumeIpRateLimit(
      request,
      'delete-account:ip',
      RATE_LIMITS.deleteAccountByIp,
    )
    if (!byIp.allowed) {
      throw ApiError.tooManyRequests(
        'Too many attempts from this connection. Please wait and try again.',
        byIp.retryAfter,
      )
    }

    const byUser = await consumeRateLimit(
      `delete-account:user:${session.userId}`,
      RATE_LIMITS.deleteAccountByUser,
    )
    if (!byUser.allowed) {
      throw ApiError.tooManyRequests(
        'Too many attempts for this account. Please wait and try again.',
        byUser.retryAfter,
      )
    }

    const payload = await parseBody(request, deleteAccountSchema)

    const receipt = await deleteAccount(session.userId, payload.phoneNumber, payload.otpCode)

    // The session now points at a row that no longer exists. Clearing the cookie
    // here means the browser is signed out the moment the response lands, rather
    // than carrying a token for a deleted account until it expires.
    await clearSessionCookie()

    // Their ratings were counted in the published aggregates and no longer are,
    // so the cached snapshot is stale the instant this returns. Same
    // invalidation the vote route performs, for the same reason.
    revalidateTag(ANALYTICS_CACHE_TAG)
    revalidatePath('/transparency')

    console.info(
      `[account] erased: ${receipt.votesRemoved} votes, ${receipt.flagsRemoved} flags removed`,
    )

    const response = ok(receipt)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    return response
  })
}
