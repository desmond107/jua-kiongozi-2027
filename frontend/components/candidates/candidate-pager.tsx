import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CandidateNeighbours } from '@/backend/services/candidate.service'
import { cn } from '@/frontend/lib/utils'

/**
 * Previous / next navigation between candidate profiles.
 *
 * A profile used to be a dead end: rating all seven meant returning to the grid
 * between each one. Participation is the entire product, so friction on that
 * loop is the most expensive friction on the site. The pager wraps around, so
 * there is always somewhere to go next.
 *
 * Position is stated ("3 of 7") because a reader stepping through the field
 * should know how much is left — the same reason the voter card shows progress.
 */
export function CandidatePager({
  neighbours,
  className,
}: {
  neighbours: CandidateNeighbours
  className?: string
}) {
  const { previous, next, position, total } = neighbours

  return (
    <nav
      aria-label="Candidate navigation"
      className={cn('flex items-center justify-between gap-3', className)}
    >
      {previous ? (
        <Link
          href={`/candidates/${previous.slug}`}
          rel="prev"
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
        >
          <ChevronLeft
            className="h-4 w-4 shrink-0 text-bone-dim transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-bone-dim">
              Previous
            </span>
            <span className="block truncate text-sm font-medium text-bone">
              {previous.fullName}
            </span>
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}

      <span className="shrink-0 px-1 text-xs tabular-nums text-bone-dim">
        {position} of {total}
      </span>

      {next ? (
        <Link
          href={`/candidates/${next.slug}`}
          rel="next"
          className="group flex min-w-0 flex-1 items-center justify-end gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right transition-colors hover:border-white/25 hover:bg-white/[0.06]"
        >
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-bone-dim">
              Next
            </span>
            <span className="block truncate text-sm font-medium text-bone">{next.fullName}</span>
          </span>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-bone-dim transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  )
}
