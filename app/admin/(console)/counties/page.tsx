import { getCountyAnalysis } from '@/backend/services/admin.service'
import { ExportButtons } from '@/frontend/components/admin/export-buttons'
import { FlagIcon } from '@/frontend/components/ui/flag-icon'
import { FLAG_COLOR_ORDER, FLAG_META, VOTE_CHOICE_ORDER, VOTE_CHOICE_LABELS } from '@/backend/validators'
import { formatNumber } from '@/frontend/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Voting analysis by county.
 *
 * Every figure is a GROUP BY total. There is no drill-down to an individual and
 * there is deliberately no route that would provide one — see the header note
 * in `admin.repository.ts`.
 */
export default async function AdminCountiesPage() {
  const analysis = await getCountyAnalysis()

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">Counties</h1>
          <p className="mt-1 text-sm text-bone-dim">
            Participation and sentiment for each of the 47 counties.
          </p>
        </div>
      </header>

      {analysis.unrepresented.length > 0 ? (
        <p className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-4 text-sm leading-relaxed text-bone-muted">
          <strong className="font-semibold text-bone">
            {analysis.unrepresented.length} of 47 counties have no registrations yet:
          </strong>{' '}
          {analysis.unrepresented.join(', ')}. Results skew toward the counties that are
          represented, and any figure drawn from them should say so.
        </p>
      ) : null}

      <section className="glass overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">Summary by county</h2>
            <p className="mt-1 text-sm text-bone-dim">Registrations, activity and local leader.</p>
          </div>
          <ExportButtons dataset="summary" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th scope="col" className="px-5 py-3 font-medium text-bone-muted">County</th>
                <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                  Registered
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                  Votes
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                  Flags
                </th>
                <th scope="col" className="px-5 py-3 font-medium text-bone-muted">
                  Leading candidate
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.counties.map((county) => (
                <tr
                  key={county.county}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <th scope="row" className="px-5 py-3 text-left font-medium text-bone">
                    {county.county}
                  </th>
                  <td className="px-3 py-3 text-right tabular-nums text-bone-muted">
                    {formatNumber(county.registrations)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-bone-muted">
                    {formatNumber(county.totalVotes)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-bone-muted">
                    {formatNumber(county.totalFlags)}
                  </td>
                  <td className="px-5 py-3 text-bone-muted">
                    {county.leading
                      ? `${county.leading.candidateName} — ${county.leading.approvalRate}%`
                      : '—'}
                  </td>
                </tr>
              ))}
              {analysis.counties.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-bone-dim">
                    No registrations yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">
              Candidate by county
            </h2>
            <p className="mt-1 text-sm text-bone-dim">
              Every county and candidate pairing that has at least one rating.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons dataset="county-votes" note="votes" />
            <ExportButtons dataset="county-flags" note="flags" />
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="sticky top-0 bg-ink-900/95 backdrop-blur">
              <tr className="border-b border-white/10 text-left">
                <th scope="col" className="px-5 py-3 font-medium text-bone-muted">County</th>
                <th scope="col" className="px-3 py-3 font-medium text-bone-muted">Candidate</th>
                {VOTE_CHOICE_ORDER.map((choice) => (
                  <th
                    key={choice}
                    scope="col"
                    className="px-3 py-3 text-right font-medium text-bone-muted"
                  >
                    {VOTE_CHOICE_LABELS[choice]}
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                  Approval
                </th>
                {FLAG_COLOR_ORDER.map((color) => (
                  <th
                    key={color}
                    scope="col"
                    className="px-3 py-3 text-right font-medium text-bone-muted"
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      <FlagIcon color={color} className="h-3.5 w-3.5" />
                      <span className="sr-only">{FLAG_META[color].label}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map((row) => (
                <tr
                  key={`${row.county}-${row.candidateId}`}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                >
                  <th scope="row" className="px-5 py-3 text-left font-normal text-bone-muted">
                    {row.county}
                  </th>
                  <td className="px-3 py-3 font-medium text-bone">{row.candidateName}</td>
                  {VOTE_CHOICE_ORDER.map((choice) => (
                    <td
                      key={choice}
                      className="px-3 py-3 text-right tabular-nums text-bone-muted"
                    >
                      {formatNumber(row.votes[choice])}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-bone">
                    {row.totalVotes > 0 ? `${row.approvalRate}%` : '—'}
                  </td>
                  {FLAG_COLOR_ORDER.map((color) => (
                    <td key={color} className="px-3 py-3 text-right tabular-nums text-bone-muted">
                      {formatNumber(row.flags[color])}
                    </td>
                  ))}
                </tr>
              ))}
              {analysis.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-sm text-bone-dim">
                    No ratings cast yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
