'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { CandidateSummary } from '@/backend/services/candidate.service'
import { cn } from '@/frontend/lib/utils'
import { CandidateCard } from './candidate-card'

/**
 * The candidate grid, with ordering and a progress line.
 *
 * Two things this fixes:
 *
 *  - There was no way to compare the field except by opening each profile. The
 *    sort control makes the grid a tool rather than a list.
 *  - A signed-in citizen had no idea how far through they were. The voter card
 *    knew, but the page where the rating actually happens did not — and
 *    completing the set is the entire point of the product, so it belongs here.
 *
 * Default order is the seeded `orderIndex`, NOT approval. Ranking candidates by
 * score by default would editorialise: the platform publishes sentiment, it does
 * not present a league table unless a visitor asks for one.
 */

type SortKey = 'default' | 'approval' | 'rated' | 'name'

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'default', label: 'Default order' },
  { key: 'approval', label: 'Most support' },
  { key: 'rated', label: 'Most rated' },
  { key: 'name', label: 'A–Z' },
]

export function CandidateGrid({
  candidates,
  ratedIds,
  signedIn,
}: {
  candidates: CandidateSummary[]
  ratedIds: string[]
  signedIn: boolean
}) {
  const [sort, setSort] = useState<SortKey>('default')
  const rated = useMemo(() => new Set(ratedIds), [ratedIds])

  const ordered = useMemo(() => {
    const copy = [...candidates]

    switch (sort) {
      case 'approval':
        // Unrated candidates have an approval of 0 by definition, which would
        // otherwise rank them as though the public rejected them. They sort to
        // the end instead.
        return copy.sort((a, b) => {
          if (a.totalVotes === 0 && b.totalVotes === 0) return 0
          if (a.totalVotes === 0) return 1
          if (b.totalVotes === 0) return -1
          return b.approvalRate - a.approvalRate
        })
      case 'rated':
        return copy.sort((a, b) => b.totalVotes - a.totalVotes)
      case 'name':
        return copy.sort((a, b) => a.fullName.localeCompare(b.fullName))
      default:
        return copy
    }
  }, [candidates, sort])

  const done = rated.size
  const total = candidates.length
  const complete = done >= total && total > 0

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {signedIn ? (
          <div className="flex items-center gap-3">
            <div
              className="h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.08]"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Candidates you have rated"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-verdant to-gold transition-all duration-700"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-bone-muted">
              {complete ? (
                <span className="flex items-center gap-1.5 text-verdant-soft">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  You have rated every candidate
                </span>
              ) : (
                <>
                  You have rated{' '}
                  <strong className="font-semibold text-bone">
                    {done} of {total}
                  </strong>
                </>
              )}
            </p>
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="candidate-sort" className="text-xs text-bone-dim">
            Order
          </label>
          <select
            id="candidate-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-xl border border-white/12 bg-ink-900/70 px-3 py-2 text-sm text-bone"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            index={index}
            rated={rated.has(candidate.id)}
          />
        ))}
      </div>

      {signedIn && !complete ? (
        <p className={cn('mt-6 text-center text-sm text-bone-dim')}>
          Rate the ones you have not yet reached — every candidate counts separately.
        </p>
      ) : null}
    </>
  )
}
