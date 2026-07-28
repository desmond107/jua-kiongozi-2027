'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, ShieldCheck } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { useDeviceCapability } from '@/frontend/hooks/useDeviceCapability'
import { formatNumber } from '@/frontend/lib/format'
import { HeroCarousel } from './hero-carousel'

/**
 * The WebGL scene is code-split and client-only, so three.js (~150KB gzipped)
 * never appears in the initial bundle and never runs during SSR. On a device
 * that fails the capability probe it is never even requested.
 */
const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => null,
})

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
  const { canRender3D, canPlayVideo } = useDeviceCapability()

  // Set when every clip has failed to load, or autoplay was refused. Once true
  // the illustrated carousel takes over permanently rather than retrying.
  const [videoUnavailable, setVideoUnavailable] = useState(false)

  const showVideo = canPlayVideo && !videoUnavailable

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
      {showVideo ? <HeroVideo onUnavailable={() => setVideoUnavailable(true)} /> : <HeroCarousel />}

      {/* Layer 2 — the 3D depth scene, sitting between the art and the copy.
          Absent entirely on reduced-motion or lower-powered devices; the
          gradient art below is the designed fallback, not a broken state. */}
      {canRender3D ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-1/2 opacity-80 lg:block">
          <HeroScene />
        </div>
      ) : null}

      {/* Layer 3 — content.

          The copy carries its own backdrop rather than relying on a scrim over
          the video. Opacity is derived, not eyeballed: the brightest pixel the
          clips ever put behind this column is pure white, which needs 47% to
          clear AA-large for the headline and 59% for body copy at #F7F5F0. 78%
          leaves headroom for a frame brighter than anything sampled, while the
          rest of the hero shows the footage completely unobstructed. */}
      <div className="relative z-20 mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div className="max-w-2xl rounded-4xl border border-white/10 bg-ink-900/[0.78] p-7 backdrop-blur-xl sm:p-10">
          <motion.div variants={rise} initial="hidden" animate="visible" custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.08] px-4 py-1.5 text-xs font-medium tracking-wide text-gold-soft backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-gold" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              Independent civic platform · Not affiliated with the IEBC
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.1}
            className="mt-7 text-display-lg font-semibold text-balance text-bone"
          >
            Your Voice.
            <br />
            <span className="gradient-text">Verified. Transparent.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            initial="hidden"
            animate="visible"
            custom={0.2}
            className="mt-6 max-w-xl text-lg leading-relaxed text-bone"
          >
            Register once, receive a single secure voting token, and record how you feel about every
            declared 2027 presidential candidate. Every aggregate result is published openly, for
            anyone to audit.
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
            <Button asChild variant="glass" size="lg">
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
            className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5"
          >
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-bone-muted">
                Citizens registered
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-bone">
                {formatNumber(registeredVoters)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-bone-muted">Ratings cast</dt>
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
            <div className="flex items-center gap-2 text-sm text-bone-muted">
              <ShieldCheck className="h-4 w-4 text-verdant" aria-hidden />
              One voice per verified phone number
            </div>
          </motion.dl>
        </div>
      </div>
    </section>
  )
}
