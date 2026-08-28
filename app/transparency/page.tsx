import type { Metadata } from 'next'
import { Database, ShieldCheck } from 'lucide-react'
import { getCachedSnapshot } from '@/backend/services/analytics.service'
import {
  CountyChart,
  FlagDistributionChart,
  ResultsChart,
} from '@/frontend/components/analytics/lazy-charts'
import { LiveCounter } from '@/frontend/components/analytics/live-counter'
import { TransparencyTable } from '@/frontend/components/analytics/transparency-table'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { formatDateTime } from '@/frontend/lib/format'

export const metadata: Metadata = {
  title: 'Live results',
  description:
    'Public, real-time sentiment and trust results for Kenya’s declared 2027 presidential candidates. No login required, full dataset downloadable as CSV.',
}

/**
 * Public transparency dashboard. No authentication.
 *
 * Revalidated every 60 seconds rather than queried per request: this is the
 * page most likely to be linked and shared widely, and it must not put a
 * per-visitor load on Postgres. Vote submissions call `revalidatePath` on this
 * route, so a new rating surfaces here promptly rather than waiting out the
 * full window.
 */
export const revalidate = 60

const INTEGRITY_POINTS = [
  {
    title: 'One registration per citizen',
    body: 'Phone numbers and national ID numbers are each unique in the database, enforced by the database itself. The same ID cannot be registered twice, however the request is made.',
  },
  {
    title: 'One rating per candidate',
    body: 'Every citizen holds one vote and one trust flag per candidate. A uniqueness constraint on the pair makes a second, separate rating impossible, including under simultaneous requests.',
  },
  {
    // The constraint above caps voices, not submissions. Said plainly here
    // because a reader who changes their own rating and sees a total stay the
    // same size would otherwise wonder which of the two figures to believe.
    title: 'You may change your mind',
    body: 'A citizen can revise their vote and trust flag on a candidate at any time. The revision replaces their earlier answer in place — it never adds a second one — so the totals count each citizen exactly once while reflecting what they think now rather than what they thought the first time they clicked.',
  },
  {
    title: 'Tokens cannot be replayed',
    body: 'Each submission must present a voting token, which is re-hashed and matched against the account it was issued to. Every candidate a token has been spent on is recorded permanently, and revising a rating requires the token again.',
  },
  {
    title: 'Identifiers are never stored in the clear',
    body: 'National ID numbers and phone numbers exist on our servers only as irreversible keyed hashes. Voting tokens are stored encrypted, so their owner can retrieve them after re-verifying their phone. Nothing on this page can be traced to an individual either way.',
  },
  {
    // Stated because a live results page invites the assumption that counts
    // only ever climb. They do not, and a reader who spotted a total falling
    // without explanation would be right to distrust the whole page.
    title: 'These totals can go down',
    body: 'Anyone may delete their account, and doing so removes their ratings from these figures. Anyone may also change a rating, moving one from one column to another. A count that falls is a citizen withdrawing or reconsidering, not an error or a correction. A deleted national ID still cannot be registered again, so leaving is never a route to a second vote.',
  },
]

export default async function TransparencyPage() {
  const snapshot = await getCachedSnapshot()

  return (
    <PageContainer className="py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Transparency"
          title="Live public results"
          description="Open to everyone, no account needed. These figures update continuously as citizens record their views."
        />
        <Button asChild variant="glass">
          <a href="/api/analytics?format=csv" download>
            <Database className="h-4 w-4" />
            Download CSV
          </a>
        </Button>
      </div>

      <p className="mt-4 text-xs text-bone-dim">
        Last updated {formatDateTime(snapshot.generatedAt)} · refreshed at least every 60 seconds
      </p>

      {/* Platform totals */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LiveCounter label="Citizens registered" value={snapshot.totals.registeredVoters} />
        <LiveCounter label="Ratings cast" value={snapshot.totals.totalVotes} />
        <LiveCounter label="Trust flags raised" value={snapshot.totals.totalFlags} />
        <LiveCounter
          label="Participation"
          value={snapshot.totals.participationRate}
          suffix="%"
          hint="Ratings cast as a share of the maximum if every registered citizen rated every candidate."
        />
      </div>

      {/* Charts */}
      <div className="mt-8 space-y-6">
        <ResultsChart candidates={snapshot.candidates} />
        <FlagDistributionChart candidates={snapshot.candidates} />
      </div>

      {/* Table view — the accessible equivalent of the charts above. */}
      <div className="mt-6">
        <TransparencyTable candidates={snapshot.candidates} />
      </div>

      {/* Regional breakdown */}
      <div className="mt-6">
        <CountyChart byCounty={snapshot.byCounty} />
      </div>

      {/* Methodology & integrity */}
      <section className="mt-16 space-y-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-verdant" aria-hidden />
          <h2 className="font-display text-xl font-semibold text-bone">Methodology and integrity</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRITY_POINTS.map((point) => (
            <div key={point.title} className="glass space-y-2 p-5">
              <h3 className="text-sm font-semibold text-bone">{point.title}</h3>
              <p className="text-sm leading-relaxed text-bone-dim">{point.body}</p>
            </div>
          ))}
        </div>

        <div className="glass space-y-3 border-gold/25 p-6">
          <h3 className="font-display text-base font-semibold text-bone">
            How these numbers should be read
          </h3>
          <p className="text-sm leading-relaxed text-bone-muted">
            Participants chose to take part; they were not randomly sampled. These results therefore
            describe the people who used this platform — who may skew younger, more urban and more
            online than Kenya as a whole — and not the electorate at large.
          </p>
          <p className="text-sm leading-relaxed text-bone-muted">
            They are not an opinion poll, they carry no margin of error in the statistical sense,
            and they have no electoral or legal weight. Jua Kiongozi ’27 is not affiliated with the
            IEBC or any official electoral process.
          </p>
          <p className="text-sm leading-relaxed text-bone-dim">
            The complete aggregate dataset is downloadable above. If you disagree with any figure
            here, you are invited to check it.
          </p>
        </div>
      </section>
    </PageContainer>
  )
}
