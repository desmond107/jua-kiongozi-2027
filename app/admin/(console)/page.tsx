import Link from 'next/link'
import { Activity, Flag, MapPin, Users, Vote } from 'lucide-react'
import { getOverview } from '@/backend/services/admin.service'
import { ExportButtons } from '@/frontend/components/admin/export-buttons'
import { formatNumber } from '@/frontend/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Console overview.
 *
 * Reads live rather than through the 60-second analytics cache: an operator
 * checking whether a spike is happening needs the current number, not one from
 * up to a minute ago, and this page serves a handful of people rather than the
 * public dashboard's traffic.
 */

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 text-bone-dim">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-bone">{value}</p>
      {hint ? <p className="mt-1 text-xs text-bone-dim">{hint}</p> : null}
    </div>
  )
}

export default async function AdminOverviewPage() {
  const overview = await getOverview()

  const peak = Math.max(1, ...overview.velocity.map((day) => day.users))

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-bone">Overview</h1>
          <p className="mt-1 text-sm text-bone-dim">
            Live figures across the whole platform.
          </p>
        </div>
        <ExportButtons dataset="summary" note="Excel includes the per-county sheet" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Users} label="Registered" value={formatNumber(overview.registeredVoters)} />
        <Stat icon={Vote} label="Votes cast" value={formatNumber(overview.totalVotes)} />
        <Stat icon={Flag} label="Trust flags" value={formatNumber(overview.totalFlags)} />
        <Stat
          icon={Activity}
          label="Participation"
          value={`${overview.participationRate}%`}
          hint="Ratings cast against every citizen rating every candidate"
        />
        <Stat
          icon={MapPin}
          label="Counties active"
          value={`${overview.countiesRepresented} / 47`}
          hint="Counties with at least one registration"
        />
        <Stat icon={Users} label="Candidates" value={formatNumber(overview.candidates)} />
      </div>

      <section className="glass p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-bone">
          Registrations, last 30 days
        </h2>
        <p className="mt-1 text-sm text-bone-dim">
          A flat baseline with one sharp spike is what scripted registration looks like.
        </p>

        {overview.velocity.length === 0 ? (
          <p className="mt-5 text-sm text-bone-dim">No registrations in this window.</p>
        ) : (
          // Bars in plain CSS rather than a charting library: this is one series
          // of at most 30 values, and the transparency page already pays for
          // Recharts on the public side.
          <ul className="mt-5 flex h-32 items-end gap-1">
            {overview.velocity.map((day) => (
              // `h-full` on the item is load-bearing. The bar's height is a
              // percentage, and a percentage resolves against the parent's
              // height only if that height is definite. Under `items-end` the
              // item would otherwise be sized to its content — which is the bar
              // — so the percentage would be circular and collapse to zero.
              <li
                key={day.day}
                className="flex h-full flex-1 items-end"
                title={`${day.day}: ${day.users}`}
              >
                <div
                  className={
                    day.users === 0
                      ? 'w-full rounded-t bg-white/10'
                      : 'w-full rounded-t bg-gradient-to-t from-verdant/40 to-verdant'
                  }
                  // A day with no registrations gets a 2px baseline tick, NOT
                  // the minimum-height floor: a floor would draw a visible green
                  // bar for zero, which reads as activity and is the opposite of
                  // what the flat baseline is meant to show. The floor applies
                  // only to real, non-zero counts, so a single registration on a
                  // busy chart stays visible.
                  style={{
                    height: day.users === 0 ? '2px' : `${Math.max(6, (day.users / peak) * 100)}%`,
                  }}
                />
                <span className="sr-only">
                  {day.day}: {day.users} registrations
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-bone">Top counties</h2>
            <p className="mt-1 text-sm text-bone-dim">By registrations.</p>
          </div>
          <Link href="/admin/counties" className="text-sm text-gold hover:underline">
            All 47 counties →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
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
                <th scope="col" className="px-5 py-3 font-medium text-bone-muted">Leading</th>
              </tr>
            </thead>
            <tbody>
              {overview.topCounties.map((county) => (
                <tr key={county.county} className="border-b border-white/[0.06] last:border-0">
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
                      ? `${county.leading.candidateName} (${county.leading.approvalRate}%)`
                      : '—'}
                  </td>
                </tr>
              ))}
              {overview.topCounties.length === 0 ? (
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
    </div>
  )
}
