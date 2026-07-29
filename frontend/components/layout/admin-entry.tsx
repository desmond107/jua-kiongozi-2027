'use client'

import { useRouter } from 'next/navigation'

/**
 * The unobtrusive operator entry point, at the left of the footer's bottom row.
 *
 * WHAT THIS IS AND IS NOT
 * ───────────────────────
 * It is a discreet way in for someone who knows it is there. It is NOT a
 * security control, and nothing about the console's protection depends on it
 * being hard to find: /admin/login is a normal URL, this component's markup is
 * in the page source, and the route would be reachable typed by hand even if
 * this control did not exist.
 *
 * What actually protects the console is the session check in
 * `(console)/layout.tsx`, the independent check on every admin API route, the
 * bcrypt password, and the rate limits on the login endpoint. Treat this dot as
 * a convenience, never as a lock.
 *
 * A radio input rather than a link, per the requested design. It is
 * `aria-label`led and keyboard-reachable — hiding it from assistive technology
 * would only inconvenience an operator who uses a screen reader, since it buys
 * no secrecy against anyone reading the HTML.
 */
export function AdminEntry() {
  const router = useRouter()

  return (
    <span className="group relative inline-flex items-center">
      <input
        type="radio"
        name="admin-entry"
        aria-label="Administrator sign-in"
        title="Administrator sign-in"
        // Radios cannot be unchecked by clicking, so the checked state is never
        // committed — it is reset immediately and navigation is what actually
        // happens. Without this, coming back from /admin/login would find the
        // dot stuck on.
        checked={false}
        onChange={() => router.push('/admin/login')}
        className="h-2.5 w-2.5 cursor-pointer appearance-none rounded-full border border-white/20 bg-white/[0.06] transition-all duration-200 hover:border-gold/60 hover:bg-gold/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/70"
      />
      <span className="pointer-events-none absolute left-5 whitespace-nowrap text-[10px] uppercase tracking-[0.14em] text-bone-dim opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        Admin
      </span>
    </span>
  )
}
