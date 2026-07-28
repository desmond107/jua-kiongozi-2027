'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BarChart3, ShieldCheck } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { useDeviceCapability } from '@/frontend/hooks/useDeviceCapability'
import { formatNumber } from '@/frontend/lib/format'
import { HeroCarousel } from './hero-carousel'
import { HERO_PHRASES, nextClipIndex } from './hero-video.constants'

/**
 * Same treatment for the video backdrop, and for a stronger reason: it must
 * never render during SSR, because the server has no idea whether this visitor
 * is on wifi or on a metered handset. Deciding on the client keeps the initial
 * HTML identical for everyone and the capability probe authoritative.
 */
const HeroVideo = dynamic(() => import('./hero-video'), {
  ssr: false,
  loading: () => null,
})

type HeroProps = {
  registeredVoters: number
  totalVotes: number
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export function Hero({ registeredVoters, totalVotes }: HeroProps) {
  const { canPlayVideo, canAnimate } = useDeviceCapability()

  // Set when every clip has failed to load, or autoplay was refused. Once true
  // the illustrated carousel takes over permanently rather than retrying.
  const [videoUnavailable, setVideoUnavailable] = useState(false)
  const [phrase, setPhrase] = useState(0)

  const showVideo = canPlayVideo && !videoUnavailable

  /**
   * The headline turns over WITH the footage, not on a clock of its own — the
   * video reports each clip change and the words follow, so the two can never
   * drift apart or leave a phrase stranded over the wrong clip. Pausing the
   * video therefore also holds the words, which is what makes the single pause
   * control honest.
   */
  const handleClipChange = useCallback((index: number) => setPhrase(index), [])

  // Stable identity, so a headline change never looks like a prop change to the
  // player. Belt as well as braces — the player also holds this in a ref.
  const handleUnavailable = useCallback(() => setVideoUnavailable(true), [])

  /**
   * Only when there is no video to follow does the headline need its own timer.
   * Held still under reduced motion: auto-rotating text is exactly the kind of
   * unrequested movement that setting asks us to stop.
   */
  useEffect(() => {
    if (showVideo || !canAnimate) return

    const timer = setInterval(
      () => setPhrase((i) => nextClipIndex(i, 1, HERO_PHRASES.length)),
      7000,
    )
    return () => clearInterval(timer)
  }, [showVideo, canAnimate])

  const current = HERO_PHRASES[phrase] ?? HERO_PHRASES[0]!

  return (
    <section className="relative isolate flex min-h-[92vh] items-center overflow-hidden">
      {/* Layer 1 — the backdrop.
          The four clips play in sequence and loop; on a metered or slow
          connection, a phone-sized screen, or under reduced motion, the
          illustrated carousel runs instead. Exactly one of the two is mounted,
          so there is never a second set of controls or a duplicate scrim, and
          the video's bytes are never fetched on a device that was not going to
          play them. The first client render always matches the server (video is
          client-only), so this swap cannot cause a hydration mismatch. */}
      {showVideo ? (
        <HeroVideo onUnavailable={handleUnavailable} onClipChange={handleClipChange} />
      ) : (
        <HeroCarousel />
      )}

      {/*
        There is no Layer 2 any more — no scrim, no panel, no gradient.

        The footage is shown completely unobstructed. Legibility moved onto the
        type itself: `.text-over-video` wraps a dark halo around each glyph (see
        globals.css), which is what captioning does and costs the image nothing.
      */}

      {/* Layer 3 — content. */}
      <div className="relative z-20 mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="max-w-2xl">
          <motion.div variants={rise} initial="hidden" animate="visible" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-ink-900/85 px-4 py-1.5 text-xs font-medium tracking-wide text-gold-soft backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              Independent civic platform · Not affiliated with the IEBC
            </span>
          </motion.div>

          {/*
            The headline turns over with the footage.

            One <h1> whose CONTENTS swap, never a second heading — the document
            keeps exactly one level-one heading however many phrases cycle past.
            The live region is off on purpose: announcing a new headline every
            seven seconds would talk over a screen-reader user trying to read
            the page. They get the current phrase when they navigate to it,
            which is the same thing a sighted visitor gets.

            `min-h` is set from the tallest phrase so the copy beneath never
            jumps as the words change.
          */}
          <motion.h1
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.1}
            className="text-over-video-lg mt-7 min-h-[2.05em] text-display-lg font-semibold text-balance text-bone"
            aria-live="off"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={phrase}
                className="block"
                initial={canAnimate ? { opacity: 0, y: 14 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={canAnimate ? { opacity: 0, y: -14 } : undefined}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                {current.lead}
                <br />
                <span className="gradient-text">{current.accent}</span>
              </motion.span>
            </AnimatePresence>
          </motion.h1>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="text-over-video mt-6 max-w-xl text-lg leading-relaxed text-bone"
          >
            {/* The long form costs five lines on a phone and pushes the
                participation figures below the fold; the short form says the
                same thing in two. */}
            <span className="sm:hidden">
              Register once, get a secure voting token, and rate every declared 2027 candidate.
              Results are published openly.
            </span>
            <span className="hidden sm:inline">
              Register once, receive a single secure voting token, and record how you feel about
              every declared 2027 presidential candidate. Every aggregate result is published
              openly, for anyone to audit.
            </span>
          </motion.p>

          <motion.div
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.3}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button asChild variant="primary" size="lg">
              <Link href="/register">
                Register &amp; get your token
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="glass" size="lg" className="border-white/25 bg-ink-900/80">
              <Link href="/transparency">
                <BarChart3 className="h-4 w-4" />
                View live results
              </Link>
            </Button>
          </motion.div>

          <motion.dl
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.42}
            className="text-over-video mt-12 flex flex-wrap items-center gap-x-10 gap-y-5"
          >
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-bone">Citizens registered</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-bone">
                {formatNumber(registeredVoters)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-bone">Ratings cast</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-bone">
                {formatNumber(totalVotes)}
              </dd>
            </div>
            {/*
              Says "phone number", not "citizen". Registration verifies control
              of a SIM by SMS; it does not verify that a national ID belongs to
              the person typing it, and no data source available to this
              platform can establish that. Claiming a verified *citizen* would
              overstate what the system actually proves. See /how-it-works.
            */}
            <div className="flex items-center gap-2 text-sm text-bone">
              <ShieldCheck className="h-4 w-4 text-verdant" aria-hidden />
              One voice per verified phone number
            </div>
          </motion.dl>
        </div>
      </div>
    </section>
  )
}
