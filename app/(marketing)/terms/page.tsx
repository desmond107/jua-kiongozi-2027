import type { Metadata } from 'next'
import Link from 'next/link'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'
import { IEBC_DISCLAIMER } from '@/frontend/components/layout/disclaimers'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms governing participation in Jua Kiongozi ’27.',
}

const TERMS = [
  {
    title: 'Nature of the platform',
    body: IEBC_DISCLAIMER,
  },
  {
    title: 'Eligibility',
    body: 'Participation is intended for Kenyan citizens holding a national ID number. You may register once, using your own identity. Registering with another person’s details, or attempting to register more than once, is a misuse of the platform.',
  },
  {
    title: 'Your voting token',
    body: 'Your token is issued once, at registration. You are responsible for keeping it confidential — anyone who obtains it can cast ratings in your name. While you remain signed in, you may retrieve it from your Voter Card page by verifying your registered phone number again. We will not reissue a token to anyone who cannot receive that verification code, and if you are signed out and no longer hold your token, we cannot restore access to your account.',
  },
  {
    title: 'One rating per candidate',
    body: 'You may record one sentiment vote and one trust flag for each candidate. Ratings are final: once submitted they cannot be changed or withdrawn, because other people are relying on the published totals.',
  },
  {
    title: 'Acceptable use',
    body: 'You may not attempt to submit ratings by automated means, to register on behalf of others, to interfere with the platform’s operation, or to probe, scan or test its security without authorisation.',
  },
  {
    title: 'Accuracy of candidate information',
    body: 'Candidate profiles are compiled from publicly documented facts and are provided in good faith. They carry no endorsement of, or opposition to, any candidate. If you believe a factual detail is wrong, it should be reported so it can be corrected.',
  },
  {
    title: 'How results should be read',
    body: 'Participants choose to take part rather than being randomly sampled. Results therefore describe the people who used this platform, not the Kenyan electorate as a whole, and they carry no electoral or legal weight. Reporting them as a representative opinion poll would misrepresent them.',
  },
  {
    title: 'Availability',
    body: 'The platform is provided as-is, without warranty of uninterrupted availability. Access may be suspended for maintenance or in response to abuse.',
  },
]

export default function TermsPage() {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-3xl space-y-12">
        <SectionHeading
          eyebrow="Terms"
          title="Terms of use"
          description="The rules of participation. Plain language, because terms nobody can read protect nobody."
        />

        <ol className="space-y-4">
          {TERMS.map((term, index) => (
            <li key={term.title} className="glass flex gap-5 p-6">
              <span className="font-display text-lg font-semibold text-gold/50">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="space-y-2">
                <h2 className="font-display text-lg font-semibold text-bone">{term.title}</h2>
                <p className="text-sm leading-relaxed text-bone-muted">{term.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-sm text-bone-dim">
          See also the{' '}
          <Link href="/privacy-policy" className="text-gold underline-offset-4 hover:underline">
            privacy policy
          </Link>{' '}
          for how your data is handled, and{' '}
          <Link href="/how-it-works" className="text-gold underline-offset-4 hover:underline">
            how it works
          </Link>{' '}
          for the technical detail.
        </p>
      </div>
    </PageContainer>
  )
}
