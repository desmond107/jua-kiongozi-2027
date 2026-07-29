'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarChart3, ExternalLink, LogOut, Map, Users } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { cn } from '@/frontend/lib/utils'

/**
 * Console shell: identity, navigation, sign-out.
 *
 * The header states which operator is signed in. That is not decoration — an
 * admin session lasts 8 hours and the console is reached from a control most
 * people do not know exists, so "who am I right now" is worth never having to
 * guess.
 */

const TABS = [
  { href: '/admin', label: 'Overview', icon: BarChart3 },
  { href: '/admin/counties', label: 'Counties', icon: Map },
  { href: '/admin/registrants', label: 'Registrants', icon: Users },
]

export function AdminChrome({
  username,
  children,
}: {
  username: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)

    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      // `refresh` clears the cached RSC payload for the console. Without it the
      // browser can paint the previous page from cache on the way out.
      router.replace('/')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-gold/30 bg-gold/10 px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Console
            </span>
            <span className="text-sm text-bone-muted">
              Signed in as <strong className="font-semibold text-bone">{username}</strong>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-bone-dim transition-colors hover:text-bone"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Public site
            </Link>
            <Button variant="glass" size="sm" onClick={signOut} disabled={signingOut}>
              <LogOut className="h-4 w-4" aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>

        <nav aria-label="Console sections" className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <ul className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              // Exact match for the index tab, prefix match for the rest —
              // otherwise "/admin" would highlight on every child route.
              const active = tab.href === '/admin' ? pathname === tab.href : pathname.startsWith(tab.href)

              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors',
                      active
                        ? 'border-gold text-bone'
                        : 'border-transparent text-bone-dim hover:text-bone-muted',
                    )}
                  >
                    <tab.icon className="h-4 w-4" aria-hidden />
                    {tab.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">{children}</main>
    </div>
  )
}
