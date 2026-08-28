'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, MessageSquare, Trash2 } from 'lucide-react'
import type { OtpChallenge } from '@/backend/services/otp.service'
import { DELETE_CONFIRMATION, deleteAccountSchema } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'

/**
 * Permanent account erasure.
 *
 * WHY THIS IS DELIBERATELY AWKWARD
 * ────────────────────────────────
 * Every other destructive control on this site can be undone; this one cannot.
 * So it is collapsed by default, it re-proves control of the registered SIM,
 * and it asks the citizen to type a word. None of that is friction for its own
 * sake — the outcome is irreversible, and irreversible actions should be hard
 * to perform by accident.
 *
 * WHY IT STATES WHAT SURVIVES
 * ───────────────────────────
 * A hashed record of the phone and ID remains, so the same person cannot
 * register again. Burying that would be the dishonest choice: a citizen who
 * expects to be able to come back later needs to know before they press the
 * button, not after. See `deleteAccount` in auth.service.ts for why the hashes
 * cannot simply be dropped too.
 */

type Stage = 'collapsed' | 'warned' | 'code'

export function DeleteAccount({ candidatesRated }: { candidatesRated: number }) {
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('collapsed')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [confirmation, setConfirmation] = useState('')
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

  function reset() {
    setStage('collapsed')
    setPhoneNumber('')
    setOtpCode('')
    setConfirmation('')
    setChallenge(null)
    setFormError(null)
    setErrors({})
  }

  async function sendCode() {
    const parsed = deleteAccountSchema.pick({ phoneNumber: true }).safeParse({ phoneNumber })

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

  async function erase() {
    const parsed = deleteAccountSchema.safeParse({ phoneNumber, otpCode, confirmation })

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
      await api.deleteAccount(parsed.data)

      // The server has already cleared the session cookie. `refresh` discards
      // the cached RSC payload for this page, which was rendered for an account
      // that no longer exists.
      router.replace('/?deleted=1')
      router.refresh()
    } catch (caught) {
      fail(caught, 'Could not delete your account. Please try again.')
      setBusy(false)
    }
  }

  if (stage === 'collapsed') {
    return (
      <div className="border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => setStage('warned')}
          className="text-sm text-bone-dim underline-offset-4 transition-colors hover:text-flame-soft hover:underline"
        >
          Delete my account
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-2xl border border-flame/30 bg-flame/[0.06] p-5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-flame" aria-hidden />
        <div className="space-y-2">
          <h3 className="font-display text-base font-semibold text-bone">
            Delete your account permanently
          </h3>
          <p className="text-sm leading-relaxed text-bone-muted">
            This removes your account, your voting token and{' '}
            <strong className="font-semibold text-bone">
              {candidatesRated === 0
                ? 'any ratings you have cast'
                : `all ${candidatesRated} of your candidate ${
                    candidatesRated === 1 ? 'rating' : 'ratings'
                  }`}
            </strong>
            . Your ratings are taken out of the published results, so the public totals will go
            down.
          </p>
          <p className="text-sm leading-relaxed text-bone-muted">
            <strong className="font-semibold text-bone">You cannot register again.</strong> A
            hashed record of your phone number and ID is kept for that reason alone — it cannot be
            read or reversed, and it is all that remains. This is how the platform keeps one
            citizen to one voice; without it, deleting and re-registering would be a way to vote
            twice.
          </p>
          <p className="text-sm font-medium text-flame-soft">This cannot be undone.</p>
        </div>
      </div>

      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-flame/40 bg-flame/10 p-3 text-sm text-bone"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden />
          {formError}
        </p>
      ) : null}

      {stage === 'warned' ? (
        <div className="space-y-4">
          <Field error={errors.phoneNumber}>
            <FieldLabel>Confirm your registered phone number</FieldLabel>
            <Input
              name="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            <FieldHint>
              We will send a code to this number. It must be the number this account registered
              with.
            </FieldHint>
          </Field>

          <div className="flex flex-wrap gap-2.5">
            <Button variant="danger" size="sm" loading={busy} onClick={sendCode}>
              <MessageSquare className="h-4 w-4" aria-hidden />
              Send confirmation code
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Keep my account
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {challenge?.devCode ? (
            <p className="rounded-xl border border-white/12 bg-white/[0.04] p-3 text-xs text-bone-muted">
              Development mode — your code is{' '}
              <strong className="font-mono text-bone">{challenge.devCode}</strong>
            </p>
          ) : null}

          <Field error={errors.otpCode}>
            <FieldLabel>Verification code</FieldLabel>
            <Input
              name="otpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
            />
          </Field>

          <Field error={errors.confirmation}>
            <FieldLabel>
              Type {DELETE_CONFIRMATION} to confirm
            </FieldLabel>
            <Input
              name="confirmation"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder={DELETE_CONFIRMATION}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="danger"
              size="sm"
              loading={busy}
              onClick={erase}
              // The typed word gates the button as well as the schema, so the
              // destructive action cannot be reached by pressing Enter early.
              disabled={busy || confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete my account permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              Keep my account
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
