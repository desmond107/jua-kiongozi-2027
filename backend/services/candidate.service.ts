import 'server-only'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { flagRepository } from '@/backend/repositories/flag.repository'
import { voteRepository } from '@/backend/repositories/vote.repository'
import type { FlagBreakdown } from '@/backend/validators'
import type { FlagColor } from '@/backend/validators'
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
  totalVotes: number
}

function emptyFlags(): FlagBreakdown {
  return { GREEN: 0, ORANGE: 0, RED: 0, BLACK: 0 }
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

  const votesByCandidate = new Map<string, number>()
  for (const row of voteTally) {
    votesByCandidate.set(row.candidateId, (votesByCandidate.get(row.candidateId) ?? 0) + row.count)
  }

  return candidates.map((candidate) => {
    const flags = flagsByCandidate.get(candidate.id) ?? emptyFlags()

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
      totalVotes: votesByCandidate.get(candidate.id) ?? 0,
    }
  })
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
    voteRepository.countForCandidate(candidate.id),
  ])

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
    totalVotes: votes,
  }
}

export function allCandidateSlugs(): Promise<string[]> {
  return candidateRepository.allSlugs()
}
