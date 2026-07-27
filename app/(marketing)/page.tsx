import Link from 'next/link'
import { ArrowRight, Database, Fingerprint, KeySquare, LineChart, Users } from 'lucide-react'
import { getCachedSnapshot } from '@/backend/services/analytics.service'
import { listCandidates } from '@/backend/services/candidate.service'
import { Hero } from '@/frontend/components/hero/hero'
import { CandidateCard } from '@/frontend/components/candidates/candidate-card'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { ParallaxSection } from '@/frontend/components/layout/parallax-section'
import { formatNumber } from '@/frontend/lib/format'

/**
 * Landing page.
 *
 * Rendered on the server and revalidated every 60 seconds — the headline counts
 * and candidate cards should feel live without every visitor hitting Postgres.
 */
export const revalidate = 60

const STEPS = [
  {
    icon: Fingerprint,
    title: 'Register once',
    body: 'Your name, phone number and national ID. The ID is hashed the moment it arrives and is never stored in readable form — it exists only to confirm you have not registered before.',
  },
  {
    icon: KeySquare,
    title: 'Receive one token',
    body: 'A cryptographically random voting token is generated and shown to you exactly once. We keep only a hash of it, so nobody — including us — can use it or recover it later.',
  },
  {
    icon: Users,
    title: 'Rate the candidates',
    body: 'Cast one sentiment vote and one trust flag per candidate. Your token is spent against that candidate and can never be used for them again.',
  },
  {
    icon: LineChart,
    title: 'Watch the results',
    body: 'Every aggregate is published immediately on a public dashboard that needs no login, alongside a downloadable dataset for anyone who wants to check the arithmetic.',
  },
]

export default async function LandingPage() {
  const [snapshot, candidates] = await Promise.all([getCachedSnapshot(), listCandidates()])

  return (
    <>
      <Hero
        registeredVoters={snapshot.totals.registeredVoters}
        totalVotes={snapshot.totals.totalVotes}
      />

      {/* How it works */}
      <ParallaxSection className="py-24">
        <PageContainer>
          <SectionHeading
            centered
            eyebrow="How it works"
            title="Built so that one person counts exactly once"
            description="Every design decision here answers the same question: how do you measure public sentiment honestly, without collecting more about people than you need?"
          />

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="glass relative flex flex-col gap-3 p-6">
                <span className="absolute right-5 top-5 font-display text-4xl font-semibold text-white/[0.06]">
                  {index + 1}
                </span>
                <step.icon className="h-6 w-6 text-gold" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-bone">{step.title}</h3>
                <p className="text-sm leading-relaxed text-bone-dim">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="glass">
              <Link href="/how-it-works">
                Read the full methodology
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </PageContainer>
      </ParallaxSection>

      {/* Candidates */}
      <section className="py-24">
        <PageContainer>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="The field"
              title="Declared and prospective candidates"
              description="Seven names, each profiled with the same structure and the same length, using only publicly documented facts."
            />
            <Button asChild variant="glass">
              <Link href="/candidates">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.slice(0, 6).map((candidate, index) => (
              <CandidateCard key={candidate.id} candidate={candidate} index={index} />
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Transparency */}
      <ParallaxSection className="py-24">
        <PageContainer>
          <div className="glass overflow-hidden p-8 sm:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="space-y-5">
                <SectionHeading
                  eyebrow="Transparency"
                  title="Nothing here is behind a login"
                  description="The results dashboard is public, updates continuously, and ships with a full CSV export. If you disagree with a number, you can download the data and check it yourself."
                />
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button asChild variant="primary">
                    <Link href="/transparency">
                      <LineChart className="h-4 w-4" />
                      Open the dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="glass">
                    <a href="/api/analytics?format=csv" download>
                      <Database className="h-4 w-4" />
                      Download CSV
                    </a>
                  </Button>
                </div>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Citizens registered', value: snapshot.totals.registeredVoters },
                  { label: 'Ratings cast', value: snapshot.totals.totalVotes },
                  { label: 'Trust flags raised', value: snapshot.totals.totalFlags },
                  { label: 'Candidates tracked', value: snapshot.totals.candidatesRated },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <dt className="text-xs uppercase tracking-[0.14em] text-bone-dim">
                      {stat.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-3xl font-semibold text-bone">
                      {formatNumber(stat.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </PageContainer>
      </ParallaxSection>

      {/* Closing CTA */}
      <section className="pb-24">
        <PageContainer>
          <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-br from-ink-700/80 to-ink-900/80 p-10 text-center sm:p-16">
            <span
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-verdant/20 blur-3xl"
              aria-hidden
            />
            <div className="relative space-y-5">
              <h2 className="text-display-sm font-semibold text-balance text-bone">
                Your voice belongs in the record
              </h2>
              <p className="mx-auto max-w-xl text-base leading-relaxed text-bone-muted">
                Registration takes under a minute. What you say about each candidate is counted
                anonymously and published openly.
              </p>
              <div className="flex justify-center pt-2">
                <Button asChild variant="primary" size="lg">
                  <Link href="/register">
                    Get your voting token
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  )
}
