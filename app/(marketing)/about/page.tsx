import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { TrustNotices } from '@/frontend/components/layout/disclaimers'

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Jua Kiongozi ’27 is, what it is not, and the principles it is built on. An independent civic-engagement platform, unaffiliated with the IEBC.',
}

export default function AboutPage() {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-3xl space-y-14">
        <SectionHeading
          eyebrow="About"
          title="An independent record of what Kenyans actually think"
          description="Jua Kiongozi ’27 exists to measure public sentiment about the declared 2027 presidential candidates — openly, verifiably, and without taking a side."
        />

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">What this platform is</h2>
          <div className="space-y-4 text-base leading-relaxed text-bone-muted">
            <p>
              A public, independent civic-engagement tool. Any Kenyan citizen can register once,
              receive a single secure voting token, and record two things about each declared
              candidate: whether they would consider supporting them, and how much they trust them.
            </p>
            <p>
              Every aggregate result is published on a dashboard that requires no login, and the
              underlying counts are downloadable as a CSV file so that anyone — journalists,
              researchers, sceptics — can check the arithmetic for themselves.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">What this platform is not</h2>
          <div className="space-y-4 text-base leading-relaxed text-bone-muted">
            <p>
              It is <strong className="text-bone">not an election</strong>, and it is not a
              substitute for one. Nothing recorded here has any electoral or legal weight. It does
              not register anyone to vote in the 2027 general election — only the Independent
              Electoral and Boundaries Commission can do that.
            </p>
            <p>
              It is also <strong className="text-bone">not a poll in the statistical sense</strong>.
              Participants choose to take part rather than being randomly sampled, which means the
              results describe the people who used this platform, not the Kenyan electorate as a
              whole. We publish participation figures alongside every result precisely so this
              limitation stays visible rather than being quietly forgotten.
            </p>
            <p>
              It is not affiliated with, funded by, or endorsed by any candidate, party or campaign.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">
            How candidate profiles are written
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-bone-muted">
            <p>
              Every candidate profile is limited to publicly documented facts: offices held, dates,
              and professional background. No quotes are attributed to any candidate. No profile
              contains praise, criticism, prediction or endorsement.
            </p>
            <p>
              All seven profiles follow the same structure and comparable length, so that no
              candidate reads as more prominently or more favourably covered than another. Where a
              party affiliation for the 2027 cycle is not formally and publicly settled, the profile
              says so rather than guessing.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="font-display text-xl font-semibold text-bone">Trust and legal notices</h2>
          <div className="glass p-6">
            <TrustNotices />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">Corrections</h2>
          <p className="text-base leading-relaxed text-bone-muted">
            If any factual detail in a candidate profile is wrong or out of date, it should be
            corrected. Accuracy on these pages is the whole basis of the platform’s neutrality.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="primary">
            <Link href="/register">Register to take part</Link>
          </Button>
          <Button asChild variant="glass">
            <Link href="/how-it-works">How the voting works</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
