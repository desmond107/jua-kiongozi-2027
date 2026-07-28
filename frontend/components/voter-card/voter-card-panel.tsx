'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Info, LogOut } from 'lucide-react'
import type { AccountStatus, RegistrationResult } from '@/backend/services/auth.service'
import { Button } from '@/frontend/components/ui/button'
import { api } from '@/frontend/lib/api'
import { formatDate } from '@/frontend/lib/format'
import { useRegistrationStore } from '@/frontend/stores/registration.store'
import { TokenReveal } from './token-reveal'
import { VoterCardDisplay } from './voter-card-display'

/**
 * The Voter Card screen.
 *
 * The raw token reaches this component only through the in-memory registration
 * store, and only on the single navigation straight after registering. A
 * refresh, a return visit, or a normal sign-in all land here with `issued`
 * empty — so the card renders without the token and says plainly that it cannot
 * be shown again. That is the intended behaviour, not a failure.
 */
export function VoterCardPanel({
  status,
  totalCandidates,
}: {
  status: AccountStatus
  totalCandidates: number
}) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  /**
   * The just-issued registration, claimed from the in-memory store AFTER mount.
   *
   * WHY THIS IS NOT READ DURING RENDER
   * ──────────────────────────────────
   * This component is server-rendered. During SSR the Zustand store is always
   * empty, so the server emits the "no token" tree. But a citizen arriving here
   * straight from `/register` has a populated store in the same JS context, so
   * reading it during render made the FIRST client render disagree with the
   * server HTML — a different masked phone, a token panel that only one side
   * had, and `<TokenReveal />` present on the server but not the client. React
   * calls that a hydration failure, and it fired on the single most important
   * screen in the product.
   *
   * Claiming it in an effect keeps the first client render byte-identical to the
   * server's, then reveals the token on the next commit. `getState()` rather
   * than the hook, so there is no render-time subscription to regress into.
   */
  const [issued, setIssued] = useState<RegistrationResult | null>(null)

  // A token retrieved on demand this session. Held in component state only —
  // never written to the registration store, which would let a later navigation
  // resurface it without re-verification.
  const [retrieved, setRetrieved] = useState<string | null>(null)

  useEffect(() => {
    const claimed = useRegistrationStore.getState().issued
    if (!claimed) return

    // Claim it once, then drop it from the store so a client-side navigation
    // back to this page cannot surface it a second time.
    setIssued(claimed)
    useRegistrationStore.getState().clear()
  }, [])

  const visibleToken = issued?.rawToken ?? retrieved ?? undefined

  async function signOut() {
    setSigningOut(true)
    await api.signOut().catch(() => undefined)
    router.push('/')
    router.refresh()
  }

  const remaining = totalCandidates - status.candidatesRated

  return (
    <div className="space-y-8">
      <VoterCardDisplay
        data={{
          name: status.name,
          serial: status.serial,
          // The masked values come from the registration payload when present;
          // otherwise the card shows the serial alone, which is enough to
          // identify the account without re-exposing partial identifiers.
          phoneMasked: issued?.phoneMasked ?? '•••',
          idMasked: issued?.idMasked ?? '•••',
          county: status.county,
          issuedAt: status.registeredAt,
        }}
        rawToken={visibleToken}
      />

      {!visibleToken ? <TokenReveal onRevealed={setRetrieved} /> : null}

      {retrieved ? (
        <div className="glass flex items-start gap-3 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-bone-dim" aria-hidden />
          <p className="text-sm leading-relaxed text-bone-dim">
            This token is shown for this visit only. Reloading the page hides it again and asks for
            a fresh code — keep it somewhere private rather than relying on this screen.
          </p>
        </div>
      ) : null}

      {/* Voting progress */}
      <div className="glass space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-bone">Your voting progress</h2>
            <p className="text-sm text-bone-dim">Registered {formatDate(status.registeredAt)}</p>
          </div>
          <span className="font-display text-3xl font-semibold text-bone">
            {status.candidatesRated}
            <span className="text-lg text-bone-dim">/{totalCandidates}</span>
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
          role="progressbar"
          aria-valuenow={status.candidatesRated}
          aria-valuemin={0}
          aria-valuemax={totalCandidates}
          aria-label="Candidates rated"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-verdant to-gold transition-all duration-700"
            style={{
              width: `${totalCandidates ? (status.candidatesRated / totalCandidates) * 100 : 0}%`,
            }}
          />
        </div>

        {remaining > 0 ? (
          <p className="text-sm text-bone-muted">
            {remaining} {remaining === 1 ? 'candidate' : 'candidates'} left to rate.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-verdant-soft">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            You have rated every candidate. Thank you.
          </p>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant={remaining > 0 ? 'primary' : 'glass'} size="sm">
            <Link href="/candidates">
              {remaining > 0 ? 'Rate candidates' : 'Review candidates'}
            </Link>
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/transparency">See live results</Link>
          </Button>
          <Button variant="ghost" size="sm" loading={signingOut} onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
