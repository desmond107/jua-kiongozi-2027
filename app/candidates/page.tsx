import type { Metadata } from 'next'
import { listCandidates } from '@/backend/services/candidate.service'
import { getSession } from '@/backend/services/session.service'
import { spentCandidatesForUser } from '@/backend/services/token.service'
import { CandidateCard } from '@/frontend/components/candidates/candidate-card'
import { FlagBar } from '@/frontend/components/candidates/flag-bar'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { FLAG_COLOR_ORDER, FLAG_META } from '@/backend/validators'

export const metadata: Metadata = {
  title: 'Candidates',
  description:
    'The declared and prospective candidates for Kenya’s 2027 presidential election, each profiled from publicly documented facts.',
}

/** Session-dependent (the "you rated this" badge), so it cannot be statically cached. */
export const dynamic = 'force-dynamic'

export default async function CandidatesPage() {
  const session = await getSession()

  const [candidates, ratedIds] = await Promise.all([
    listCandidates(),
    session ? spentCandidatesForUser(session.userId) : Promise.resolve<string[]>([]),
  ])

  const rated = new Set(ratedIds)

  return (
    <PageContainer className="py-16">
      <SectionHeading
        eyebrow="The field"
        title="Declared and prospective candidates"
        description="Every profile uses the same structure, the same length, and only publicly documented facts. No quotes are attributed to any candidate and no profile takes a position for or against them."
      />

      {/* Legend up front, so the mini flag bars on the cards mean something
          before the reader has clicked into a profile. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-bone-dim">
          Trust flags
        </span>
        {FLAG_COLOR_ORDER.map((color) => (
          <span key={color} className="flex items-center gap-2 text-xs text-bone-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FLAG_META[color].hex }}
              aria-hidden
            />
            {FLAG_META[color].label}
          </span>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((candidate, index) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            index={index}
            rated={rated.has(candidate.id)}
          />
        ))}
      </div>

      {/* Compact overview — the same data as the cards, ordered and scannable
          in one column for anyone who does not want to read seven cards. */}
      <section className="mt-16 space-y-4">
        <h2 className="font-display text-xl font-semibold text-bone">At a glance</h2>
        <ul className="glass divide-y divide-white/[0.07] p-0">
          {candidates.map((candidate) => (
            <li
              key={candidate.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4"
            >
              <div className="min-w-[180px] flex-1">
                <p className="font-medium text-bone">{candidate.fullName}</p>
                <p className="text-xs text-bone-dim">
                  {candidate.party ?? 'Party not publicly declared'}
                </p>
              </div>
              <div className="w-full max-w-xs">
                <FlagBar flags={candidate.flags} total={candidate.totalFlags} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  )
}
