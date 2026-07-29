'use client'

import { FLAG_COLOR_ORDER, FLAG_META, FLAG_QUESTION, type FlagColor } from '@/backend/validators'
import { FlagIcon } from '@/frontend/components/ui/flag-icon'
import { cn } from '@/frontend/lib/utils'

/**
 * Trust-flag selector.
 *
 * Implemented as a native radiogroup (`role="radiogroup"` + roving
 * `aria-checked`) so arrow keys work and the current choice is announced. Each
 * option states its meaning in text next to the swatch — the colour is never
 * the only carrier of meaning.
 */
export function FlagWidget({
  value,
  onChange,
  disabled = false,
}: {
  value: FlagColor | null
  onChange: (color: FlagColor) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="text-sm font-medium text-bone">{FLAG_QUESTION}</legend>

      <div role="radiogroup" aria-label={FLAG_QUESTION} className="grid gap-2.5 sm:grid-cols-2">
        {FLAG_COLOR_ORDER.map((color) => {
          const meta = FLAG_META[color]
          const selected = value === color

          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(color)}
              disabled={disabled}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200',
                selected
                  ? 'border-white/35 bg-white/[0.09]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              style={
                selected
                  ? { boxShadow: `0 0 0 1px ${meta.hex}66, 0 0 30px -10px ${meta.hex}` }
                  : undefined
              }
            >
              <FlagIcon color={color} className="mt-0.5 h-5 w-5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-bone">{meta.label} flag</span>
                <span className="block text-xs leading-relaxed text-bone-dim">
                  {meta.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
