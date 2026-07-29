'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/frontend/components/ui/primitives'
import type { CountyChart as CountyChartType } from './county-chart'
import type { FlagDistributionChart as FlagDistributionChartType } from './flag-distribution-chart'
import type { ResultsChart as ResultsChartType } from './results-chart'

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
 * WHY A MOUNT GATE RATHER THAN `ssr: false`
 * ─────────────────────────────────────────
 * `dynamic(..., { ssr: false })` looks like the obvious way to keep Recharts off
 * the server, and it was used here originally. It causes a hydration failure.
 *
 * During SSR it throws Next's internal "Bail out to client-side rendering"
 * signal, so the server writes the `loading` fallback — the skeleton — into the
 * HTML. On the client the chart chunk is already preloaded, so React's first
 * render produces the real chart instead. Server markup and first client render
 * therefore disagree, which is precisely the condition React reports as
 * "Hydration failed because the initial UI does not match what was rendered on
 * the server."
 *
 * Gating on a mounted flag removes the ambiguity. `mounted` is false on the
 * server AND on the first client render, so both passes emit the same skeleton
 * and hydration matches by construction. The chart mounts on the effect that
 * follows, which is also the only point at which Recharts can measure the
 * container it needs. The dynamic import still splits the chunk, so the bundle
 * saving is unchanged.
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

/**
 * False during SSR and on the first client render, true thereafter.
 *
 * The effect cannot run on the server, so the two initial passes are guaranteed
 * to agree — which is the entire point.
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

// No `ssr: false` on any of these: the mount gate below already guarantees they
// are never rendered on the server, and adding it would reintroduce the bail-out
// that writes a mismatched fallback into the HTML.
const ResultsChartImpl = dynamic(() => import('./results-chart').then((m) => m.ResultsChart))

const FlagDistributionChartImpl = dynamic(() =>
  import('./flag-distribution-chart').then((m) => m.FlagDistributionChart),
)

const CountyChartImpl = dynamic(() => import('./county-chart').then((m) => m.CountyChart))

export function ResultsChart(props: ComponentProps<typeof ResultsChartType>) {
  return useMounted() ? <ResultsChartImpl {...props} /> : <ChartSkeleton />
}

export function FlagDistributionChart(
  props: ComponentProps<typeof FlagDistributionChartType>,
) {
  return useMounted() ? <FlagDistributionChartImpl {...props} /> : <ChartSkeleton />
}

export function CountyChart(props: ComponentProps<typeof CountyChartType>) {
  return useMounted() ? <CountyChartImpl {...props} /> : <ChartSkeleton height={260} />
}
