import { getCandidateAnalytics } from '@/backend/services/analytics.service'
import { handle, ok } from '@/backend/utils/http.util'

export const revalidate = 60

/**
 * GET /api/analytics/[candidateId]
 *
 * Public per-candidate aggregates. Accepts a cuid or a slug.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  return handle(async () => {
    const { candidateId } = await params
    const analytics = await getCandidateAnalytics(candidateId)
    return ok(analytics)
  })
}
