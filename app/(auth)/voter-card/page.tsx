import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { accountStatus } from '@/backend/services/auth.service'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { getSession } from '@/backend/services/session.service'
import { VoterCardPanel } from '@/frontend/components/voter-card/voter-card-panel'
import { PageContainer } from '@/frontend/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Your Voter Card',
  description: 'Your Jua Kiongozi ’27 voter card and voting progress.',
  // Never index a page rendered per-account.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function VoterCardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [status, totalCandidates] = await Promise.all([
    // A validly signed cookie can still name an account that no longer exists —
    // after an erasure request, or a database reset. Treat that as signed out
    // and send them to sign in again, rather than rendering a 500. The cookie
    // itself is cleared by `GET /api/auth/session`, which cannot be done from a
    // Server Component.
    accountStatus(session.userId).catch(() => null),
    candidateRepository.count(),
  ])

  if (!status) redirect('/login')

  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-display-sm font-semibold text-bone">Your Voter Card</h1>
          <p className="text-base leading-relaxed text-bone-muted">
            This card is proof of your registration. Keep the token on it private.
          </p>
        </header>

        <VoterCardPanel status={status} totalCandidates={totalCandidates} />
      </div>
    </PageContainer>
  )
}
