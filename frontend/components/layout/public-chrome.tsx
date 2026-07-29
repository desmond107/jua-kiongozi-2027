'use client'

import { usePathname } from 'next/navigation'

/**
 * Renders the public navbar and footer everywhere except the operator console.
 *
 * The console has its own header and navigation, and the site footer would
 * otherwise appear inside it — including the admin entry dot, which would then
 * sit at the bottom of the very page it exists to reach.
 *
 * WHY NOT A SEPARATE ROOT LAYOUT
 * ──────────────────────────────
 * Next supports multiple root layouts, but only if every top-level route moves
 * into a route group and each group re-declares <html>, <body>, the fonts and
 * the global stylesheet. That is a large move across every existing page to
 * solve a small problem, and duplicated document setup drifts.
 *
 * `usePathname` is safe here rather than a hydration risk: this subtree is
 * dynamically rendered — the root layout reads the session cookie — so the
 * server knows the real pathname and both passes agree.
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) return null

  return <>{children}</>
}
