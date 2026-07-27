import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/backend/services/session.service'
import { RegisterForm } from '@/frontend/components/forms/register-form'
import { PageContainer } from '@/frontend/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Register',
  description:
    'Register once to receive your single secure voting token. Your national ID is hashed on arrival and never stored in readable form.',
}

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  // An already-registered citizen must never reach a second registration.
  const session = await getSession()
  if (session) redirect('/voter-card')

  return (
    <PageContainer className="py-16">
      <div className="mx-auto max-w-xl space-y-8">
        <header className="space-y-3 text-center">
          <h1 className="text-display-sm font-semibold text-bone">Get your voting token</h1>
          <p className="text-base leading-relaxed text-bone-muted">
            One registration, one token, one voice. It takes under a minute.
          </p>
        </header>

        <div className="glass p-6 sm:p-8">
          <RegisterForm />
        </div>
      </div>
    </PageContainer>
  )
}
