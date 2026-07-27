'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, ArrowRight, MessageSquare, ShieldCheck } from 'lucide-react'
import type { OtpChallenge } from '@/backend/services/otp.service'
import { KENYAN_COUNTIES, registerSchema, type KenyanCounty } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Checkbox, Field, FieldHint, FieldLabel, Input, Select } from '@/frontend/components/ui/field'
import { DisclaimerBanner, TrustNotices } from '@/frontend/components/layout/disclaimers'
import { api, RequestError } from '@/frontend/lib/api'
import { useRegistrationStore } from '@/frontend/stores/registration.store'

/**
 * Three-step registration.
 *
 * Split deliberately: identity details on step one, phone verification on step
 * two, the national ID number and consent gates on step three. Asking for an ID
 * number in the same breath as a name reads as intrusive; showing what the
 * number is for first, and gating it behind explicit consent, does not.
 *
 * Step two is not a UX flourish — it is the platform's only defence against
 * bulk fake registration. The ID number collected on step three is a
 * self-declaration that nothing can verify, so the SMS code is what makes an
 * account cost something to create.
 *
 * Validation uses the exact same Zod schema the API enforces
 * (`backend/validators`), so the two layers can never disagree about what
 * counts as a valid phone number or ID.
 */

type Errors = Record<string, string>

/** Reshapes the API's `{ field: message }` map into the ZodIssue-like form. */
function toIssues(fields: Record<string, string>) {
  return Object.entries(fields).map(([key, message]) => ({ path: [key], message }))
}

