import * as React from 'react'
import { cn } from '@/frontend/lib/utils'

/**
 * Small presentational primitives shared across the app. Server-safe — no
 * hooks, no client directives — so they can render inside Server Components.
 */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass p-6', className)} {...props}>
      {children}
    </div>
  )
}

export function Badge({
  className,
  children,
  tone = 'neutral',
}: {
  className?: string
  children: React.ReactNode
  tone?: 'neutral' | 'verdant' | 'gold' | 'flame'
}) {
  const tones = {
    neutral: 'border-white/15 bg-white/[0.06] text-bone-muted',
    verdant: 'border-verdant/30 bg-verdant/10 text-verdant-soft',
    gold: 'border-gold/30 bg-gold/10 text-gold-soft',
    flame: 'border-flame/30 bg-flame/10 text-flame-soft',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Gradient shimmer placeholder. Match its size to the real content. */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  /** For heights that must match a lazily-loaded component, so nothing jumps. */
  style?: React.CSSProperties
}) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden />
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  centered = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
  centered?: boolean
}) {
  return (
    <div className={cn('space-y-4', centered && 'mx-auto max-w-2xl text-center', className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      ) : null}
      <h2 className="text-display-sm font-semibold text-balance text-bone">{title}</h2>
      {description ? (
        <p className="text-base leading-relaxed text-bone-muted">{description}</p>
      ) : null}
    </div>
  )
}

/** Consistent page width and gutters. */
export function PageContainer({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)} {...props}>
      {children}
    </div>
  )
}

/** Empty state for data views with nothing to show yet. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/12 px-6 py-14 text-center">
      {icon ? <div className="text-bone-dim">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold text-bone">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-bone-dim">{description}</p>
      {action}
    </div>
  )
}
