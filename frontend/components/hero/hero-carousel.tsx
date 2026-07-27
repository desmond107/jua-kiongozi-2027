'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useReducedMotion } from '@/frontend/hooks/useReducedMotion'
import { cn } from '@/frontend/lib/utils'
import { HERO_SLIDES } from './slide-art'

const INTERVAL_MS = 6500

/**
 * Full-bleed hero carousel.
 *
 * Accessibility decisions worth keeping:
 *  - autoplay pauses on hover, on keyboard focus, and while the tab is hidden
 *  - an explicit pause/play control is always present, because autoplaying
 *    motion with no way to stop it fails WCAG 2.2.2
 *  - autoplay never starts at all under `prefers-reduced-motion`
 *  - slides are a labelled tablist, so the dots are reachable by keyboard
 */
export function HeroCarousel({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback((next: number) => {
    setIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length)
  }, [])

  const playing = !paused && !reducedMotion

  useEffect(() => {
    if (!playing) return

    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SLIDES.length)
    }, INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing])

  // Stop advancing while the tab is in the background — otherwise the user
  // returns to a slide that jumped several positions for no visible reason.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const active = HERO_SLIDES[index]!
  const { Art } = active

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Civic imagery"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={active.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.1, ease: 'easeInOut' },
            // The slow scale is a Ken Burns drift; it runs for the full slide
            // duration rather than settling, which keeps the frame alive.
            scale: { duration: INTERVAL_MS / 1000, ease: 'linear' },
          }}
        >
          <Art />
          <span className="sr-only">{active.alt}</span>
        </motion.div>
      </AnimatePresence>

      {/* Scrim: the headline sits on top of this, and it is what guarantees
          text contrast no matter which slide is showing. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/40"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-800 to-transparent"
        aria-hidden
      />

      {/* Controls, bottom-right so they never collide with the headline. */}
      <div className="absolute bottom-6 right-5 z-20 flex items-center gap-2 sm:right-8">
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous image"
          className="rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div role="tablist" aria-label="Choose image" className="flex items-center gap-1.5 px-1">
          {HERO_SLIDES.map((slide, slideIndex) => (
            <button
              key={slide.id}
              role="tab"
              aria-selected={slideIndex === index}
              aria-label={slide.caption}
              onClick={() => go(slideIndex)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                slideIndex === index ? 'w-7 bg-gold' : 'w-1.5 bg-white/30 hover:bg-white/60',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next image"
          className="rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {!reducedMotion ? (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? 'Resume automatic slideshow' : 'Pause automatic slideshow'}
            className="ml-1 rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
