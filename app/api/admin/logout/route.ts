import { clearAdminSessionCookie } from '@/backend/services/adminSession.service'
import { handle, ok } from '@/backend/utils/http.util'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/logout
 *
 * POST rather than GET so that a link or an image on another page cannot sign
 * an operator out by being loaded.
 *
 * This clears the cookie; it does not revoke the JWT, which stays valid until
 * it expires. That is the same limitation the citizen session has, and it is
 * the reason admin sessions are 8 hours rather than 30 days.
 */
export async function POST() {
  return handle(async () => {
    clearAdminSessionCookie()
    return ok({ signedOut: true })
  })
}
