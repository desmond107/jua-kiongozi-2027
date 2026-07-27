'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import type { CandidateSummary } from '@/backend/services/candidate.service'
import { useTilt } from '@/frontend/hooks/useTilt'
import { formatNumber } from '@/frontend/lib/format'
import { cn } from '@/frontend/lib/utils'
import { CandidatePortrait } from './candidate-portrait'
import { FlagBar } from './flag-bar'

/**
 * Candidate card with cursor-following 3D tilt.
 *
 * The whole card is a single link rather than a div containing one, so the
 * entire surface is one keyboard stop and one screen-reader target. The tilt is
 * driven by Framer Motion values (see useTilt), so pointer movement never
 * triggers a React render — which is what keeps a seven-card grid smooth.
 */
export function CandidateCard({
  candidate,
  index = 0,
  rated = false,
}: {
  candidate: CandidateSummary
  index?: number
  rated?: boolean
}) {
  const { enabled, handlers, style, glareStyle } = useTilt({ max: 7 })

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.4), ease: [0.16, 1, 0.3, 1] }}
      className={cn(enabled && 'perspective-1000')}
    >
      <motion.div style={style} {...handlers} className="h-full">
        <Link
          href={`/candidates/${candidate.slug}`}
          className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-700/50 backdrop-blur-xl transition-colors duration-300 hover:border-white/25"
        >
          {/* Glare follows the tilt, so the card reads as catching a fixed light. */}
          {glareStyle ? (
            <motion.span
              className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={glareStyle}
              aria-hidden
            />
          ) : null}

          <div className="relative">
            <CandidatePortrait
              fullName={candidate.fullName}
              photoUrl={candidate.photoUrl}
              className="aspect-[4/3] w-full"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-700 to-transparent"
              aria-hidden
            />

            {rated ? (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-verdant/40 bg-ink-900/85 px-3 py-1 text-xs font-medium text-verdant-soft backdrop-blur-md">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                You rated this
              </span>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-semibold leading-tight text-bone">
                  {candidate.fullName}
                </h3>
                <ArrowUpRight
                  className="mt-1 h-4 w-4 shrink-0 text-bone-dim transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold"
                  aria-hidden
                />
              </div>
              <p className="text-sm text-bone-dim">{candidate.role}</p>
              <p className="text-xs text-bone-dim">
                {candidate.party ?? 'Party not publicly declared'}
              </p>
            </div>

            <div className="mt-auto space-y-3">
              <FlagBar flags={candidate.flags} total={candidate.totalFlags} />
              <p className="text-xs text-bone-dim">
                {formatNumber(candidate.totalVotes)}{' '}
                {candidate.totalVotes === 1 ? 'rating' : 'ratings'} recorded
              </p>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  )
}

/** Loading placeholder, matched to the real card's dimensions. */
export function CandidateCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-700/40">
      <div className="skeleton aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-3.5 w-1/2" />
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  )
}
