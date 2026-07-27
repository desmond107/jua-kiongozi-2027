import { Info, Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/frontend/lib/utils'

/**
 * The platform's required legal and trust notices.
 *
 * Defined once, in one file, and reused verbatim in the footer, the About page
 * and the registration screen. Keeping the exact wording in a single module is
 * deliberate: these are legal statements, and paraphrased copies drifting
 * across pages is precisely the failure to avoid.
 */

export const IEBC_DISCLAIMER =
  'Jua Kiongozi ’27 is an independent civic-engagement platform and is not affiliated with, endorsed by, or a substitute for the Independent Electoral and Boundaries Commission (IEBC) or any official Kenyan electoral process. Results published here are public sentiment only and carry no electoral or legal weight.'

export const DATA_DISCLAIMER =
  'National ID numbers are collected solely to prevent duplicate participation. They are hashed at rest, never stored in readable form, and are never sold, shared, or displayed publicly.'

export const TOKEN_DISCLAIMER =
  'Treat your Voter Card token as confidential, in the same way you would treat a password. Anyone holding it can cast ratings in your name. It is shown once and cannot be recovered or reissued.'

/** Full-width banner. Used at the top of the registration flow. */
export function DisclaimerBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/[0.07] p-4',
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
      <p className="text-sm leading-relaxed text-bone-muted">
        <strong className="font-semibold text-bone">This is not an official IEBC platform.</strong>{' '}
        {IEBC_DISCLAIMER.split('. ').slice(1).join('. ')}
      </p>
    </div>
  )
}

/** The three trust notices as a stacked list. Used on registration and About. */
export function TrustNotices({ className }: { className?: string }) {
  const notices = [
    { icon: ShieldAlert, title: 'Not an official election', body: IEBC_DISCLAIMER },
    { icon: Lock, title: 'How your ID is handled', body: DATA_DISCLAIMER },
    { icon: Info, title: 'Keep your token private', body: TOKEN_DISCLAIMER },
  ]

  return (
    <ul className={cn('space-y-4', className)}>
      {notices.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-bone">{title}</p>
            <p className="text-sm leading-relaxed text-bone-dim">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
