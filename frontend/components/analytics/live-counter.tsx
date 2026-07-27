'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'framer-motion'
import { useReducedMotion } from '@/frontend/hooks/useReducedMotion'
import { formatNumber } from '@/frontend/lib/format'
import { cn } from '@/frontend/lib/utils'

/**
 * A single headline statistic.
 *
 * Per the form heuristic this is a stat tile, not a chart — one number with no
 * comparison to make gains nothing from being plotted.
 *
 * The count-up runs once on entry, and is skipped entirely under reduced
 * motion, where the final value renders immediately.
 */
export function LiveCounter({
  label,
  value,
  suffix,
  hint,
  className,
}: {
  label: string
  value: number
  suffix?: string
  hint?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return

    if (reducedMotion || value === 0) {
      setDisplay(value)
      return
    }

    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })

    return () => controls.stop()
  }, [inView, value, reducedMotion])

  return (
    <div ref={ref} className={cn('glass p-5', className)}>
      <p className="text-xs uppercase tracking-[0.16em] text-bone-dim">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-bone sm:text-4xl">
        {/* The live region announces the settled value, not every tick. */}
        <span aria-hidden>{formatNumber(display)}</span>
        <span className="sr-only">{formatNumber(value)}</span>
        {suffix ? <span className="ml-1 text-xl text-bone-dim">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-bone-dim">{hint}</p> : null}
    </div>
  )
}
