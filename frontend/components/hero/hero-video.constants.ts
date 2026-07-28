/**
 * Hero clip playlist and sequencing maths.
 *
 * Kept out of the component so the ordering rules can be unit-tested without
 * mounting React or a DOM — the "loops back to the first clip after the last"
 * behaviour is the whole feature, and it should not rely on a browser to prove.
 */

export type HeroClip = {
  /** Public path. Must exist in /public — asserted by the unit tests. */
  src: string
  /**
   * A still frame from this clip, painted immediately while the video buffers.
   *
   * This is what actually replaced the illustrated artwork as the hero's
   * backdrop: roughly 25KB, decoded before any video byte arrives, and visually
   * identical to the clip's opening frame — so the hero shows the real footage
   * from the first paint rather than a stand-in.
   */
  poster: string
  /** Used as the accessible name of that clip's dot control. */
  caption: string
}

export const HERO_CLIPS: readonly HeroClip[] = [
  { src: '/jk1-vid.mp4', poster: '/hero-posters/jk1.jpg', caption: 'A new political season' },
  { src: '/jk2-vid.mp4', poster: '/hero-posters/jk2.jpg', caption: 'From every county and city' },
  { src: '/jk3-vid.mp4', poster: '/hero-posters/jk3.jpg', caption: 'One land, many voices' },
  { src: '/jk4-vid.mp4', poster: '/hero-posters/jk4.jpg', caption: 'Counted openly, together' },
] as const

/**
 * The next clip index, wrapping in both directions for ANY step size.
 *
 * JavaScript's `%` keeps the sign of the dividend, so `(0 - 1) % 4` is `-1`,
 * not `3`. Adding `total` once fixes a single step backwards but still returns
 * a negative index for anything larger — `(0 - 10 + 4) % 4` is `-2`. Taking the
 * modulo twice normalises the sign whatever the delta, so the function is total
 * rather than merely correct for the ±1 the controls happen to use today.
 */
export function nextClipIndex(current: number, delta: number, total = HERO_CLIPS.length): number {
  return (((current + delta) % total) + total) % total
}

/**
 * Headline phrases, index-matched to the clips.
 *
 * The words turn over with the footage rather than on a timer of their own, so
 * a phrase is never left stranded over the wrong clip and the two never drift
 * apart. `lead` renders plain, `accent` in the gradient treatment.
 *
 * Editorial rule, same as everywhere else on this platform: dignified, and
 * strictly non-partisan. Nothing here may favour a candidate or imply an
 * outcome — these words sit above a rating tool, not a campaign.
 */
export type HeroPhrase = { lead: string; accent: string }

export const HERO_PHRASES: readonly HeroPhrase[] = [
  { lead: 'Your Voice.', accent: 'Verified. Transparent.' },
  { lead: 'One Citizen.', accent: 'One Voice. Counted.' },
  { lead: 'Every County.', accent: 'Heard. Recorded.' },
  { lead: 'The Record.', accent: 'Open. Auditable.' },
] as const
