'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, IdCard, KeyRound, LogIn, MessageSquare } from 'lucide-react'
import { loginSchema, loginWithIdSchema } from '@/backend/validators'
import type { OtpChallenge } from '@/backend/services/otp.service'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'
import { cn } from '@/frontend/lib/utils'

/**
 * Two ways back in.
 *
 *   Voting token — phone + token. Instant, no SMS.
 *   ID number    — phone + national ID + an SMS code, for a citizen who no
 *                  longer has their token.
 *
 * The second exists because losing the token used to mean permanent lockout:
 * signing in needed the token, and retrieving the token needed a session. That
 * loop had no entrance.
 *
 * It asks for an SMS code because an ID number is not a secret — it is
 * photocopied by employers, landlords and banks — and "phone + ID" alone would
 * let anyone holding a copy read which candidates that citizen had rated.
 *
 * Neither route grants voting authority. Casting a rating always needs the raw
 * token, which this form never returns.
 */

type Method = 'token' | 'id'

export function LoginForm() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('token')

  const [phoneNumber, setPhoneNumber] = useState('')
  const [token, setToken] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')

  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function applyIssues(issues: { path: (string | number)[]; message: string }[]) {
    const next: Record<string, string> = {}
    for (const issue of issues) {
      const key = issue.path.join('.')
      if (!next[key]) next[key] = issue.message
    }
    setErrors(next)
  }

  /** Switching route clears the other route's inputs and any stale error. */
  function chooseMethod(nextMethod: Method) {
    setMethod(nextMethod)
    setErrors({})
    setFormError(null)
    setToken('')
    setOtpCode('')
    setChallenge(null)
  }

  async function requestCode() {
    setFormError(null)

    // Validate the number before spending an SMS on it.
    const phoneOnly = loginWithIdSchema.pick({ phoneNumber: true }).safeParse({ phoneNumber })
    if (!phoneOnly.success) {
      applyIssues(phoneOnly.error.issues)
      return
    }

    setErrors({})
    setSendingCode(true)

    try {
      setChallenge(await api.requestOtp({ phoneNumber }))
      setOtpCode('')
    } catch (caught) {
      setFormError(
        caught instanceof RequestError ? caught.message : 'Could not send your code.',
      )
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsed =
      method === 'token'
        ? loginSchema.safeParse({ phoneNumber, token })
        : loginWithIdSchema.safeParse({ phoneNumber, idNumber, otpCode })

    if (!parsed.success) {
      applyIssues(parsed.error.issues)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      if (method === 'token') {
        await api.login({ phoneNumber, token })
      } else {
        await api.loginWithId({ phoneNumber, idNumber, otpCode })
      }

      // Clear the secrets from component state before navigating away.
      setToken('')
      setOtpCode('')
      router.push('/voter-card')
      router.refresh()
    } catch (caught) {
      setFormError(
        caught instanceof RequestError ? caught.message : 'Something went wrong. Please try again.',
      )
      // A spent or wrong code cannot be retried — the server burns it on every
      // attempt — so send them back to requesting a fresh one rather than
      // leaving a dead code in the field.
      if (method === 'id') {
        setChallenge(null)
        setOtpCode('')
      }
      setSubmitting(false)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      active ? 'bg-white/[0.1] text-bone' : 'text-bone-dim hover:text-bone',
    )

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div
        role="tablist"
        aria-label="How would you like to sign in?"
        className="flex gap-1 rounded-2xl border border-white/10 bg-ink-900/50 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={method === 'token'}
          onClick={() => chooseMethod('token')}
          className={tabClass(method === 'token')}
        >
          <KeyRound className="h-4 w-4" aria-hidden />
          Voting token
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={method === 'id'}
          onClick={() => chooseMethod('id')}
          className={tabClass(method === 'id')}
        >
          <IdCard className="h-4 w-4" aria-hidden />
          ID number
        </button>
      </div>

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

      {method === 'token' ? (
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
      ) : (
        <>
          <Field error={errors.idNumber}>
            <FieldLabel>National ID number</FieldLabel>
            <Input
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              placeholder="12345678"
              inputMode="numeric"
              autoComplete="off"
            />
            <FieldHint>
              The ID you registered with. It is checked against a stored hash — we never see the
              number itself.
            </FieldHint>
          </Field>

          {challenge ? (
            <Field error={errors.otpCode}>
              <FieldLabel>Verification code</FieldLabel>
              <Input
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                className="font-mono text-lg tracking-[0.3em]"
              />
              <FieldHint>
                Sent to {challenge.phoneMasked}. Because an ID number is not a secret, this code is
                what proves the phone is yours.
                {challenge.devCode ? (
                  <>
                    {' '}
                    <span className="text-gold">Development code: {challenge.devCode}</span>
                  </>
                ) : null}
              </FieldHint>
              <button
                type="button"
                onClick={requestCode}
                disabled={sendingCode}
                className="rounded text-xs text-gold underline-offset-4 hover:underline disabled:opacity-50"
              >
                Send a new code
              </button>
            </Field>
          ) : (
            <Button
              type="button"
              variant="glass"
              className="w-full"
              loading={sendingCode}
              onClick={requestCode}
            >
              <MessageSquare className="h-4 w-4" />
              Send me a verification code
            </Button>
          )}
        </>
      )}

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3.5 text-sm text-flame-soft"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {formError}
        </p>
      ) : null}

      {method === 'token' || challenge ? (
        <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      ) : null}

      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs leading-relaxed text-bone-dim">
          <strong className="text-bone-muted">Lost your token?</strong> Sign in with your ID number
          above instead. Once you are back in, you can retrieve the token itself from your Voter
          Card page.
        </p>
        <p className="text-xs leading-relaxed text-bone-dim">
          Signing in never lets anyone cast a rating in your name — every rating must present the
          token separately.
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
