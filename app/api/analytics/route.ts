import type { NextRequest } from 'next/server'
import { getCachedSnapshot, toCsv } from '@/backend/services/analytics.service'
import { analyticsQuerySchema } from '@/backend/validators'
import { handle, ok } from '@/backend/utils/http.util'

/**
 * The route is dynamic because it reads `?format=`, but the expensive part is
 * not: `getCachedSnapshot` memoises the aggregate queries for 60 seconds behind
 * a cache tag, shared with the transparency page. So the public dashboard —
 * comfortably the heaviest-traffic surface here — costs one set of GROUP BY
 * queries per minute regardless of how many people load it.
 */
export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics — public, no authentication.
 * GET /api/analytics?format=csv — the same aggregates as a downloadable CSV.
 *
 * Aggregate counts only. Nothing returned here can be traced to an individual.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { format } = analyticsQuerySchema.parse({
      format: request.nextUrl.searchParams.get('format') ?? 'json',
    })

    const snapshot = await getCachedSnapshot()

    if (format === 'csv') {
      const filename = `jua-kiongozi-27-results-${snapshot.generatedAt.slice(0, 10)}.csv`

      return new Response(toCsv(snapshot), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=60',
        },
      })
    }

    return ok(snapshot)
  })
}
