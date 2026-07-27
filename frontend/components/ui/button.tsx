'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/frontend/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary CTA: the gold accent, used sparingly — usually once per view.
        primary:
          'bg-gradient-to-br from-gold-soft to-gold text-ink-900 shadow-glow-gold hover:brightness-110 active:scale-[0.98]',
        verdant:
          'bg-gradient-to-br from-verdant-soft to-verdant text-ink-900 shadow-glow-verdant hover:brightness-110 active:scale-[0.98]',
        glass:
          'border border-white/15 bg-white/[0.06] text-bone backdrop-blur-xl hover:border-white/30 hover:bg-white/[0.1] active:scale-[0.98]',
        ghost: 'text-bone-muted hover:bg-white/[0.06] hover:text-bone',
        danger: 'bg-flame/90 text-bone hover:bg-flame active:scale-[0.98]',
        link: 'text-gold underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-sm',
        lg: 'h-14 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'glass', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        // Announces the pending state to screen readers, which a spinner alone
        // does not.
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Please wait…</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)

Button.displayName = 'Button'
export { buttonVariants }
