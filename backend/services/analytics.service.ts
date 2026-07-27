import 'server-only'
import { unstable_cache } from 'next/cache'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { userRepository } from '@/backend/repositories/user.repository'
import { voteRepository } from '@/backend/repositories/vote.repository'
import type {
  AnalyticsSnapshot,
  CandidateAnalytics,
  FlagBreakdown,
  VoteBreakdown,
} from '@/backend/validators'
import {
  FLAG_COLOR_ORDER,
  VOTE_CHOICE_ORDER,
  type FlagColor,
  type VoteChoice,
} from '@/backend/validators'
import { ApiError } from '@/backend/utils/http.util'

/**
 * Aggregate analytics for the public transparency dashboard.
 *
 * Every figure here comes from a GROUP BY. No function in this module ever
 * selects a user id, a name, a phone hash or an ID hash — which is exactly why
 * these payloads can be served publicly and exported as CSV without exposing
 * any individual's participation.
 */

function emptyVotes(): VoteBreakdown {
  return { YES: 0, NO: 0, NOT_SURE: 0 }
}

function emptyFlags(): FlagBreakdown {
  return { GREEN: 0, ORANGE: 0, RED: 0, BLACK: 0 }
}

function percentage(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

export async function getSnapshot(): Promise<AnalyticsSnapshot> {
  const [candidates, voteTally, flagTally, registeredVoters, totalVotes, totalFlags, byCounty] =
    await Promise.all([
      candidateRepository.findAll(),
      voteRepository.tallyByCandidate(),
      flagRepository.tallyByCandidate(),
      userRepository.count(),
      voteRepository.count(),
      flagRepository.count(),
      voteRepository.tallyByCounty(),
    ])

  const votesByCandidate = new Map<string, VoteBreakdown>()
  const flagsByCandidate = new Map<string, FlagBreakdown>()

  for (const row of voteTally) {
    const bucket = votesByCandidate.get(row.candidateId) ?? emptyVotes()
    bucket[row.choice as VoteChoice] = row.count
    votesByCandidate.set(row.candidateId, bucket)
  }

  for (const row of flagTally) {
    const bucket = flagsByCandidate.get(row.candidateId) ?? emptyFlags()
    bucket[row.color as FlagColor] = row.count
    flagsByCandidate.set(row.candidateId, bucket)
  }

  const rows: CandidateAnalytics[] = candidates.map((candidate) => {
    const votes = votesByCandidate.get(candidate.id) ?? emptyVotes()
    const flags = flagsByCandidate.get(candidate.id) ?? emptyFlags()
    const totalCandidateVotes = votes.YES + votes.NO + votes.NOT_SURE
    const totalCandidateFlags = flags.GREEN + flags.ORANGE + flags.RED + flags.BLACK

    return {
      candidateId: candidate.id,
      slug: candidate.slug,
      fullName: candidate.fullName,
      party: candidate.party,
      photoUrl: candidate.photoUrl,
      votes,
      flags,
      totalVotes: totalCandidateVotes,
      totalFlags: totalCandidateFlags,
      approvalRate: percentage(votes.YES, totalCandidateVotes),
      trustRate: percentage(flags.GREEN, totalCandidateFlags),
    }
  })

  // Participation = ratings actually cast, against the maximum possible if every
  // registered citizen rated every candidate.
  const maximumPossible = registeredVoters * candidates.length

  return {
    totals: {
      registeredVoters,
      totalVotes,
      totalFlags,
      candidatesRated: candidates.length,
      participationRate: percentage(totalVotes, maximumPossible),
    },
    candidates: rows,
    byCounty,
    generatedAt: new Date().toISOString(),
  }
}

/** Cache tag for every analytics read. Invalidated whenever a rating lands. */
export const ANALYTICS_CACHE_TAG = 'analytics-snapshot'

/**
 * The cached entry point every caller should use.
 *
 * Caching here rather than via a route's `revalidate` export is deliberate: the
 * CSV endpoint has to read `searchParams`, which makes that route dynamic and
 * silently disables route-level caching. Caching the *computation* instead means
 * the transparency page, the JSON API and the CSV export all share one set of
 * GROUP BY queries per window, no matter how each route is rendered.
 *
 * Vote and flag submissions call `revalidateTag(ANALYTICS_CACHE_TAG)`, so a new
 * rating appears immediately instead of waiting out the 60-second window.
 */
export const getCachedSnapshot = unstable_cache(getSnapshot, ['analytics-snapshot-v1'], {
  revalidate: 60,
  tags: [ANALYTICS_CACHE_TAG],
})

export async function getCandidateAnalytics(
  candidateIdOrSlug: string,
): Promise<CandidateAnalytics> {
  const snapshot = await getCachedSnapshot()

  const match = snapshot.candidates.find(
    (row) => row.candidateId === candidateIdOrSlug || row.slug === candidateIdOrSlug,
  )

  if (!match) throw ApiError.notFound('That candidate could not be found.')

  return match
}

/**
 * Aggregate results as CSV, for public auditability.
 *
 * One row per candidate, counts only. There is deliberately no per-response
 * export — publishing individual ballots would make participation traceable.
 */
export function toCsv(snapshot: AnalyticsSnapshot): string {
  const header = [
    'candidate',
    'party',
    ...VOTE_CHOICE_ORDER.map((choice) => `votes_${choice.toLowerCase()}`),
    'votes_total',
    ...FLAG_COLOR_ORDER.map((color) => `flags_${color.toLowerCase()}`),
    'flags_total',
    'approval_rate_percent',
    'trust_rate_percent',
  ]

  // Guards against CSV injection: a leading =, +, - or @ is interpreted as a
  // formula by spreadsheet software, so those cells get a defensive prefix.
  const escape = (value: string | number | null): string => {
    const raw = value === null ? '' : String(value)
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
    return `"${safe.replace(/"/g, '""')}"`
  }

  const lines = [header.join(',')]

  for (const row of snapshot.candidates) {
    lines.push(
      [
        escape(row.fullName),
        escape(row.party ?? 'Not publicly declared'),
        ...VOTE_CHOICE_ORDER.map((choice) => row.votes[choice]),
        row.totalVotes,
        ...FLAG_COLOR_ORDER.map((color) => row.flags[color]),
        row.totalFlags,
        row.approvalRate,
        row.trustRate,
      ].join(','),
    )
  }

  lines.push('')
  lines.push(escape(`Generated at ${snapshot.generatedAt} (UTC)`))
  lines.push(escape(`Registered voters,${snapshot.totals.registeredVoters}`))
  lines.push(escape(`Total votes cast,${snapshot.totals.totalVotes}`))
  lines.push(escape(`Total flags cast,${snapshot.totals.totalFlags}`))
  lines.push(
    escape('Aggregate counts only. No individual response is included in this export.'),
  )

  return lines.join('\n')
}
