import { z } from 'zod'
import { votingTokenSchema } from './auth.validator'

/**
 * Vote and flag submission schemas, plus the human-readable legend for each
 * flag colour. The legend lives here (not in a component) so the API, the
 * dashboard and the voting widget all describe the colours identically.
 */

export const voteChoiceSchema = z.enum(['YES', 'NO', 'NOT_SURE'])
export const flagColorSchema = z.enum(['GREEN', 'ORANGE', 'RED', 'BLACK'])

export type VoteChoice = z.infer<typeof voteChoiceSchema>
export type FlagColor = z.infer<typeof flagColorSchema>

export const submitVoteSchema = z.object({
  candidateId: z.string().cuid('Invalid candidate reference'),
  choice: voteChoiceSchema,
  token: votingTokenSchema,
})

export const submitFlagSchema = z.object({
  candidateId: z.string().cuid('Invalid candidate reference'),
  color: flagColorSchema,
  token: votingTokenSchema,
})

/**
 * Combined submission — the product flow asks for a vote and a flag together,
 * and both are written in one transaction so a citizen can never end up with a
 * vote recorded but no flag (or vice versa).
 */
export const submitBallotSchema = z.object({
  candidateId: z.string().cuid('Invalid candidate reference'),
  choice: voteChoiceSchema,
  color: flagColorSchema,
  token: votingTokenSchema,
})

export type SubmitVotePayload = z.output<typeof submitVoteSchema>
export type SubmitFlagPayload = z.output<typeof submitFlagSchema>
export type SubmitBallotPayload = z.output<typeof submitBallotSchema>

export const VOTE_CHOICE_LABELS: Record<VoteChoice, string> = {
  YES: 'Yes',
  NO: 'No',
  NOT_SURE: 'Not sure',
}

export const VOTE_CHOICE_QUESTION =
  'Would you consider supporting this candidate for President in 2027?'

export const VOTE_CHOICE_META: Record<VoteChoice, { label: string; description: string }> = {
  YES: {
    label: 'Yes',
    description: 'I would consider supporting this candidate.',
  },
  NO: {
    label: 'No',
    description: 'I would not consider supporting this candidate.',
  },
  NOT_SURE: {
    label: 'Not sure',
    description: 'I have not made up my mind about this candidate.',
  },
}

/**
 * Trust-flag palette — the single source of truth for swatches, charts and the
 * Tailwind theme alike.
 *
 * HOW THESE VALUES WERE CHOSEN
 * ────────────────────────────
 * Green → Orange → Red → Black is the product's vocabulary, so the hues are
 * fixed by the domain and cannot be swapped for a colourblind-friendlier set.
 * That makes this an *ordinal severity ramp*, not a free categorical palette,
 * and it is treated as one: the four steps have strictly decreasing OKLCH
 * lightness (0.68 → 0.61 → 0.55 → 0.49, every adjacent gap ≥ 0.06) against the
 * dark chart surface.
 *
 * The consequence that matters: a reader with any form of colour-vision
 * deficiency can still order the segments, because *lightness* carries the
 * ranking, not hue. Red and orange remain close in hue (OKLab ΔE ≈ 12.6 under
 * normal vision), so secondary encoding is MANDATORY wherever these appear —
 * every chart segment and swatch in this codebase ships with a visible text
 * label and a 2px surface gap. Do not render these colours bare.
 */
export const FLAG_META: Record<
  FlagColor,
  { label: string; description: string; hex: string }
> = {
  GREEN: {
    label: 'Green',
    description: 'I trust this candidate and have no significant concerns.',
    hex: '#1DB456',
  },
  ORANGE: {
    label: 'Orange',
    description: 'I have some reservations or unanswered questions.',
    hex: '#C26A05',
  },
  RED: {
    label: 'Red',
    description: 'I have serious concerns about this candidate.',
    hex: '#CB2727',
  },
  BLACK: {
    label: 'Black',
    description: 'I would not accept this candidate under any circumstances.',
    hex: '#566070',
  },
}

/**
 * Vote-choice palette.
 *
 * Unlike the flag ramp these hues are not fixed by the domain, so they were
 * chosen to pass every computable check against the dark chart surface as a
 * three-slot categorical palette (all-pairs): OKLCH lightness inside the dark
 * band, chroma above the grey floor, ≥ 3:1 contrast, and OKLab ΔE clearing both
 * the CVD target and the normal-vision floor on every pair.
 *
 * Deliberately drawn from a different colour family than the flag ramp, so a
 * green segment in one chart is never confused for a green segment in the other.
 */
export const VOTE_CHOICE_COLORS: Record<VoteChoice, string> = {
  YES: '#2F8FD9',
  NO: '#D06D9E',
  NOT_SURE: '#C2871F',
}

export const FLAG_QUESTION = 'How much trust do you place in this candidate?'

export const VOTE_CHOICE_ORDER: VoteChoice[] = ['YES', 'NO', 'NOT_SURE']
export const FLAG_COLOR_ORDER: FlagColor[] = ['GREEN', 'ORANGE', 'RED', 'BLACK']
