'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import {
  VOTE_CHOICE_META,
  VOTE_CHOICE_ORDER,
  VOTE_CHOICE_QUESTION,
  FLAG_META,
  type FlagColor,
  type VoteChoice,
} from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'
import { cn } from '@/frontend/lib/utils'
import { FlagWidget } from './flag-widget'

/**
 * The combined vote + flag submission widget.
 *
 * Both answers are collected here and posted together to `/api/vote`, which
 * writes them in a single transaction — so a citizen can never end up with a
 * vote counted but their trust flag lost.
 *
 * The raw voting token is held in component state for the duration of the
 * submission and nothing more. It is never written to localStorage, never put
 * in the URL, and is cleared the moment the submission succeeds.
 */

type Stage = 'choosing' | 'confirming' | 'done'

export function VoteWidget({
  candidateId,
  candidateName,
  signedIn,
  alreadyRated,
}: {
  candidateId: string
  candidateName: string
  signedIn: boolean
  alreadyRated: boolean
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<VoteChoice | null>(null)
  const [color, setColor] = useState<FlagColor | null>(null)
  const [token, setToken] = useState('')
  const [stage, setStage] = useState<Stage>('choosing')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  if (alreadyRated) {
    return (
      <div className="glass space-y-3 p-6">
        <div className="flex items-center gap-2.5 text-verdant-soft">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <h2 className="font-display text-lg font-semibold">You have rated this candidate</h2>
        </div>
        <p className="text-sm leading-relaxed text-bone-muted">
          Your voting token has been spent on {candidateName} and cannot be used for them again.
          This is what keeps the results honest — every citizen counts exactly once per candidate.
        </p>
        <Button asChild variant="glass" size="sm">
          <Link href="/candidates">Rate another candidate</Link>
        </Button>
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="glass space-y-4 p-6">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-gold" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-bone">
            Sign in to rate this candidate
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-bone-muted">
          You need a Voter Card to take part. Registration takes under a minute and issues one
          secure token that is yours alone.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="primary" size="sm">
            <Link href="/register">Register</Link>
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/login">I already have a token</Link>
          </Button>
        </div>
      </div>
    )
  }

  const ready = choice !== null && color !== null

  async function submit() {
    if (!choice || !color) return

    setSubmitting(true)
    setError(null)
    setFieldError(null)

    try {
      await api.submitBallot({ candidateId, choice, color, token })

      // Clear the token from memory as soon as it has served its purpose.
      setToken('')
      setStage('done')

      // Refresh so the server-rendered "already rated" state and the public
      // tallies both reflect this submission.
      router.refresh()
    } catch (caught) {
      if (caught instanceof RequestError) {
        if (caught.code === 'UNAUTHORIZED' || caught.code === 'FORBIDDEN') {
          setFieldError(caught.message)
        } else {
          setError(caught.message)
        }
        // A conflict means the rating already landed — reflect reality.
        if (caught.code === 'CONFLICT') {
          setStage('choosing')
          router.refresh()
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
      setStage('choosing')
    } finally {
      setSubmitting(false)
    }
  }

  if (stage === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass space-y-3 border-verdant/25 p-6"
      >
        <div className="flex items-center gap-2.5 text-verdant-soft">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <h2 className="font-display text-lg font-semibold">Your rating has been recorded</h2>
        </div>
        <p className="text-sm leading-relaxed text-bone-muted">
          Thank you. Your response for {candidateName} is now part of the public tally, counted
          anonymously alongside everyone else’s.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button asChild variant="verdant" size="sm">
            <Link href="/candidates">Rate another candidate</Link>
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/transparency">See live results</Link>
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="glass space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold text-bone">Record your view</h2>
        <p className="text-sm text-bone-dim">
          One vote and one trust flag per candidate. Both are submitted together.
        </p>
      </div>

      {/* Step 1 — sentiment vote */}
      <fieldset disabled={submitting} className="space-y-3">
        <legend className="text-sm font-medium text-bone">{VOTE_CHOICE_QUESTION}</legend>

        <div
          role="radiogroup"
          aria-label={VOTE_CHOICE_QUESTION}
          className="grid gap-2.5 sm:grid-cols-3"
        >
          {VOTE_CHOICE_ORDER.map((option) => {
            const meta = VOTE_CHOICE_META[option]
            const selected = choice === option

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoice(option)}
                className={cn(
                  'rounded-2xl border p-3.5 text-left transition-all duration-200',
                  selected
                    ? 'border-gold/50 bg-gold/[0.09] shadow-glow-gold'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                )}
              >
                <span className="block text-sm font-semibold text-bone">{meta.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-bone-dim">
                  {meta.description}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="hairline" />

      {/* Step 2 — trust flag */}
      <FlagWidget value={color} onChange={setColor} disabled={submitting} />

      <div className="hairline" />

      {/* Step 3 — token */}
      <Field error={fieldError ?? undefined}>
        <FieldLabel>Your voting token</FieldLabel>
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
        <FieldHint>
          The token from your Voter Card. It is checked against your account and spent only on this
          candidate. Hyphens are optional.
        </FieldHint>
      </Field>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-flame/30 bg-flame/[0.08] p-3.5 text-sm text-flame-soft"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* Step 4 — explicit confirmation. Ratings are irreversible, so the
          commitment is never one click away. */}
      <AnimatePresence mode="wait">
        {stage === 'confirming' ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-bone">Confirm your submission</p>
                <ul className="space-y-1 text-sm text-bone-muted">
                  <li>
                    Vote:{' '}
                    <strong className="font-semibold text-bone">
                      {choice ? VOTE_CHOICE_META[choice].label : ''}
                    </strong>
                  </li>
                  <li className="flex items-center gap-1.5">
                    Trust flag:
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color ? FLAG_META[color].hex : undefined }}
                      aria-hidden
                    />
                    <strong className="font-semibold text-bone">
                      {color ? FLAG_META[color].label : ''}
                    </strong>
                  </li>
                </ul>
                <p className="text-xs leading-relaxed text-bone-dim">
                  This cannot be changed or withdrawn once submitted, and your token cannot be used
                  for {candidateName} again.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button variant="primary" size="sm" loading={submitting} onClick={submit}>
                  <ShieldCheck className="h-4 w-4" />
                  Confirm &amp; submit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={submitting}
                  onClick={() => setStage('choosing')}
                >
                  Go back
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!ready || token.trim().length === 0}
              onClick={() => {
                setError(null)
                setFieldError(null)
                setStage('confirming')
              }}
            >
              Review submission
            </Button>
            {!ready ? (
              <p className="mt-2.5 text-center text-xs text-bone-dim">
                Choose a vote and a trust flag to continue.
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
