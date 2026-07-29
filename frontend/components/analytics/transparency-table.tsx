import Link from 'next/link'
import {
  FLAG_COLOR_ORDER,
  FLAG_META,
  VOTE_CHOICE_COLORS,
  VOTE_CHOICE_LABELS,
  VOTE_CHOICE_ORDER,
  type CandidateAnalytics,
} from '@/backend/validators'
import { formatNumber, formatPercent } from '@/frontend/lib/format'
import { FlagIcon } from '@/frontend/components/ui/flag-icon'

/**
 * The table view of the same data the charts show.
 *
 * This is not a redundant extra — it is the accessible equivalent required
 * alongside any colour-encoded chart, and it is also what makes the numbers
 * quotable. Screen-reader users, anyone who cannot distinguish the flag hues,
 * and anyone who simply wants the exact figures all land here.
 *
 * Server component: pure markup, no interactivity needed.
 */
export function TransparencyTable({ candidates }: { candidates: CandidateAnalytics[] }) {
  return (
    <div className="glass overflow-hidden p-0">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <h3 className="font-display text-lg font-semibold text-bone">Full results table</h3>
        <p className="mt-1 text-sm text-bone-dim">
          Every figure behind the charts above, as exact counts.
        </p>
      </div>

      {/* Wide table scrolls inside its own container so the page never scrolls
          horizontally on a phone. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Vote and trust-flag counts for each declared 2027 presidential candidate.
          </caption>
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th scope="col" className="px-5 py-3 font-medium text-bone-muted">
                Candidate
              </th>
              {VOTE_CHOICE_ORDER.map((choice) => (
                <th key={choice} scope="col" className="px-3 py-3 font-medium text-bone-muted">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: VOTE_CHOICE_COLORS[choice] }}
                      aria-hidden
                    />
                    {VOTE_CHOICE_LABELS[choice]}
                  </span>
                </th>
              ))}
              {FLAG_COLOR_ORDER.map((color) => (
                <th key={color} scope="col" className="px-3 py-3 font-medium text-bone-muted">
                  <span className="flex items-center gap-1.5">
                    <FlagIcon color={color} className="h-3.5 w-3.5" />
                    {FLAG_META[color].label}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-right font-medium text-bone-muted">
                Approval
              </th>
            </tr>
          </thead>

          <tbody>
            {candidates.map((candidate) => (
              <tr
                key={candidate.candidateId}
                className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
              >
                <th scope="row" className="px-5 py-3.5 text-left font-normal">
                  <Link
                    href={`/candidates/${candidate.slug}`}
                    className="rounded font-medium text-bone hover:text-gold"
                  >
                    {candidate.fullName}
                  </Link>
                  <span className="block text-xs text-bone-dim">
                    {candidate.party ?? 'Not publicly declared'}
                  </span>
                </th>

                {VOTE_CHOICE_ORDER.map((choice) => (
                  <td key={choice} className="px-3 py-3.5 tabular-nums text-bone-muted">
                    {formatNumber(candidate.votes[choice])}
                  </td>
                ))}

                {FLAG_COLOR_ORDER.map((color) => (
                  <td key={color} className="px-3 py-3.5 tabular-nums text-bone-muted">
                    {formatNumber(candidate.flags[color])}
                  </td>
                ))}

                <td className="px-3 py-3.5 text-right font-medium tabular-nums text-bone">
                  {candidate.totalVotes > 0 ? formatPercent(candidate.approvalRate) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
