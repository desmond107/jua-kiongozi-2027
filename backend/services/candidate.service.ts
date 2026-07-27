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

  const all = await listCandidates()
  const summary = all.find((row) => row.id === candidate.id)
  if (!summary) throw ApiError.notFound('That candidate could not be found.')

  return summary
}

export function allCandidateSlugs(): Promise<string[]> {
  return candidateRepository.allSlugs()
}
