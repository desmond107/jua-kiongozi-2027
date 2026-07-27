import Link from 'next/link'
import { Emblem } from './emblem'
import { DATA_DISCLAIMER, IEBC_DISCLAIMER, TOKEN_DISCLAIMER } from './disclaimers'

const COLUMNS = [
  {
    heading: 'Participate',
    links: [
      { href: '/register', label: 'Register' },
      { href: '/login', label: 'Sign in' },
      { href: '/candidates', label: 'Candidates' },
    ],
  },
  {
    heading: 'Transparency',
    links: [
      { href: '/transparency', label: 'Live results' },
      { href: '/api/analytics?format=csv', label: 'Download data (CSV)' },
      { href: '/how-it-works', label: 'How it works' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/about', label: 'About' },
      { href: '/privacy-policy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of use' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/10 bg-ink-900/60">
      {/* Flag stripe: the one place the three accents appear as flat colour. */}
      <div className="h-1 w-full bg-flag-stripe opacity-70" aria-hidden />

      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <Emblem className="h-9 w-9" />
              <span className="font-display text-lg font-semibold text-bone">
                Jua Kiongozi <span className="text-gold">’27</span>
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-bone-dim">
              An independent civic platform for measuring public sentiment ahead of Kenya’s 2027
              presidential election.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-bone">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded text-sm text-bone-dim transition-colors hover:text-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="hairline my-10" />

        {/* The three required notices, persistent on every page of the site. */}
        <div className="space-y-4 text-xs leading-relaxed text-bone-dim">
          <p className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-4 text-bone-muted">
            <strong className="font-semibold text-bone">Important:</strong> {IEBC_DISCLAIMER}
          </p>
          <p>{DATA_DISCLAIMER}</p>
          <p>{TOKEN_DISCLAIMER}</p>
        </div>

        <p className="mt-8 text-xs text-bone-dim">
          © {new Date().getFullYear()} Jua Kiongozi ’27. Aggregate results are published openly for
          public audit.
        </p>
      </div>
    </footer>
  )
}
