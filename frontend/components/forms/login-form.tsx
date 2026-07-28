'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, KeyRound, LogIn } from 'lucide-react'
import { loginSchema } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'

/**
 * Sign-in with phone number + voting token.
 *
 * Signing in only lets a citizen check their voting status and continue rating
 * candidates. It never issues a new token, and the server never returns the
 * existing one. A token can only be retrieved from the Voter Card page, by an
 * already-signed-in citizen who re-verifies their phone.
 */
export function LoginForm() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsed = loginSchema.safeParse({ phoneNumber, token })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      await api.login({ phoneNumber, token })
      // Clear the token from state before navigating away.
      setToken('')
      router.push('/voter-card')
      router.refresh()
    } catch (caught) {
      setFormError(
        caught instanceof RequestError
          ? caught.message
          : 'Something went wrong. Please try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field error={errors.phoneNumber}>
        <FieldLabel>Phone number</FieldLabel>
        <Input
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          placeholder="0712 345 678"
          inputMode="tel"
          autoComplete="tel"
        />
      </Field>

      <Field error={errors.token}>
        <FieldLabel>Voting token</FieldLabel>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-dim"
            aria-hidden
          />
          <Input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="XXXX-XXXX-XXXX-…"
            autoComplete="off"
            spellCheck={false}
            className="pl-11 font-mono text-sm tracking-wider"
          />
        </div>
        <FieldHint>The token from your Voter Card. Hyphens are optional.</FieldHint>
      </Field>

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3.5 text-sm text-flame-soft"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs leading-relaxed text-bone-dim">
          <strong className="text-bone-muted">Lost your token?</strong> If you are still signed in
          on a device you used before, open your Voter Card there — you can retrieve the token by
          verifying your phone number again.
        </p>
        <p className="text-xs leading-relaxed text-bone-dim">
          If you are signed out everywhere and no longer have the token, you cannot currently get
          back in. Signing in requires the token itself, so there is no route back into the account
          without it. We would rather tell you that plainly than have you keep trying.
        </p>
      </div>

      <p className="text-center text-sm text-bone-dim">
        Not registered yet?{' '}
        <Link href="/register" className="text-gold underline-offset-4 hover:underline">
          Get your voting token
        </Link>
      </p>
    </form>
  )
}
