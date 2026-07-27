'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer } from '@/frontend/components/ui/primitives'

/**
 * Root error boundary.
 *
 * Deliberately shows no stack trace or error message from the exception —
 * server errors on this platform can touch identity handling, and an
 * unfiltered message is exactly the wrong thing to render into a page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] render error:', error)
  }, [error])

  return (
    <PageContainer className="py-24">
      <div className="glass mx-auto max-w-lg space-y-5 p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-gold" aria-hidden />
        <h1 className="font-display text-2xl font-semibold text-bone">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-bone-muted">
          We hit an unexpected problem loading this page. Your registration and any ratings you have
          already recorded are unaffected.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-bone-dim">Reference: {error.digest}</p>
        ) : null}
        <div className="flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button variant="primary" size="sm" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
