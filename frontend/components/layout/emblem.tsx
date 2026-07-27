import { cn } from '@/frontend/lib/utils'

/**
 * The platform mark: a shield built from the three flag accents around a
 * central check.
 *
 * Deliberately abstract — it must not resemble the Kenyan Coat of Arms or any
 * IEBC insignia, since the platform is explicitly unaffiliated with both.
 */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Jua Kiongozi ’27 emblem"
    >
      <defs>
        <linearGradient id="emblem-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1EB854" />
          <stop offset="55%" stopColor="#F5B942" />
          <stop offset="100%" stopColor="#E23D3D" />
        </linearGradient>
      </defs>

      <path
        d="M20 2.5 6 8.2v11.4c0 8.4 5.7 15.4 14 18 8.3-2.6 14-9.6 14-18V8.2L20 2.5Z"
        fill="url(#emblem-shield)"
        fillOpacity="0.18"
        stroke="url(#emblem-shield)"
        strokeWidth="1.6"
      />
      <path
        d="m13.6 20.2 4.6 4.6 8.2-9"
        stroke="#F7F5F0"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
