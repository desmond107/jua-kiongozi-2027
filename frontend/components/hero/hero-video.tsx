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
 * There is one <video> element PER CLIP, stacked on top of each other. Only the
 * active one plays; the others sit paused underneath. When the active clip
 * fires `ended`, the next element — already buffered — starts from its first
 * frame and fades in over the outgoing clip's last frame. After the last clip
 * it wraps to the first.
 *
 * The previous design swapped the `src` of a single element, which threw away
 * the buffer on every change: each clip boundary meant a fresh request, a
 * visible stall on the poster, and a fade up from nothing. Keeping each clip in
 * its own element is what makes the hand-off seamless.
 *
 * WHAT GETS DOWNLOADED, AND WHEN
 * ──────────────────────────────
 * The clips are ~2MB each, so pulling all four on first paint would put ~7MB in
 * contention with the page itself. Instead:
 *  1. The first clip streams straight from the network, so it starts as soon as
 *     its opening second arrives. The others sit at `preload="none"`.
 *  2. Once it can play, the remaining clips are downloaded IN FULL, one after
 *     another in playback order, and handed to their elements as in-memory blob
 *     URLs. Each one has the length of a whole clip to arrive before it is due.
 *
 * Why whole files rather than `preload="auto"`: that attribute is only a hint.
 * Chrome buffers a few seconds of a hidden element and then suspends, so the
 * next clip still stalled ("waiting") in its first second when it took over. A
 * blob is entirely local — once it is attached, playback cannot wait on the
 * network at all.
 *
 * A blob is only attached to an element that is OFF screen (neither playing nor
 * fading out), because changing an element's source resets it to its first
 * frame. If a visitor jumps to a clip before its blob arrives, that clip simply
 * streams from the network as clip one did.
 *
 * WHAT COVERS THE GAP WHILE THE FIRST CLIP BUFFERS
 * ────────────────────────────────────────────────
 * Each clip ships with a ~25KB still frame taken from its own opening second.
 * It is set as each element's `poster` AND painted as a background layer, so the
 * hero shows the real footage from the first paint and nothing ever reveals a
 * void. The illustrations appear only when video is refused outright (metered
 * connection, no H.264).
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
 *  - IntersectionObserver: without it a clip keeps decoding while the reader is
 *    far down the page, burning battery for nothing.
 *  - visibilitychange: same, for a backgrounded tab.
 *  - the `play()` rejection path: autoplay can be blocked by policy or by an
 *    extension, and an unhandled rejection would leave a frozen first frame.
 */

type ClipState = {
  /** The clip on screen and playing. */
  index: number
  /** The clip being faded out underneath it, held on its last frame. */
  previous: number
}

