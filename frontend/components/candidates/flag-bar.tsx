import { FLAG_COLOR_ORDER, FLAG_META, type FlagColor } from '@/backend/validators'
import type { FlagBreakdown } from '@/backend/validators'
import { cn } from '@/frontend/lib/utils'

/**
 * The compact flag-distribution indicator shown on each candidate card.
 *
 * Segment width alone would encode the data in colour + size only, which fails
 * for colour-blind users, so the accessible name on each segment spells out the
 * colour, its meaning and its exact share.
 */
export function FlagBar({
  flags,
  total,
  className,
  showLegend = false,
}: {
  flags: FlagBreakdown
  total: number
  className?: string
  showLegend?: boolean
}) {
  if (total === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-2 w-full rounded-full bg-white/[0.07]" aria-hidden />
        <p className="text-xs text-bone-dim">No trust flags recorded yet</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
        role="img"
        aria-label={FLAG_COLOR_ORDER.map(
          (color) =>
            `${FLAG_META[color].label}: ${Math.round((flags[color] / total) * 100)} percent`,
        ).join(', ')}
      >
        {FLAG_COLOR_ORDER.map((color) => {
          const share = (flags[color] / total) * 100
          if (share === 0) return null

          return (
            <span
              key={color}
              className="h-full transition-all duration-500"
              style={{ width: `${share}%`, backgroundColor: FLAG_META[color].hex }}
            />
          )
        })}
      </div>

      {showLegend ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {FLAG_COLOR_ORDER.map((color) => (
            <li key={color} className="flex items-center gap-1.5 text-xs text-bone-dim">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: FLAG_META[color].hex }}
                aria-hidden
              />
              {FLAG_META[color].label} {flags[color]}
            </li>
          ))}
        </ul>
      ) : (
        /*
         * Without this the bar is colour and nothing else: a reader has to map
         * each band back to a legend elsewhere on the page to learn anything.
         * The two ends carry the meaning — trust and rejection — so those get
         * their share printed, which makes the bar scannable on its own.
         */
        <p className="flex items-center justify-between text-[11px] text-bone-dim">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: FLAG_META.GREEN.hex }}
              aria-hidden
            />
            {Math.round((flags.GREEN / total) * 100)}% trust
          </span>
          <span className="flex items-center gap-1.5">
            {Math.round(((flags.RED + flags.BLACK) / total) * 100)}% concern
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: FLAG_META.RED.hex }}
              aria-hidden
            />
          </span>
        </p>
      )}
    </div>
  )
}

export function FlagDot({ color, className }: { color: FlagColor; className?: string }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full', className)}
      style={{ backgroundColor: FLAG_META[color].hex }}
      aria-hidden
    />
  )
}
