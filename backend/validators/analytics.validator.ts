import { z } from 'zod'
import type { FlagColor, VoteChoice } from './vote.validator'

/**
 * Shapes of the public analytics payloads.
 *
 * Everything here is aggregate-only by design: there is no field in any of
 * these types that could identify an individual respondent. That property is
 * what makes the transparency dashboard and the CSV export safe to serve
 * without authentication.
 */

export const analyticsQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
})

export type VoteBreakdown = Record<VoteChoice, number>
export type FlagBreakdown = Record<FlagColor, number>

export type CandidateAnalytics = {
  candidateId: string
  slug: string
  fullName: string
  party: string | null
  photoUrl: string | null
  votes: VoteBreakdown
  flags: FlagBreakdown
  totalVotes: number
  totalFlags: number
  /** Share of this candidate's votes that were YES, 0–100, one decimal place. */
  approvalRate: number
  /** Share of this candidate's flags that were GREEN, 0–100, one decimal place. */
  trustRate: number
}

export type CountyParticipation = {
  county: string
  votes: number
}

export type PlatformTotals = {
  registeredVoters: number
  totalVotes: number
  totalFlags: number
  candidatesRated: number
  /** Ratings cast as a share of the theoretical maximum, 0–100. */
  participationRate: number
}

export type AnalyticsSnapshot = {
  totals: PlatformTotals
  candidates: CandidateAnalytics[]
  byCounty: CountyParticipation[]
  generatedAt: string
}