export function HeroVideo({
  onUnavailable,
  onClipChange,
}: {
  onUnavailable?: () => void
  /** Fires whenever the active clip changes, so the headline can follow it. */
  onClipChange?: (index: number) => void
}) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  /**
   * Both callbacks are held in refs, not read from props inside effects.
   *
   * The parent re-renders every time the headline turns over, which hands down
   * fresh function identities. With those in an effect's dependency list the
   * play effect re-fired on every phrase change, interrupting playback
   * mid-clip. The refs keep the latest callback available without making the
   * effects depend on its identity.
   */
  const onUnavailableRef = useRef(onUnavailable)
  const onClipChangeRef = useRef(onClipChange)
  useEffect(() => {
    onUnavailableRef.current = onUnavailable
    onClipChangeRef.current = onClipChange
  })

  const [clip, setClip] = useState<ClipState>({ index: 0, previous: -1 })
  const [paused, setPaused] = useState(false)
  const [ready, setReady] = useState<readonly boolean[]>(() => HERO_CLIPS.map(() => false))

  // Clips that refused to load. Skipped on every later pass round the loop.
  const failedRef = useRef(new Set<number>())
  // Whether the hero is on screen. Read by the play effect, written by the observer.
  const inViewRef = useRef(true)

  const { index, previous } = clip
  const current = HERO_CLIPS[index]!

  // What each element plays: the public URL to begin with, swapped for a fully
  // downloaded blob URL once one is available. See "WHAT GETS DOWNLOADED".
  const [sources, setSources] = useState<readonly string[]>(() => HERO_CLIPS.map((c) => c.src))
  // Blobs that arrived while their clip was on screen, waiting to be attached.
  const pendingBlobsRef = useRef(new Map<number, string>())
  const [blobsArrived, setBlobsArrived] = useState(0)

  // Under reduced motion no <video> is mounted at all, so nothing autoplays and
  // no clip is fetched. The controls below still let the visitor step through
  // the stills by hand — the imagery stays, only the movement goes.
  const motionAllowed = !reducedMotion

  /**
   * The elements mount as soon as motion is allowed, so the footage starts
   * playing when the site opens. It is not deferred to browser idle: the poster
   * already covers the buffering gap, and the clip fades in over it on
   * `canplay`.
   */
  const videoActive = motionAllowed

  // Keep the headline in step with the footage. Reported from an effect rather
  // than from the click handlers so it also fires when a clip ends on its own.
  useEffect(() => {
    onClipChangeRef.current?.(index)
  }, [index])

  /** Moves `delta` clips along, stepping over any clip that failed to load. */
  const advance = useCallback((delta: number) => {
    setClip(({ index: from }) => {
      let to = nextClipIndex(from, delta)
      for (let tries = 1; failedRef.current.has(to) && tries < HERO_CLIPS.length; tries++) {
        to = nextClipIndex(to, delta > 0 ? 1 : -1)
      }
      return to === from ? { index: from, previous: -1 } : { index: to, previous: from }
    })
  }, [])

  const jumpTo = useCallback((to: number) => {
    setClip(({ index: from }) =>
      to === from ? { index: from, previous: -1 } : { index: to, previous: from },
    )
  }, [])

  /** Loops back to the first clip after the last — this is the sequencing. */
  const handleEnded = useCallback(
    (clipIndex: number) => {
      if (clipIndex === index) advance(1)
    },
    [advance, index],
  )

  const handleCanPlay = useCallback((clipIndex: number) => {
    setReady((was) => (was[clipIndex] ? was : was.map((value, i) => value || i === clipIndex)))
  }, [])

  /**
   * A clip that will not load is skipped rather than allowed to stall the
   * sequence. If every clip fails, the caller is told so it can fall back to
   * the illustrated carousel for good.
   */
  const handleError = useCallback(
    (clipIndex: number) => {
      failedRef.current.add(clipIndex)
      if (failedRef.current.size >= HERO_CLIPS.length) {
        onUnavailableRef.current?.()
        return
      }
      if (clipIndex === index) advance(1)
    },
    [advance, index],
  )

  /** Plays the active clip if nothing says it should be held. */
  const playActive = useCallback(
    (video: HTMLVideoElement) => {
      if (paused || !inViewRef.current || document.hidden) return

      /**
       * `play()` rejects for two very different reasons, and conflating them is
       * a bug: an AbortError just means a newer `load()` or `pause()` superseded
       * this play, which happens routinely. Only a genuine refusal —
       * NotAllowedError from autoplay policy — means there will never be video,
       * and only that should retire the player. A NotSupportedError is left to
       * the element's own `error` event, which skips that one clip.
       */
      video.play().catch((error: DOMException) => {
        if (error?.name === 'NotAllowedError') onUnavailableRef.current?.()
      })
    },
    [paused],
  )

  // A newly active clip always starts from its first frame. Runs only on a clip
  // change, never on pause/resume, so resuming carries on where it stopped.
  useEffect(() => {
    if (!videoActive) return
    const video = videoRefs.current[index]
    if (video && video.currentTime > 0) video.currentTime = 0
  }, [index, videoActive])

  // Play the active clip; hold every other one still.
  useEffect(() => {
    if (!videoActive) return

    videoRefs.current.forEach((video, i) => {
      if (!video) return

      /**
       * Set `muted` on the ELEMENT, not just via the JSX prop.
       *
       * React does not reliably reflect `muted` onto the DOM for a
       * client-rendered <video> — inspect the live element and the attribute is
       * simply absent. Every browser's autoplay policy refuses an unmuted
       * autoplay, so without this line `play()` rejects and the hero silently
       * and permanently downgrades to the illustrated carousel.
       */
      video.muted = true

      if (i === index) {
        if (paused) video.pause()
        else playActive(video)
      } else if (!video.paused) {
        video.pause()
      }
    })
  }, [index, paused, videoActive, playActive])

  // Stop decoding once the hero scrolls away, and resume when it returns.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !videoActive) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        inViewRef.current = entry.isIntersecting
        const video = videoRefs.current[index]
        if (!video) return
        if (entry.isIntersecting) playActive(video)
        else video.pause()
      },
      { threshold: 0.1 },
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [index, videoActive, playActive])

  // A backgrounded tab should not be streaming video.
  useEffect(() => {
    if (!videoActive) return

    const onVisibility = () => {
      const video = videoRefs.current[index]
      if (!video) return
      if (document.hidden) video.pause()
      else playActive(video)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [index, videoActive, playActive])

  const togglePaused = useCallback(() => setPaused((wasPaused) => !wasPaused), [])

  // Download the remaining clips in full, in playback order, once the first can
  // play — so they never compete with it for bandwidth.
  const firstClipReady = ready.some(Boolean)

  useEffect(() => {
    if (!videoActive || !firstClipReady) return

    let cancelled = false
    const created: string[] = []
    const pending = pendingBlobsRef.current

    void (async () => {
      for (let step = 1; step < HERO_CLIPS.length; step++) {
        const clipIndex = nextClipIndex(0, step)
        try {
          const response = await fetch(HERO_CLIPS[clipIndex]!.src)
          if (!response.ok) continue
          const blob = await response.blob()
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          created.push(url)
          pending.set(clipIndex, url)
          setBlobsArrived((count) => count + 1)
        } catch {
          // Leave this clip on its network URL; it will stream when its turn comes.
        }
      }
    })()

    return () => {
      cancelled = true
      pending.clear()
      // Point every element back at the network before the blobs go, so a
      // remount (reduced motion toggled off again) never plays a dead URL.
      setSources(HERO_CLIPS.map((c) => c.src))
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [videoActive, firstClipReady])

  // Attach each downloaded blob as soon as its element is off screen.
  useEffect(() => {
    const attachable = [...pendingBlobsRef.current].filter(
      ([clipIndex]) => clipIndex !== index && clipIndex !== previous,
    )
    if (attachable.length === 0) return

    attachable.forEach(([clipIndex]) => pendingBlobsRef.current.delete(clipIndex))
    setSources((was) => {
      const next = [...was]
      attachable.forEach(([clipIndex, url]) => (next[clipIndex] = url))
      return next
    })
  }, [index, previous, blobsArrived])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Civic imagery"
    >
      {/* The clip's own opening frame, painted immediately and left underneath
          so a buffering gap shows the footage rather than a void. */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-500"
        style={{ backgroundImage: `url(${current.poster})` }}
        aria-hidden
      />

      {videoActive
        ? HERO_CLIPS.map((video, videoIndex) => (
            <video
              key={video.src}
              ref={(element) => {
                videoRefs.current[videoIndex] = element
              }}
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
                // The incoming clip fades in ON TOP of the outgoing one, which
                // stays fully opaque on its last frame underneath — so the
                // crossfade never dips through to the poster or to black.
                videoIndex === index &&
                  (ready[videoIndex] ? 'z-[2] opacity-100' : 'z-[2] opacity-0'),
                videoIndex === previous && 'z-[1] opacity-100',
                videoIndex !== index && videoIndex !== previous && 'z-0 opacity-0',
              )}
              // Decorative. The headline beside it carries the meaning, and the
              // clips are silent, so there is nothing here for a screen reader.
              aria-hidden
              poster={video.poster}
              muted
              playsInline
              autoPlay={videoIndex === 0}
              src={sources[videoIndex]}
              // A blob is already local, so letting it decode ahead costs no
              // bandwidth. A network URL loads only when its clip is on screen.
              preload={videoIndex === index || sources[videoIndex] !== video.src ? 'auto' : 'none'}
              onCanPlay={() => handleCanPlay(videoIndex)}
              onEnded={() => handleEnded(videoIndex)}
              onError={() => handleError(videoIndex)}
            />
          ))
        : null}

      {/*
        No scrim. The footage is shown unobstructed across the whole hero.

        Legibility is handled instead by a contained backdrop behind the copy
        itself (see hero.tsx). That choice is measured, not stylistic: sampling
        every clip at 4fps found PURE WHITE (255,255,255) behind the text column
        — bright sky and white shirts — where an unobstructed headline scores
        1.0:1 against its background. A full-frame scrim heavy enough to fix
        that was dimming the entire video to 13:1, far past the 3:1 the standard
        asks for. Darkening only the words costs the imagery nothing.
      */}

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
              onClick={() => jumpTo(videoIndex)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                videoIndex === index ? 'w-7 bg-flame' : 'w-1.5 bg-white/30 hover:bg-white/60',
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
