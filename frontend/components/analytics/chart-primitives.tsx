'use client'

import type { ReactNode } from 'react'
import { cn } from '@/frontend/lib/utils'

/**
 * Shared chart furniture: surface, tooltip shell, legend.
 *
 * Two rules enforced here rather than repeated in every chart:
 *  - text always wears text tokens (bone / bone-muted / bone-dim), never the
 *    series colour; a swatch beside the label carries identity instead
 *  - a legend is always present for two or more series, so identity is never
 *    communicated by colour alone
 */

/** The surface every chart is drawn on. Charts are validated against this colour. */
export const CHART_SURFACE = '#131A29'

/** Recessive grid and axis tokens — present, never competing with the data. */
export const AXIS = {
  stroke: 'rgb(247 245 240 / 0.10)',
  tick: { fill: '#8A93A6', fontSize: 12 },
}

export function ChartPanel({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('glass p-5 sm:p-6', className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg font-semibold text-bone">{title}</h3>
          {description ? <p className="text-sm text-bone-dim">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export type LegendItem = { label: string; color: string; value?: number; hint?: string }

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-5 gap-y-2', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-bone-muted">{item.label}</span>
          {item.value !== undefined ? (
            <span className="font-medium text-bone">{item.value.toLocaleString('en-KE')}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Tooltip shell. Recharts passes it an already-filtered payload. */
export function TooltipShell({
  label,
  rows,
}: {
  label?: string
  rows: Array<{ name: string; value: number; color: string; share?: string }>
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-ink-900/95 px-3.5 py-2.5 shadow-lift backdrop-blur-xl">
      {label ? <p className="mb-1.5 text-xs font-semibold text-bone">{label}</p> : null}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <span className="text-bone-dim">{row.name}</span>
            <span className="ml-auto pl-3 font-medium text-bone">
              {row.value.toLocaleString('en-KE')}
              {row.share ? <span className="ml-1 text-bone-dim">({row.share})</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
