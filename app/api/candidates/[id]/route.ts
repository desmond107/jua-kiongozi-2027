import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { getCandidateBySlug } from '@/backend/services/candidate.service'
import { ApiError, handle, ok } from '@/backend/utils/http.util'

export const revalidate = 60

/**
 * GET /api/candidates/[id]
 *
 * Accepts either a cuid or a slug, so links can stay human-readable
 * (`/api/candidates/martha-karua`) without needing a second endpoint.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const byId = await candidateRepository.findById(params.id)
    const slug = byId?.slug ?? params.id

    const candidate = await getCandidateBySlug(slug).catch(() => null)
    if (!candidate) throw ApiError.notFound('That candidate could not be found.')

    return ok(candidate)
  })
}
