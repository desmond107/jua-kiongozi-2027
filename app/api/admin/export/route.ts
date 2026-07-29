import type { NextRequest } from 'next/server'
import { buildExport } from '@/backend/services/admin.service'
import { getAdminSession } from '@/backend/services/adminSession.service'
import { exportQuerySchema } from '@/backend/validators'
import { ApiError, handle } from '@/backend/utils/http.util'
import { toCsv, toXlsx } from '@/backend/utils/export.util'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/export?dataset=registrants&format=xlsx&county=Nairobi
 *
 * The authorisation check is the FIRST thing that happens, before the query
 * string is even parsed. This route is the one that actually emits registrant
 * data, so it re-checks the session itself rather than relying on the fact that
 * the pages linking to it sit behind a guarded layout — a layout guard protects
 * the page, not the endpoint, and this endpoint is reachable directly.
 */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await getAdminSession()
    if (!session) throw ApiError.unauthorized('Administrator sign-in required.')

    const params = request.nextUrl.searchParams
    const query = exportQuerySchema.parse({
      dataset: params.get('dataset') ?? undefined,
      format: params.get('format') ?? 'csv',
      county: params.get('county') ?? undefined,
    })

    const { tables, stem } = await buildExport(query.dataset, query.county)

    console.info(
      `[admin] export: ${session.username} → ${query.dataset}.${query.format}` +
        `${query.county ? ` (${query.county})` : ''}`,
    )

    // Downloads of personal data must never be cached by a proxy or left in the
    // browser's disk cache for the next person at the machine.
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Robots-Tag': 'noindex, nofollow',
    }

    if (query.format === 'xlsx') {
      const workbook = toXlsx(tables)

      return new Response(new Uint8Array(workbook), {
        headers: {
          ...headers,
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${stem}.xlsx"`,
          'Content-Length': String(workbook.byteLength),
        },
      })
    }

    // CSV is single-table by nature. A multi-sheet dataset exports its first
    // sheet here and the whole workbook as .xlsx — stated in the UI so the
    // operator is not left wondering where the second table went.
    return new Response(toCsv(tables[0]), {
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${stem}.csv"`,
      },
    })
  })
}
