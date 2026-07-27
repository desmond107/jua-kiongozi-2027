'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '@/frontend/hooks/useReducedMotion'
import { cn } from '@/frontend/lib/utils'

/**
 * Layered parallax: a soft glow behind the section drifts slower than the
 * content in front of it, which is what produces the sense of depth on scroll.
 *
 * Only the decorative background layer moves — the content itself never does.
 * Parallaxing real text would fight the reader's scroll and hurt legibility for
 * exactly the users the platform most needs to reach.
 *
 * Under reduced motion the glow renders static.
 */
export function ParallaxSection({
  children,
  className,
  intensity = 60,
}: {
  children: ReactNode
  className?: string
  /** Pixels of drift across the full scroll pass. */
  intensity?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], [intensity, -intensity])

  return (
    <section ref={ref} className={cn('relative isolate', className)}>
      {!reducedMotion ? (
        <motion.div
          style={{ y }}
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
        >
          <div className="absolute left-[8%] top-[15%] h-72 w-72 rounded-full bg-verdant/[0.09] blur-[100px]" />
          <div className="absolute right-[10%] top-[45%] h-80 w-80 rounded-full bg-gold/[0.07] blur-[110px]" />
        </motion.div>
      ) : (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute left-[8%] top-[15%] h-72 w-72 rounded-full bg-verdant/[0.09] blur-[100px]" />
          <div className="absolute right-[10%] top-[45%] h-80 w-80 rounded-full bg-gold/[0.07] blur-[110px]" />
        </div>
      )}

      {children}
    </section>
  )
}
