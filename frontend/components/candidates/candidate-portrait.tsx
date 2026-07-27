import Image from 'next/image'
import { initials } from '@/frontend/lib/format'
import { cn } from '@/frontend/lib/utils'

/**
 * Candidate headshot, with a designed monogram fallback.
 *
 * Most candidates ship with `photoUrl: null` — a photograph is only bundled
 * where the project holds a licence for that likeness. The monogram is
 * therefore an *expected* state rather than an error state, and is styled to
 * look deliberate.
 *
 * To add real photography: place the file in `/public/candidates/` and set the
 * candidate's `photoUrl` (see README → "Adding candidate photographs").
 */
export function CandidatePortrait({
  fullName,
  photoUrl,
  className,
  sizes = '(max-width: 768px) 100vw, 33vw',
  priority = false,
}: {
  fullName: string
  photoUrl: string | null
  className?: string
  sizes?: string
  priority?: boolean
}) {
  if (photoUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-ink-700', className)}>
        <Image
          src={photoUrl}
          alt={`Portrait of ${fullName}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-ink-600 via-ink-700 to-ink-900',
        className,
      )}
      // The monogram is decorative; the candidate's name is always rendered as
      // real text next to it, so announcing initials again would be noise.
      role="img"
      aria-label={`No photograph available for ${fullName}`}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(60% 60% at 30% 25%, rgb(30 184 84 / 0.28) 0%, transparent 70%), radial-gradient(50% 50% at 75% 80%, rgb(245 185 66 / 0.22) 0%, transparent 70%)',
        }}
        aria-hidden
      />
      <span
        className="relative font-display text-5xl font-semibold tracking-tight text-bone/25"
        aria-hidden
      >
        {initials(fullName)}
      </span>
    </div>
  )
}
