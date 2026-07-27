import { accountStatus } from '@/backend/services/auth.service'
import { clearSessionCookie, getSession } from '@/backend/services/session.service'
import { ApiError, handle, ok } from '@/backend/utils/http.util'

export const dynamic = 'force-dynamic'

/** GET /api/auth/session — current account and voting progress, or `null`. */
export async function GET() {
  return handle(async () => {
    const session = await getSession()
    if (!session) return ok(null)

    try {
      return ok(await accountStatus(session.userId))
    } catch (error) {
      // The cookie is validly signed but names an account that no longer
      // exists — after an erasure request, or a database reset. That is "signed
      // out", not a server fault, so the stale cookie is dropped rather than
      // left to fail on every subsequent request.
      if (error instanceof ApiError && error.status === 404) {
        clearSessionCookie()
        return ok(null)
      }
      throw error
    }
  })
}

/** DELETE /api/auth/session — sign out. */
export async function DELETE() {
  return handle(async () => {
    clearSessionCookie()
    return ok({ signedOut: true })
  })
}
