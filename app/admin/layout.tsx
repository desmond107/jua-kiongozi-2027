import type { Metadata } from 'next'

/**
 * Applies to everything under /admin, INCLUDING the login page.
 *
 * There is no session check here, and that is deliberate: the login page is a
 * child of this layout, so guarding at this level would redirect an
 * unauthenticated visitor to a page that immediately redirects them again. The
 * guard lives one level down, in `(console)/layout.tsx`, which wraps every
 * authenticated page and nothing else.
 *
 * What this layout is for is the noindex directive, which must cover the login
 * page too — an indexed admin login is the usual way an unadvertised URL stops
 * being unadvertised.
 */

export const metadata: Metadata = {
  title: 'Console',
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
