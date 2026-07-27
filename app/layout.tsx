import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { getSession } from '@/backend/services/session.service'
import { Navbar } from '@/frontend/components/layout/navbar'
import { Footer } from '@/frontend/components/layout/footer'
import './globals.css'

/**
 * A high-contrast display serif against a clean geometric sans — big, confident
 * type that holds its own against the depth and motion behind it. Both load as
 * variable fonts with `display: swap`, so text paints immediately on a slow
 * connection instead of leaving the hero blank.
 */
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Jua Kiongozi ’27 — Your Voice. Verified. Transparent.',
    template: '%s · Jua Kiongozi ’27',
  },
  description:
    'An independent civic platform where Kenyans rate declared 2027 presidential candidates. One verified voice per citizen, with every aggregate result published openly. Not affiliated with the IEBC.',
  keywords: ['Kenya', '2027 election', 'civic engagement', 'public sentiment', 'transparency'],
  openGraph: {
    title: 'Jua Kiongozi ’27 — Your Voice. Verified. Transparent.',
    description:
      'Rate Kenya’s declared 2027 presidential candidates. One verified voice per citizen, results published openly.',
    type: 'website',
    locale: 'en_KE',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0A0E1A',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once here so the navbar renders the right auth state on the server and
  // never flashes "Sign in" at an already-registered citizen.
  const session = await getSession()

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">
        <div className="ambient-mesh" aria-hidden />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink-900"
        >
          Skip to main content
        </a>

        <div className="flex min-h-screen flex-col">
          <Navbar signedIn={Boolean(session)} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
