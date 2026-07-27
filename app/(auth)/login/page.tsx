import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/backend/services/session.service'
import { LoginForm } from '@/frontend/components/forms/login-form'
import { PageContainer } from '@/frontend/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in with your phone number and voting token to check your voting status and continue rating candidates.',
}

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/voter-card')

  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-md space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-display-sm font-semibold text-bone">Sign in</h1>
          <p className="text-base leading-relaxed text-bone-muted">
            Use the phone number you registered with and the token from your Voter Card.
          </p>
        </header>

        <div className="glass p-6 sm:p-8">
          <LoginForm />
        </div>
      </div>
    </PageContainer>
  )
}
