import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { getCandidateAnalytics } from '@/backend/services/analytics.service'
import { getSession } from '@/backend/services/session.service'
import { spentCandidatesForUser } from '@/backend/services/token.service'
import {
  FLAG_COLOR_ORDER,
  FLAG_META,
  VOTE_CHOICE_COLORS,
  VOTE_CHOICE_LABELS,
  VOTE_CHOICE_ORDER,
} from '@/backend/validators'
import { CandidatePortrait } from '@/frontend/components/candidates/candidate-portrait'
import { FlagBar } from '@/frontend/components/candidates/flag-bar'
import { VoteWidget } from '@/frontend/components/candidates/vote-widget'
import { Badge, PageContainer } from '@/frontend/components/ui/primitives'
import { formatNumber, formatPercent } from '@/frontend/lib/format'

/**
 * The candidate roster is a closed, seeded set, so the router is told exactly
 * which slugs exist. Anything else is rejected by the router itself with a real
 * 404 status.
 *
 * This is not merely cosmetic: with `dynamicParams` left at its default, an
 * unknown slug is rendered on demand and `notFound()` resolves with a 200
 * status, which tells crawlers that every mistyped URL is a real page.
 *
 * Trade-off to know about: adding a candidate to the database now requires a
 * rebuild before their page resolves. See README → "Adding or changing a
 * candidate".
 */
export const dynamicParams = false

/** Pre-computes the seven slugs so profile routes are known at build time. */
export async function generateStaticParams() {
  const slugs = await candidateRepository.allSlugs().catch(() => [])
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const candidate = await candidateRepository.findBySlug(params.slug)
  if (!candidate) return { title: 'Candidate not found' }

  return {
    title: candidate.fullName,
    description: `${candidate.fullName} — ${candidate.role}. Public sentiment and trust ratings on Jua Kiongozi ’27.`,
  }
}

export default async function CandidateProfilePage({ params }: { params: { slug: string } }) {
  const candidate = await candidateRepository.findBySlug(params.slug)
  if (!candidate) notFound()

  const session = await getSession()

  const [analytics, ratedIds] = await Promise.all([
    getCandidateAnalytics(candidate.id),
    session ? spentCandidatesForUser(session.userId) : Promise.resolve<string[]>([]),
  ])

  const alreadyRated = ratedIds.includes(candidate.id)

  return (
    <PageContainer className="py-12">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-2 rounded-full text-sm text-bone-dim transition-colors hover:text-bone"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All candidates
      </Link>

      {/* Profile header */}
      <header className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
        <CandidatePortrait
          fullName={candidate.fullName}
          photoUrl={candidate.photoUrl}
          className="aspect-[4/5] w-full rounded-3xl border border-white/10"
          sizes="(max-width: 1024px) 100vw, 280px"
          priority
        />

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold">{candidate.role}</Badge>
              <Badge>{candidate.party ?? 'Party not publicly declared'}</Badge>
            </div>
            <h1 className="text-display-md font-semibold text-balance text-bone">
              {candidate.fullName}
            </h1>
          </div>

          <p className="max-w-2xl text-base leading-relaxed text-bone-muted">{candidate.bio}</p>

          <p className="max-w-2xl text-xs leading-relaxed text-bone-dim">
            This profile contains only publicly documented facts about offices held and professional
            background. It contains no quotes, no endorsement, and no criticism. Every candidate on
            this platform is profiled to the same structure and length.
          </p>

          {/* Current standing */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-bone-dim">Ratings</p>
              <p className="mt-1 font-display text-2xl font-semibold text-bone">
                {formatNumber(analytics.totalVotes)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-bone-dim">Would consider</p>
              <p className="mt-1 font-display text-2xl font-semibold text-bone">
                {analytics.totalVotes > 0 ? formatPercent(analytics.approvalRate) : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-bone-dim">Green flags</p>
              <p className="mt-1 font-display text-2xl font-semibold text-bone">
                {analytics.totalFlags > 0 ? formatPercent(analytics.trustRate) : '—'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Vote / flag + current results */}
      <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="glass space-y-5 p-6">
            <h2 className="font-display text-xl font-semibold text-bone">Current standing</h2>

            {analytics.totalVotes === 0 ? (
              <p className="text-sm text-bone-dim">
                No ratings have been recorded for this candidate yet. Be the first to record a view.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <h3 className="text-sm font-medium text-bone">
                    Would you consider supporting this candidate?
                  </h3>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    {VOTE_CHOICE_ORDER.map((choice) => {
                      const share = (analytics.votes[choice] / analytics.totalVotes) * 100
                      if (share === 0) return null

                      return (
                        <span
                          key={choice}
                          style={{
                            width: `${share}%`,
                            backgroundColor: VOTE_CHOICE_COLORS[choice],
                            // 2px surface gap so adjacent fills stay distinct.
                            boxShadow: 'inset -2px 0 0 0 #131A29',
                          }}
                        />
                      )
                    })}
                  </div>
                  <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {VOTE_CHOICE_ORDER.map((choice) => (
                      <li key={choice} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-[3px]"
                          style={{ backgroundColor: VOTE_CHOICE_COLORS[choice] }}
                          aria-hidden
                        />
                        <span className="text-bone-muted">{VOTE_CHOICE_LABELS[choice]}</span>
                        <span className="font-medium text-bone">
                          {formatNumber(analytics.votes[choice])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="hairline" />

                <div className="space-y-2.5">
                  <h3 className="text-sm font-medium text-bone">Trust flags</h3>
                  <FlagBar flags={analytics.flags} total={analytics.totalFlags} />
                  <ul className="space-y-1.5">
                    {FLAG_COLOR_ORDER.map((color) => (
                      <li key={color} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: FLAG_META[color].hex }}
                          aria-hidden
                        />
                        <span className="text-bone-muted">{FLAG_META[color].label}</span>
                        <span className="ml-auto font-medium text-bone">
                          {formatNumber(analytics.flags[color])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <p className="text-xs leading-relaxed text-bone-dim">
              These figures reflect people who chose to use this platform. They are not a
              representative opinion poll and carry no electoral weight.
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <VoteWidget
            candidateId={candidate.id}
            candidateName={candidate.fullName}
            signedIn={Boolean(session)}
            alreadyRated={alreadyRated}
          />
        </aside>
      </div>
    </PageContainer>
  )
}
