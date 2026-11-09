'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  PenLine,
  ShieldCheck,
} from 'lucide-react'
import type { CitizenRating } from '@/backend/services/vote.service'
import {
  VOTE_CHOICE_META,
  VOTE_CHOICE_ORDER,
  VOTE_CHOICE_QUESTION,
  FLAG_META,
  type FlagColor,
  type VoteChoice,
} from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { FlagIcon } from '@/frontend/components/ui/flag-icon'
import { Field, FieldHint, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'
import { formatDateTime } from '@/frontend/lib/format'
import { cn } from '@/frontend/lib/utils'
import { FlagWidget } from './flag-widget'

/**
 * The combined vote + flag submission widget.
 *
 * Both answers are collected here and posted together to `/api/vote`, which
 * writes them in a single transaction — so a citizen can never end up with a
 * vote counted but their trust flag lost.
 *
 * A citizen who has already rated this candidate sees what they said and can
 * change it. The form then opens pre-filled with their current answers, because
 * a "change your mind" flow that starts blank hides what is being replaced and
 * invites a half-remembered answer to be submitted as a deliberate revision.
 * Revising updates the same row, so they still count exactly once.
 *
 * The raw voting token is held in component state for the duration of the
 * submission and nothing more. It is never written to localStorage, never put
 * in the URL, and is cleared the moment the submission succeeds. A revision
 * demands it again — the token, not the session, is what authorises a change to
 * the published totals.
 */

type Stage = 'choosing' | 'confirming' | 'done'

export function VoteWidget({
  candidateId,
  candidateName,
  signedIn,
  existing,
  next,
  remaining,
}: {
  candidateId: string
  candidateName: string
  signedIn: boolean
  /** This citizen's standing rating, or null if they have not rated yet. */
  existing: CitizenRating | null
  /** The following candidate, so a finished rating leads straight on. */
  next?: { slug: string; fullName: string } | null
  /** How many candidates this citizen has left, for the progress line. */
  remaining?: number
}) {
  const router = useRouter()
  const [choice, setChoice] = useState<VoteChoice | null>(existing?.choice ?? null)
  const [color, setColor] = useState<FlagColor | null>(existing?.color ?? null)
  const [token, setToken] = useState('')
  const [stage, setStage] = useState<Stage>('choosing')
  const [editing, setEditing] = useState(false)
  /**
   * Whether the submission that produced the success card was a revision,
   * taken from the receipt rather than from `existing`.
   *
   * `existing` is server state: the `router.refresh()` fired on success turns it
   * non-null, so reading it here would flip a first-time citizen's confirmation
   * to "your rating has been updated" a moment after they submitted it.
   */
  const [justRevised, setJustRevised] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const revising = existing !== null

  if (!signedIn) {
    return (
      <div className="glass space-y-4 p-6">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-flame" aria-hidden />
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

  // The standing rating, shown until the citizen asks to change it. This is the
  // resting state for anyone who has already taken part.
  if (existing && !editing && stage !== 'done') {
    return (
      <div className="glass space-y-4 p-6">
        <div className="flex items-center gap-2.5 text-verdant-soft">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <h2 className="font-display text-lg font-semibold">Your rating for {candidateName}</h2>
        </div>

        <ul className="space-y-2 text-sm text-bone-muted">
          <li>
            Vote:{' '}
            <strong className="font-semibold text-bone">
              {existing.choice ? VOTE_CHOICE_META[existing.choice].label : 'Not recorded'}
            </strong>
          </li>
          <li className="flex items-center gap-1.5">
            Trust flag:
            {existing.color ? <FlagIcon color={existing.color} className="h-4 w-4" /> : null}
            <strong className="font-semibold text-bone">
              {existing.color ? FLAG_META[existing.color].label : 'Not recorded'}
            </strong>
          </li>
        </ul>

        <p className="text-xs leading-relaxed text-bone-dim">
          {existing.revised ? 'Last changed' : 'Recorded'}{' '}
          {formatDateTime(existing.revised ? existing.updatedAt : existing.recordedAt)}. You count
          once for this candidate — changing your answer replaces it rather than adding a second
          one.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="glass"
            size="sm"
            onClick={() => {
              setChoice(existing.choice)
              setColor(existing.color)
              setError(null)
              setFieldError(null)
              setEditing(true)
            }}
          >
            <PenLine className="h-4 w-4" />
            Change my rating
          </Button>
          {next ? (
            <Button asChild variant="primary" size="sm">
              <Link href={`/candidates/${next.slug}`}>
                Next: {next.fullName}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="primary" size="sm">
              <Link href="/candidates">Back to all candidates</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  const ready = choice !== null && color !== null
  const unchanged = revising && choice === existing?.choice && color === existing?.color

  async function submit() {
    if (!choice || !color) return

    setSubmitting(true)
    setError(null)
    setFieldError(null)

    try {
      const receipt = await api.submitBallot({ candidateId, choice, color, token })

      // Clear the token from memory as soon as it has served its purpose.
      setToken('')
      setJustRevised(receipt.revised)
      setStage('done')
      setEditing(false)

      // Refresh so the server-rendered standing rating and the public tallies
      // both reflect this submission.
      router.refresh()
    } catch (caught) {
      if (caught instanceof RequestError) {
        if (caught.code === 'UNAUTHORIZED' || caught.code === 'FORBIDDEN') {
          setFieldError(caught.message)
        } else {
          setError(caught.message)
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
          <h2 className="font-display text-lg font-semibold">
            {justRevised ? 'Your rating has been updated' : 'Your rating has been recorded'}
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-bone-muted">
          {justRevised
            ? `Thank you. Your earlier answer for ${candidateName} has been replaced, and the public tally now reflects what you think today.`
            : `Thank you. Your response for ${candidateName} is now part of the public tally, counted anonymously alongside everyone else’s.`}
          {!justRevised && typeof remaining === 'number' && remaining > 1 ? (
            <>
              {' '}
              <strong className="font-semibold text-bone">
                {remaining - 1} {remaining - 1 === 1 ? 'candidate' : 'candidates'} left to rate.
              </strong>
            </>
          ) : null}
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          {next ? (
            <Button asChild variant="verdant" size="sm">
              <Link href={`/candidates/${next.slug}`}>
                Next: {next.fullName}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="verdant" size="sm">
              <Link href="/candidates">Back to all candidates</Link>
            </Button>
          )}
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
        <h2 className="font-display text-xl font-semibold text-bone">
          {revising ? 'Change your rating' : 'Record your view'}
        </h2>
        <p className="text-sm text-bone-dim">
          {revising
            ? 'Your current answers are selected below. Whatever you submit replaces them.'
            : 'One vote and one trust flag per candidate. Both are submitted together.'}
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
                    ? 'border-bone/50 bg-white/[0.08] shadow-glow'
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
          The token from your Voter Card. It is checked against your account and
          {revising
            ? ' is required again to change an answer it already recorded.'
            : ' spent only on this candidate.'}{' '}
          Hyphens are optional.
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

      {/* Step 4 — explicit confirmation. A rating moves a published number, so
          the commitment is never one click away — and on a revision it says
          plainly what is being overwritten. */}
      <AnimatePresence mode="wait">
        {stage === 'confirming' ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-2xl border border-flame/30 bg-flame/[0.06] p-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-bone">
                  {revising ? 'Confirm your change' : 'Confirm your submission'}
                </p>
                <ul className="space-y-1 text-sm text-bone-muted">
                  <li>
                    Vote:{' '}
                    <strong className="font-semibold text-bone">
                      {choice ? VOTE_CHOICE_META[choice].label : ''}
                    </strong>
                    {revising && existing?.choice && existing.choice !== choice ? (
                      <span className="text-bone-dim">
                        {' '}
                        (was {VOTE_CHOICE_META[existing.choice].label})
                      </span>
                    ) : null}
                  </li>
                  <li className="flex flex-wrap items-center gap-1.5">
                    Trust flag:
                    {color ? <FlagIcon color={color} className="h-4 w-4" /> : null}
                    <strong className="font-semibold text-bone">
                      {color ? FLAG_META[color].label : ''}
                    </strong>
                    {revising && existing?.color && existing.color !== color ? (
                      <span className="text-bone-dim">(was {FLAG_META[existing.color].label})</span>
                    ) : null}
                  </li>
                </ul>
                <p className="text-xs leading-relaxed text-bone-dim">
                  {revising
                    ? `This replaces your current rating of ${candidateName} in the public totals. You can change it again later.`
                    : `Your token is spent on ${candidateName} and this becomes your standing answer. You can come back and change it later.`}
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button variant="primary" size="sm" loading={submitting} onClick={submit}>
                  <ShieldCheck className="h-4 w-4" />
                  {revising ? 'Confirm change' : 'Confirm & submit'}
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
              disabled={!ready || unchanged || token.trim().length === 0}
              onClick={() => {
                setError(null)
                setFieldError(null)
                setStage('confirming')
              }}
            >
              {revising ? 'Review change' : 'Review submission'}
            </Button>
            {!ready ? (
              <p className="mt-2.5 text-center text-xs text-bone-dim">
                Choose a vote and a trust flag to continue.
              </p>
            ) : null}
            {/* Submitting an identical answer would spend a request and a
                confirmation to change nothing, so it is not offered. */}
            {unchanged ? (
              <p className="mt-2.5 text-center text-xs text-bone-dim">
                This is what you already said. Pick something different to change your rating.
              </p>
            ) : null}
            {revising ? (
              <div className="mt-2.5 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChoice(existing?.choice ?? null)
                    setColor(existing?.color ?? null)
                    setToken('')
                    setError(null)
                    setFieldError(null)
                    setEditing(false)
                  }}
                >
                  Keep my current rating
                </Button>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
