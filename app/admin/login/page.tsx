import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { getAdminSession } from '@/backend/services/adminSession.service'
import { AdminLoginForm } from '@/frontend/components/admin/admin-login-form'

/**
 * Operator sign-in. Sibling of the `(console)` group, so it is reachable
 * without a session — which is what stops the guard redirecting in a loop.
 */

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const session = await getAdminSession()
  if (session) redirect('/admin')

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-5 py-16">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-3 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
            <ShieldCheck className="h-6 w-6 text-gold" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold text-bone">Operator sign-in</h1>
          <p className="text-sm leading-relaxed text-bone-dim">
            Restricted to platform administrators. All access is logged.
          </p>
        </header>

        <div className="glass p-6 sm:p-8">
          <AdminLoginForm />
        </div>

        <p className="text-center text-xs leading-relaxed text-bone-dim">
          This console reports aggregate participation only. Individual voting choices are not
          accessible from it.
        </p>
      </div>
    </div>
  )
}