export function RegisterForm() {
  const router = useRouter()
  const setIssued = useRegistrationStore((state) => state.setIssued)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  // Typed against the county union rather than plain string, so the value fed
  // to registerSchema is guaranteed to be one the schema accepts.
  const [county, setCounty] = useState<KenyanCounty | ''>('')
  const [idNumber, setIdNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acknowledgedNotIebc, setAcknowledgedNotIebc] = useState(false)

  /** Spreads a ZodError (or a server field map) into per-field messages. */
  function applyIssues(issues: { path: (string | number)[]; message: string }[]): Errors {
    const next: Errors = {}
    for (const issue of issues) {
      const key = issue.path.join('.')
      if (!next[key]) next[key] = issue.message
    }
    setErrors(next)
    return next
  }

  /**
   * Validates only the fields on the current step.
   *
   * County is checked here, not just at submit: advancing from this step sends a
   * real SMS, and it would be poor form to spend a message and the citizen's
   * time only to bounce them back for a field that was on screen all along.
   */
  function validateStepOne(): boolean {
    const result = registerSchema
      .pick({ name: true, phoneNumber: true, county: true })
      .safeParse({ name, phoneNumber, county })

    if (result.success) {
      setErrors({})
      return true
    }

    applyIssues(result.error.issues)
    return false
  }

  /** Sends the SMS code and advances to the verification step. */
  async function handleRequestCode() {
    if (!validateStepOne()) return

    setFormError(null)
    setSendingCode(true)

    try {
      setChallenge(await api.requestOtp({ phoneNumber }))
      setOtpCode('')
      setStep(2)
    } catch (caught) {
      if (caught instanceof RequestError) {
        setFormError(caught.message)
        if (caught.fields) applyIssues(toIssues(caught.fields))
      } else {
        setFormError('Could not send your code. Please try again.')
      }
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsed = registerSchema.safeParse({
      name,
      phoneNumber,
      idNumber,
      otpCode,
      county,
      acceptedTerms,
      acknowledgedNotIebc,
    })

    if (!parsed.success) {
      const next = applyIssues(parsed.error.issues)

      // A failure on an earlier step's field would otherwise be invisible.
      if (next.name || next.phoneNumber || next.county) setStep(1)
      else if (next.otpCode) setStep(2)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      // Send the parsed output rather than the raw fields — county is narrowed
      // to a real county here, and the phone and ID arrive already normalised.
      const result = await api.register(parsed.data)

      // Hand the token to the Voter Card screen in memory only — never via the
      // URL or storage. See frontend/stores/registration.store.ts.
      setIssued(result)
      router.push('/voter-card')
    } catch (caught) {
      if (caught instanceof RequestError) {
        setFormError(caught.message)
        if (caught.fields) {
          setErrors(caught.fields)
          if (caught.fields.name || caught.fields.phoneNumber) setStep(1)
          // A spent or mistyped code sends them back to re-enter it rather than
          // stranding them on a step with an error they cannot act on.
          else if (caught.fields.otpCode) setStep(2)
        }
      } else {
        setFormError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <DisclaimerBanner />

      {/* Step indicator */}
      <div className="flex items-center gap-3" aria-hidden>
        {[1, 2, 3].map((value) => (
          <div key={value} className="flex flex-1 items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step >= value ? 'bg-gold text-ink-900' : 'bg-white/10 text-bone-dim'
              }`}
            >
              {value}
            </span>
            <span
              className={`h-px flex-1 transition-colors ${step > value ? 'bg-gold/60' : 'bg-white/10'}`}
            />
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Step {step} of 3
      </p>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-bone">About you</h2>
              <p className="text-sm text-bone-dim">
                Your name appears on your Voter Card and nowhere else on this platform.
              </p>
            </div>

            <Field error={errors.name}>
              <FieldLabel>Full name</FieldLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="As it appears on your ID"
                autoComplete="name"
              />
            </Field>

            <Field error={errors.phoneNumber}>
              <FieldLabel>Phone number</FieldLabel>
              <Input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="0712 345 678"
                inputMode="tel"
                autoComplete="tel"
              />
              <FieldHint>
                Used to sign in later and to prevent duplicate registration. Stored hashed, never in
                readable form.
              </FieldHint>
            </Field>

            <Field error={errors.county}>
              <FieldLabel>County</FieldLabel>
              <Select
                value={county}
                onChange={(event) => setCounty(event.target.value as KenyanCounty | '')}
                required
              >
                {/* Disabled so it cannot be chosen back, and hidden so it drops
                    out of the list once a real county is picked. */}
                <option value="" disabled hidden>
                  Select your county
                </option>
                {KENYAN_COUNTIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <FieldHint>
                Powers the public participation-by-region breakdown. Never shown against your name
                or your votes.
              </FieldHint>
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

            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              loading={sendingCode}
              onClick={handleRequestCode}
            >
              Send me a code
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : step === 2 ? (
          <motion.div
            key="step-2"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-bone">
                Confirm your phone number
              </h2>
              <p className="text-sm text-bone-dim">
                We sent a six-digit code to {challenge?.phoneMasked ?? 'your phone'}. Entering it
                proves this number is yours — it is what keeps this platform from being flooded with
                accounts nobody owns.
              </p>
            </div>

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
              <FieldHint>
                The code expires in ten minutes. We will never ask you for it by phone or message.
              </FieldHint>
            </Field>

            {/* Development convenience only: the server omits `devCode` in
                production, so this block cannot render on a real deployment. */}
            {challenge?.devCode ? (
              <p className="rounded-2xl border border-gold/30 bg-gold/[0.08] p-3.5 text-sm text-gold">
                <strong className="font-semibold">Development mode:</strong> no SMS was sent. Your
                code is <span className="font-mono tracking-widest">{challenge.devCode}</span>.
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
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  const result = registerSchema.pick({ otpCode: true }).safeParse({ otpCode })
                  if (!result.success) {
                    applyIssues(result.error.issues)
                    return
                  }
                  setErrors({})
                  setFormError(null)
                  setStep(3)
                }}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                loading={sendingCode}
                onClick={handleRequestCode}
              >
                <MessageSquare className="h-4 w-4" />
                Resend
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-bone">
                Verify you are one person
              </h2>
              <p className="text-sm text-bone-dim">
                This is the only thing standing between honest results and ballot stuffing.
              </p>
            </div>

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
                Hashed immediately and never stored in readable form. It is used only to check that
                this ID has not registered before — it is never displayed, sold or shared.
              </FieldHint>
            </Field>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <TrustNotices />
            </div>

            <div className="space-y-3">
              <Checkbox
                checked={acknowledgedNotIebc}
                onChange={(event) => setAcknowledgedNotIebc(event.target.checked)}
                error={errors.acknowledgedNotIebc}
                label={
                  <>
                    I understand this is an <strong className="text-bone">independent</strong>{' '}
                    platform and <strong className="text-bone">not</strong> an official IEBC voter
                    registration or election.
                  </>
                }
              />

              <Checkbox
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                error={errors.acceptedTerms}
                label={
                  <>
                    I accept the{' '}
                    <Link href="/terms" className="text-gold underline-offset-4 hover:underline">
                      terms of use
                    </Link>{' '}
                    and the{' '}
                    <Link
                      href="/privacy-policy"
                      className="text-gold underline-offset-4 hover:underline"
                    >
                      privacy policy
                    </Link>
                    .
                  </>
                }
              />
            </div>

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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="flex-1"
              >
                <ShieldCheck className="h-4 w-4" />
                Register &amp; issue my token
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={submitting}
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-sm text-bone-dim">
        Already registered?{' '}
        <Link href="/login" className="text-gold underline-offset-4 hover:underline">
          Sign in with your token
        </Link>
      </p>
    </form>
  )
}
