'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/frontend/components/ui/primitives'

/**
 * Code-split wrappers for the Recharts views.
 *
 * Recharts is ~109KB of the transparency page's JavaScript — comfortably the
 * largest script on the site, and none of it is needed to render the headline
 * figures, the methodology panel, or the results TABLE, which is the accessible
 * equivalent of these charts and is plain server-rendered markup.
 *
 * Splitting it out means the numbers are readable while the charting library is
 * still arriving, which is the right order of priority for a page whose job is
 * publishing results. The table is not lazy — a visitor who needs the data
 * should never wait on a chart bundle to read it.
 *
 * `ssr: false` because Recharts measures the DOM to lay out; server-rendering
 * it produces markup that is thrown away and replaced on hydration anyway.
 */

/** Matches the rendered chart's height so the page does not jump on arrival. */
function ChartSkeleton({ height = 420 }: { height?: number }) {
  return (
    <section className="glass p-5 sm:p-6">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="w-full rounded-2xl" style={{ height }} />
    </section>
  )
}

export const ResultsChart = dynamic(
  () => import('./results-chart').then((m) => m.ResultsChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const FlagDistributionChart = dynamic(
  () => import('./flag-distribution-chart').then((m) => m.FlagDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const CountyChart = dynamic(
  () => import('./county-chart').then((m) => m.CountyChart),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
)
