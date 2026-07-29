import { FLAG_META, type FlagColor } from '@/backend/validators'
import { cn } from '@/frontend/lib/utils'

/**
 * A trust flag drawn as an actual flag: a pole with a banner flying from it.
 *
 * These used to be plain colour dots, which made "green flag" and "red flag"
 * read as generic status pips rather than as the thing the product actually
 * calls them. The silhouette carries the metaphor even before the colour is
 * processed — which also means the icon still communicates something to a
 * reader who cannot separate the hues.
 *
 * DRAWING NOTES
 * ─────────────
 * The banner is a shallow S-curve rather than a rectangle so it reads as cloth
 * at a glance, but the wave is deliberately gentle: at the 10–12px these render
 * at in legends and table headers, a pronounced ripple turns to mush and the
 * shape stops being recognisable. The pole is a neutral tone rather than the
 * flag colour, so the coloured area stays the thing the eye lands on.
 *
 * No hooks and no client directive — this renders inside Server Components
 * (the candidates grid legend, the transparency table, how-it-works) as well as
 * client ones.
 */
export function FlagIcon({
  color,
  className,
  title,
}: {
  color: FlagColor
  className?: string
  /**
   * Only pass this where the icon is the sole carrier of meaning. Everywhere in
   * this codebase a text label sits beside it, so the default is decorative and
   * a screen reader is spared reading the colour twice.
   */
  title?: string
}) {
  const meta = FLAG_META[color]

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}

      {/*
        Pole. `strokeOpacity` rather than an `rgb(r g b / a)` fill: slash-alpha
        is CSS Color 4 and is not honoured by every SVG rasteriser, so the pole
        silently vanished and left a floating rectangle.
      */}
      <path
        d="M3.2 1.6v12.8"
        stroke="#F7F5F0"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/*
        Banner. Sized to fill most of the viewBox — an earlier version occupied
        only the top-left third and collapsed into an unreadable speck at the
        10–12px these actually render at.
      */}
      <path d="M4 2.2c3-1.4 6 1.4 9 0v6.6c-3 1.4-6-1.4-9 0z" fill={meta.hex} />
    </svg>
  )
}

/**
 * The full set, in severity order, for legends.
 *
 * Exported so a legend cannot drift out of order or omit a colour — the ramp
 * runs green to black and its ordering is what carries meaning for readers who
 * cannot separate the hues.
 */
export const FLAG_LEGEND = (['GREEN', 'ORANGE', 'RED', 'BLACK'] as const).map((color) => ({
  color,
  label: FLAG_META[color].label,
  description: FLAG_META[color].description,
}))
