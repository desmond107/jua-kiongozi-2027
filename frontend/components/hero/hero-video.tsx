'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useReducedMotion } from '@/frontend/hooks/useReducedMotion'
import { cn } from '@/frontend/lib/utils'
import { HERO_CLIPS, nextClipIndex } from './hero-video.constants'

/**
 * The hero background: four clips played one after another, looping forever.
 *
 * HOW SEQUENCING WORKS
 * ────────────────────
 * There is exactly ONE <video> element. When a clip fires `ended`, the index
 * advances and the element's `src` is swapped; after the last clip it wraps to
 * the first. Only one file is ever in flight, which matters because these clips
 * are tens of megabytes each — four <video> elements with `preload` would try
 * to pull the lot on first paint.
 *
 * WHAT COVERS THE GAP WHILE A CLIP BUFFERS
 * ────────────────────────────────────────
 * Each clip ships with a ~25KB still frame taken from its own opening second.
 * It is set as the element's `poster` AND painted as a background layer, so the
 * hero shows the real footage from the first paint and the swap between clips
 * never reveals a void. This is what replaced the illustrated artwork as the
 * hero backdrop; the illustrations now appear only when video is refused
 * outright (metered connection, no H.264).
 *
 * REDUCED MOTION
 * ──────────────
 * A visitor who asked for less motion still gets the footage — held still, as
 * the poster frame, with no video element mounted and no bytes fetched. Showing
 * them different artwork entirely would be a worse answer than showing them the
 * same image without the movement.
 *
 * WHAT WOULD BREAK WITHOUT EACH GUARD
 *  - `muted` + `playsInline`: without both, mobile browsers refuse to autoplay
 *    and iOS takes the video fullscreen.
 *  - IntersectionObserver: without it a 4K clip keeps decoding while the reader
 *    is far down the page, burning battery for nothing.
 *  - visibilitychange: same, for a backgrounded tab.
 *  - the `play()` rejection path: autoplay can be blocked by policy or by an
 *    extension, and an unhandled rejection would leave a frozen first frame.
 */

export function HeroVideo({ onUnavailable }: { onUnavailable?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState(false)
  const [failures, setFailures] = useState(0)

  const current = HERO_CLIPS[index]!

  // Under reduced motion no <video> is mounted at all, so nothing autoplays and
  // no clip is fetched. The controls below still let the visitor step through
  // the stills by hand — the imagery stays, only the movement goes.
  const motionAllowed = !reducedMotion

  const advance = useCallback((delta: number) => {
    setReady(false)
    setIndex((i) => nextClipIndex(i, delta))
  }, [])

  /** Loops back to the first clip after the last — this is the sequencing. */
  const handleEnded = useCallback(() => advance(1), [advance])

  /**
   * A clip that will not load is skipped rather than allowed to stall the
   * sequence. If every clip fails, the caller is told so it can fall back to
   * the illustrated carousel for good.
   */
  const handleError = useCallback(() => {
    setFailures((count) => {
      const next = count + 1
      if (next >= HERO_CLIPS.length) onUnavailable?.()
      return next
    })
    advance(1)
  }, [advance, onUnavailable])

  // Load and play whenever the source changes.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !motionAllowed) return

    /**
     * Set `muted` on the ELEMENT, not just via the JSX prop.
     *
     * React does not reliably reflect `muted` onto the DOM for a
     * client-rendered <video> — inspect the live element and the attribute is
     * simply absent. Every browser's autoplay policy refuses an unmuted
     * autoplay, so without this line `play()` rejects, the rejection handler
     * fires `onUnavailable`, and the hero silently and permanently downgrades
     * to the illustrated carousel. Assigning the property is the reliable form.
     */
    video.muted = true

    video.load()

    if (paused) return

    // `play()` can still reject — a policy extension, a locked-down browser.
    // Treat that as "no video" and let the artwork stand, rather than leaving a
    // stuck first frame on screen.
    video.play().catch(() => onUnavailable?.())
  }, [index, paused, onUnavailable, motionAllowed])

  // Stop decoding once the hero scrolls away, and resume when it returns.
  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video || !motionAllowed) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          if (!paused) void video.play().catch(() => undefined)
        } else {
          video.pause()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [paused, motionAllowed])

  // A backgrounded tab should not be streaming 4K.
  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current
      if (!video) return
      if (document.hidden) video.pause()
      else if (!paused) void video.play().catch(() => undefined)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [paused, motionAllowed])

  const togglePaused = useCallback(() => {
    const video = videoRef.current
    setPaused((wasPaused) => {
      if (!video) return !wasPaused
      if (wasPaused) void video.play().catch(() => undefined)
      else video.pause()
      return !wasPaused
    })
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Civic imagery"
    >
      {/* The clip's own opening frame, painted immediately and left underneath
          so a buffering or swapping gap shows the footage rather than a void. */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-500"
        style={{ backgroundImage: `url(${current.poster})` }}
        aria-hidden
      />

      {motionAllowed ? (
        <video
          ref={videoRef}
          // Remounting on index change is deliberate: it guarantees the element
          // fully resets between clips instead of inheriting the previous buffer.
          key={current.src}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-700',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          // Decorative. The headline beside it carries the meaning, and the clips
          // are silent, so there is nothing here for a screen reader to announce.
          aria-hidden
          poster={current.poster}
          muted
          playsInline
          autoPlay
          preload="auto"
          onCanPlay={() => setReady(true)}
          onEnded={handleEnded}
          onError={handleError}
        >
          <source src={current.src} type="video/mp4" />
        </video>
      ) : null}

      {/* Scrim: guarantees headline contrast whatever frame is showing. */}
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
          onClick={() => advance(-1)}
          aria-label="Previous clip"
          className="rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div role="tablist" aria-label="Choose clip" className="flex items-center gap-1.5 px-1">
          {HERO_CLIPS.map((video, videoIndex) => (
            <button
              key={video.src}
              role="tab"
              aria-selected={videoIndex === index}
              aria-label={video.caption}
              onClick={() => {
                setReady(false)
                setIndex(videoIndex)
              }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                videoIndex === index ? 'w-7 bg-gold' : 'w-1.5 bg-white/30 hover:bg-white/60',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => advance(1)}
          aria-label="Next clip"
          className="rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Required: autoplaying motion longer than five seconds must be
            pausable (WCAG 2.2.2). Omitted under reduced motion, where there is
            nothing to pause. */}
        {motionAllowed ? (
          <button
            type="button"
            onClick={togglePaused}
            aria-label={paused ? 'Resume background video' : 'Pause background video'}
            className="ml-1 rounded-full border border-white/15 bg-ink-900/60 p-2 text-bone-muted backdrop-blur-md transition-colors hover:text-bone"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default HeroVideo
