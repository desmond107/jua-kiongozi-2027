'use client'

import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/frontend/lib/utils'

/**
 * Form field primitives.
 *
 * Accessibility notes, since these carry most of the form's a11y weight:
 *  - every control is wired to its label via a generated id
 *  - error text is linked with `aria-describedby` and announced via role=alert
 *  - `aria-invalid` marks the control itself, not just the surrounding markup
 */

type FieldContextValue = { id: string; errorId: string; hintId: string; invalid: boolean }
const FieldContext = React.createContext<FieldContextValue | null>(null)

function useField() {
  const context = React.useContext(FieldContext)
  if (!context) throw new Error('Field subcomponents must be used inside <Field>')
  return context
}

export function Field({
  children,
  error,
  className,
}: {
  children: React.ReactNode
  error?: string
  className?: string
}) {
  const id = React.useId()

  const value = React.useMemo(
    () => ({ id, errorId: `${id}-error`, hintId: `${id}-hint`, invalid: Boolean(error) }),
    [id, error],
  )

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('space-y-2', className)}>
        {children}
        {error ? (
          <p
            id={value.errorId}
            role="alert"
            className="flex items-start gap-1.5 text-sm text-flame-soft"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

export function FieldLabel({
  children,
  optional,
  className,
}: {
  children: React.ReactNode
  optional?: boolean
  className?: string
}) {
  const { id } = useField()

  return (
    <label htmlFor={id} className={cn('block text-sm font-medium text-bone', className)}>
      {children}
      {optional ? <span className="ml-1.5 text-xs text-bone-dim">(optional)</span> : null}
    </label>
  )
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  const { hintId } = useField()
  return (
    <p id={hintId} className="text-xs leading-relaxed text-bone-dim">
      {children}
    </p>
  )
}

const controlClasses =
  'w-full rounded-2xl border border-white/12 bg-ink-900/60 px-4 py-3 text-bone placeholder:text-bone-dim/60 transition-colors focus:border-gold/50 disabled:opacity-50'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const { id, errorId, hintId, invalid } = useField()

  return (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={cn(invalid && errorId, hintId) || undefined}
      className={cn(controlClasses, invalid && 'border-flame/60', className)}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const { id, errorId, hintId, invalid } = useField()

  return (
    <select
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={cn(invalid && errorId, hintId) || undefined}
      className={cn(controlClasses, 'appearance-none pr-10', invalid && 'border-flame/60', className)}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = 'Select'

/** Checkbox with its label as the click target. Used for the consent gates. */
export function Checkbox({
  label,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; error?: string }) {
  const id = React.useId()
  const errorId = `${id}-error`

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border border-white/20 bg-ink-900/60 accent-gold',
            error && 'border-flame/60',
          )}
          {...props}
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-bone-muted">
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-flame-soft">
          {error}
        </p>
      ) : null}
    </div>
  )
}
