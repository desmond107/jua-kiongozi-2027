import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getRegistrants } from '@/backend/services/admin.service'
import { registrantQuerySchema } from '@/backend/validators'
import { ExportButtons } from '@/frontend/components/admin/export-buttons'
import { RegistrantFilters } from '@/frontend/components/admin/registrant-filters'
import { formatNumber } from '@/frontend/lib/format'

export const dynamic = 'force-dynamic'

/**
 * The registrant list.
 *
 * Phone and ID columns show the masked values because masked values are all
 * that exist — registration HMAC-hashes both before storing, so the full
 * numbers are unrecoverable by this page, by the export, and by anyone holding
 * a copy of the database. The banner says so plainly rather than leaving an
 * operator to wonder whether there is a permission that would reveal more.
 *
 * `votesCast` / `flagsCast` are counts, never choices.
 */

const NAIROBI = 'Africa/Nairobi'

/**
 * Dates are rendered in Nairobi time with an explicit timezone.
 *
 * Left to the runtime default, the server formats in UTC and the browser in
 * local time — which disagree for 12.5% of all timestamps and produce a
 * hydration mismatch. Pinning the zone makes both passes identical, and Nairobi
 * is also simply the right zone for the reader.
 */
function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: NAIROBI,
  }).format(value)
}

export default async function AdminRegistrantsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const parsed = registrantQuerySchema.safeParse({
    county: typeof searchParams.county === 'string' ? searchParams.county : undefined,
    search: typeof searchParams.search === 'string' ? searchParams.search : undefined,
    page: typeof searchParams.page === 'string' ? searchParams.page : 1,
  })

  // An unparseable query string falls back to the unfiltered first page rather
  // than throwing — a hand-edited URL should not produce an error screen.
  const query = parsed.success ? parsed.data : registrantQuerySchema.parse({})
  const { rows, total, page, pageCount } = await getRegistrants(query)

  const pageHref = (next: number) => {
    const params = new URLSearchParams()
    if (query.county) params.set('county', query.county)
    if (query.search) params.set('search', query.search)
    if (next > 1) params.set('page', String(next))
    const qs = params.toString()
    return qs ? `/admin/registrants?${qs}` : '/admin/registrants'
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">Registrants</h1>
          <p className="mt-1 text-sm text-bone-dim">
            {formatNumber(total)} {total === 1 ? 'citizen' : 'citizens'}
            {query.county ? ` in ${query.county}` : ''}
            {query.search ? ` matching “${query.search}”` : ''}.
          </p>
        </div>
        <ExportButtons
          dataset="registrants"
          county={query.county}
          note={query.county ? `${query.county} only` : 'all counties'}
        />
      </header>

      <p className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-bone-dim">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-bone-muted" aria-hidden />
        <span>
          Phone numbers and national ID numbers are stored as HMAC-SHA256 hashes. The masked
          values below are the complete stored record — the full numbers cannot be recovered by
          this console, by the export, or by anyone holding the database.{' '}
          <strong className="font-semibold text-bone-muted">
            Individual voting choices are not shown anywhere in this console.
          </strong>{' '}
          The counts are how many candidates a person has rated, never which way.
        </span>
      </p>

      <RegistrantFilters county={query.county} search={query.search} />

      <section className="glass overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <caption className="sr-only">
              Registered citizens with masked identifiers and participation counts.
            </caption>
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th scope="col" className="px-5 py-3 font-medium text-bone-muted">Name</th>
                <th scope="col" className="px-3 py-3 font-medium text-bone-muted">County</th>
                <th scope="col" className="px-3 py-3 font-medium text-bone-muted">Phone</th>
                <th scope="col" className="px-3 py-3 font-medium text-bone-muted">ID</th>
                <th scope="col" className="px-3 py-3 font-medium text-bone-muted">Registered</th>
                <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                  Voted
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium text-bone-muted">
                  Flagged
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <th scope="row" className="px-5 py-3 text-left font-medium text-bone">
                    {row.name}
                  </th>
                  <td className="px-3 py-3 text-bone-muted">{row.county ?? 'Not stated'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-bone-muted">
                    {row.phoneMasked}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-bone-muted">{row.idMasked}</td>
                  <td className="px-3 py-3 text-xs text-bone-dim">
                    {formatDate(row.registeredAt)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-bone-muted">
                    {row.votesCast}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-bone-muted">
                    {row.flagsCast}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-bone-dim">
                    No registrants match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {pageCount > 1 ? (
        <nav
          aria-label="Registrant pages"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-gold hover:underline">
              ← Previous
            </Link>
          ) : (
            <span className="text-bone-dim">← Previous</span>
          )}

          <span className="text-bone-dim">
            Page {page} of {pageCount}
          </span>

          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="text-gold hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-bone-dim">Next →</span>
          )}
        </nav>
      ) : null}
    </div>
  )
}
