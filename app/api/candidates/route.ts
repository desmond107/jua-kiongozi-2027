import { listCandidates } from '@/backend/services/candidate.service'
import { handle, ok } from '@/backend/utils/http.util'

/** Candidate data changes rarely; the flag counts alongside it can be a minute stale. */
export const revalidate = 60

/** GET /api/candidates — all candidates with their flag-distribution summary. */
export async function GET() {
  return handle(async () => {
    const candidates = await listCandidates()
    return ok(candidates)
  })
}
