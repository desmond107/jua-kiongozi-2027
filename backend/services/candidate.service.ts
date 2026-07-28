import 'server-only'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { voteRepository } from '@/backend/repositories/vote.repository'
import type { FlagBreakdown, VoteBreakdown } from '@/backend/validators'
import type { FlagColor, VoteChoice } from '@/backend/validators'
import { ApiError } from '@/backend/utils/http.util'

/**
 * Candidate reads for the grid and profile pages.
 *
 * Each card carries a small flag-distribution indicator, so the list query
 * pulls aggregate flag counts alongside the candidates rather than letting
 * seven cards each fire their own request.
 */

export type CandidateSummary = {
  id: string
  slug: string
  fullName: string
  party: string | null
  role: string
  bio: string
  photoUrl: string | null
  flags: FlagBreakdown
  totalFlags: number
  votes: VoteBreakdown
  totalVotes: number
  /**
   * Share of this candidate's votes that were YES, 0–100 to one decimal.
   *
   * Carried on the card because it is the figure a visitor most wants to
   * compare across candidates, and without it the grid could only be read by
   * opening all seven profiles in turn.
   */
  approvalRate: number
}

function emptyFlags(): FlagBreakdown {
  return { GREEN: 0, ORANGE: 0, RED: 0, BLACK: 0 }
}

function emptyVotes(): VoteBreakdown {
  return { YES: 0, NO: 0, NOT_SURE: 0 }
}

function percentage(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

export async function listCandidates(): Promise<CandidateSummary[]> {
  const [candidates, flagTally, voteTally] = await Promise.all([
    candidateRepository.findAll(),
    flagRepository.tallyByCandidate(),
    voteRepository.tallyByCandidate(),
  ])

  const flagsByCandidate = new Map<string, FlagBreakdown>()
  for (const row of flagTally) {
    const bucket = flagsByCandidate.get(row.candidateId) ?? emptyFlags()
    bucket[row.color as FlagColor] = row.count
    flagsByCandidate.set(row.candidateId, bucket)
  }

  const votesByCandidate = new Map<string, VoteBreakdown>()
  for (const row of voteTally) {
    const bucket = votesByCandidate.get(row.candidateId) ?? emptyVotes()
    bucket[row.choice as VoteChoice] = row.count
    votesByCandidate.set(row.candidateId, bucket)
  }

  return candidates.map((candidate) => {
    const flags = flagsByCandidate.get(candidate.id) ?? emptyFlags()
    const votes = votesByCandidate.get(candidate.id) ?? emptyVotes()
    const totalVotes = votes.YES + votes.NO + votes.NOT_SURE

    return {
      id: candidate.id,
      slug: candidate.slug,
      fullName: candidate.fullName,
      party: candidate.party,
      role: candidate.role,
      bio: candidate.bio,
      photoUrl: candidate.photoUrl,
      flags,
      totalFlags: flags.GREEN + flags.ORANGE + flags.RED + flags.BLACK,
      votes,
      totalVotes,
      approvalRate: percentage(votes.YES, totalVotes),
    }
  })
}

export type CandidateNeighbours = {
  previous: { slug: string; fullName: string } | null
  next: { slug: string; fullName: string } | null
  position: number
  total: number
}

/**
 * The candidates either side of this one, in display order.
 *
 * Exists so a profile is not a dead end. Rating all seven previously meant
 * returning to the grid between each one, which is friction on the single
 * action the whole platform is for. Wraps around, so there is always a next.
 */
export async function getCandidateNeighbours(slug: string): Promise<CandidateNeighbours> {
  const all = await candidateRepository.findAll()
  const index = all.findIndex((candidate) => candidate.slug === slug)

  if (index === -1) throw ApiError.notFound('That candidate could not be found.')

  const at = (offset: number) => {
    const candidate = all[(index + offset + all.length) % all.length]
    return candidate ? { slug: candidate.slug, fullName: candidate.fullName } : null
  }

  return {
    previous: all.length > 1 ? at(-1) : null,
    next: all.length > 1 ? at(1) : null,
    position: index + 1,
    total: all.length,
  }
}

export async function getCandidateBySlug(slug: string): Promise<CandidateSummary> {
  const candidate = await candidateRepository.findBySlug(slug)
  if (!candidate) throw ApiError.notFound('That candidate could not be found.')

  /**
   * Tally only THIS candidate.
   *
   * This used to call `listCandidates()` and discard all but one row, which
   * meant every profile page ran a full grouped tally across every candidate to
   * answer a question about one of them. Harmless at seven candidates and a
   * waste at any scale — and the sort of thing that never shows up until the
   * table is large.
   */
  const [flags, votes] = await Promise.all([
    flagRepository.tallyForCandidate(candidate.id),
    voteRepository.tallyForCandidate(candidate.id),
  ])

  const totalVotes = votes.YES + votes.NO + votes.NOT_SURE

  return {
    id: candidate.id,
    slug: candidate.slug,
    fullName: candidate.fullName,
    party: candidate.party,
    role: candidate.role,
    bio: candidate.bio,
    photoUrl: candidate.photoUrl,
    flags,
    totalFlags: flags.GREEN + flags.ORANGE + flags.RED + flags.BLACK,
    votes,
    totalVotes,
    approvalRate: percentage(votes.YES, totalVotes),
  }
}

export function allCandidateSlugs(): Promise<string[]> {
  return candidateRepository.allSlugs()
}
