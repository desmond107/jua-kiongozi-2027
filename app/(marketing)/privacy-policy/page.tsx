import type { Metadata } from 'next'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { TrustNotices } from '@/frontend/components/layout/disclaimers'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Jua Kiongozi ’27 collects, why, how long it is kept, and how national ID numbers are protected.',
}

/**
 * NOTE FOR THE OPERATOR — this page is a good-faith technical description of
 * what the software actually does. It is NOT legal advice and it is not a
 * complete privacy notice for a live deployment.
 *
 * Before collecting real national ID numbers from the public, the site owner
 * must register as a data controller with Kenya's Office of the Data Protection
 * Commissioner under the Data Protection Act, 2019, complete a Data Protection
 * Impact Assessment, and have this page reviewed by counsel. See README →
 * "Before you launch".
 */
export default function PrivacyPolicyPage() {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-3xl space-y-12">
        <SectionHeading
          eyebrow="Privacy"
          title="What we collect, and what we deliberately do not"
          description="This platform is built to hold as little about you as it possibly can while still guaranteeing that each citizen counts once."
        />

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">What we collect</h2>
          <ul className="space-y-3 text-base leading-relaxed text-bone-muted">
            <li>
              <strong className="text-bone">Your name</strong> — displayed on your Voter Card and
              nowhere else. It is never shown next to your votes.
            </li>
            <li>
              <strong className="text-bone">Your phone number</strong> — stored only as a keyed
              hash, used to sign you in and to prevent a second registration.
            </li>
            <li>
              <strong className="text-bone">Your national ID number</strong> — stored only as a
              keyed hash, used for one purpose: confirming this ID has not registered before.
            </li>
            <li>
              <strong className="text-bone">Your county</strong> — self-declared at registration, used
              only for the aggregate participation-by-region breakdown.
            </li>
            <li>
              <strong className="text-bone">Your votes and trust flags</strong> — linked to your
              account so that the one-rating-per-candidate rule can be enforced.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">
            What we never store in readable form
          </h2>
          <p className="text-base leading-relaxed text-bone-muted">
            Your national ID number, your phone number, and your voting token are each put through a
            keyed one-way hash before being written to the database. The plaintext values are not
            retained anywhere, including in application logs. Someone who obtained a complete copy
            of the database still could not read them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">What we publish</h2>
          <p className="text-base leading-relaxed text-bone-muted">
            Aggregate counts only: how many people chose each option for each candidate, and how
            many ratings came from each county. Individual responses are never published, never
            exported, and are not available through any endpoint on this platform. Your name is
            never associated with any vote in anything we publish.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">
            What we never do with your data
          </h2>
          <p className="text-base leading-relaxed text-bone-muted">
            Your data is not sold, rented, shared with campaigns or parties, used for advertising,
            or used to contact you for any purpose other than operating this platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-bone">Your rights</h2>
          <p className="text-base leading-relaxed text-bone-muted">
            Under the Data Protection Act, 2019, you have the right to be informed about how your
            data is used, to access it, to have inaccurate data corrected, and to request deletion.
          </p>
          <p className="text-sm leading-relaxed text-bone-dim">
            One honest limitation: because your votes are stored against a hash rather than a
            readable identifier, deleting your account removes your registration and your ability to
            vote further, but already-counted ratings cannot be individually withdrawn from the
            aggregate totals without undermining the integrity of results other people are relying
            on.
          </p>
        </section>

        <section className="space-y-5">
          <h2 className="font-display text-xl font-semibold text-bone">Standing notices</h2>
          <div className="glass p-6">
            <TrustNotices />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-gold/25 bg-gold/[0.06] p-6">
          <h2 className="font-display text-base font-semibold text-bone">
            Note for whoever operates this platform
          </h2>
          <p className="text-sm leading-relaxed text-bone-muted">
            This page describes what the software does. It is not a substitute for legal review.
            Before collecting real national ID numbers from the public, the operator must register
            with the Office of the Data Protection Commissioner under the Data Protection Act, 2019,
            complete a Data Protection Impact Assessment, and have this notice reviewed by counsel.
          </p>
        </section>
      </div>
    </PageContainer>
  )
}
