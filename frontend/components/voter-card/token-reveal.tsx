'use client'

import { useState } from 'react'
import { AlertCircle, KeyRound, MessageSquare, ShieldCheck } from 'lucide-react'
import type { OtpChallenge } from '@/backend/services/otp.service'
import { revealTokenSchema } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'

/**
 * Retrieval of the citizen's own voting token.
 *
 * WHY THIS ASKS FOR A CODE RATHER THAN JUST SHOWING THE TOKEN
 * ──────────────────────────────────────────────────────────
 * A session on this platform deliberately does not carry voting authority —
 * every rating must also present the raw token. Printing the token to anyone
 * with a session would collapse that into a single factor, so a shared or
 * stolen browser would become 30 days of voting authority.
 *
 * Re-proving control of the registered SIM keeps the two factors apart. It is
 * friction on a rare action, which is the right place to put friction.
 */

type Stage = 'idle' | 'phone' | 'code'

export function TokenReveal({ onRevealed }: { onRevealed: (rawToken: string) => void }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function fail(caught: unknown, fallback: string) {
    if (caught instanceof RequestError) {
      setFormError(caught.message)
      setErrors(caught.fields ?? {})
    } else {
      setFormError(fallback)
    }
  }

  async function sendCode() {
    const parsed = revealTokenSchema.pick({ phoneNumber: true }).safeParse({ phoneNumber })

    if (!parsed.success) {
      setErrors({ phoneNumber: parsed.error.issues[0]?.message ?? 'Enter a valid number' })
      return
    }

    setBusy(true)
    setFormError(null)
    setErrors({})

    try {
      setChallenge(await api.requestOtp({ phoneNumber }))
      setOtpCode('')
      setStage('code')
    } catch (caught) {
      fail(caught, 'Could not send your code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function reveal() {
    const parsed = revealTokenSchema.safeParse({ phoneNumber, otpCode })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setBusy(true)
    setFormError(null)
    setErrors({})

    try {
      const result = await api.revealToken({ phoneNumber, otpCode })
      onRevealed(result.rawToken)
    } catch (caught) {
      fail(caught, 'Could not retrieve your token. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'idle') {
    return (
      <div className="glass space-y-4 p-5">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-bone">
              Retrieve your voting token
            </h2>
            <p className="text-sm leading-relaxed text-bone-dim">
              Your token is stored encrypted and can be shown to you again. Because it is what
              authorises your ratings, we will send a code to the phone number you registered with
              before displaying it.
            </p>
          </div>
        </div>

        <Button variant="glass" size="sm" onClick={() => setStage('phone')}>
          <ShieldCheck className="h-4 w-4" />
          Show my voting token
        </Button>
      </div>
    )
  }

  return (
    <div className="glass space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold text-bone">
          {stage === 'phone' ? 'Confirm your phone number' : 'Enter your code'}
        </h2>
        <p className="text-sm leading-relaxed text-bone-dim">
          {stage === 'phone'
            ? 'Enter the number this account registered with. It must match, or no code is sent.'
            : `We sent a six-digit code to ${challenge?.phoneMasked ?? 'your phone'}.`}
        </p>
      </div>

      {stage === 'phone' ? (
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
      ) : (
        <Field error={errors.otpCode}>
          <FieldLabel>Verification code</FieldLabel>
          <Input
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
          />
          <FieldHint>The code expires in ten minutes.</FieldHint>
        </Field>
      )}

      {/* Development only — the server omits `devCode` in production. */}
      {stage === 'code' && challenge?.devCode ? (
        <p className="rounded-2xl border border-gold/30 bg-gold/[0.08] p-3.5 text-sm text-gold">
          <strong className="font-semibold">Development mode:</strong> no SMS was sent. Your code is{' '}
          <span className="font-mono tracking-widest">{challenge.devCode}</span>.
        </p>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3.5 text-sm text-flame-soft"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        {stage === 'phone' ? (
          <Button variant="primary" size="sm" loading={busy} onClick={sendCode}>
            <MessageSquare className="h-4 w-4" />
            Send me a code
          </Button>
        ) : (
          <>
            <Button variant="primary" size="sm" loading={busy} onClick={reveal}>
              <ShieldCheck className="h-4 w-4" />
              Show my token
            </Button>
            <Button variant="ghost" size="sm" loading={busy} onClick={sendCode}>
              Resend
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setStage('idle')
            setFormError(null)
            setErrors({})
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
