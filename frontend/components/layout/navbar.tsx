'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { cn } from '@/frontend/lib/utils'
import { Emblem } from './emblem'

const LINKS = [
  { href: '/candidates', label: 'Candidates' },
  { href: '/transparency', label: 'Live Results' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/about', label: 'About' },
]

export function Navbar({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on navigation, otherwise it stays open over the new page.
  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/10 bg-ink-900/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl"
          aria-label="Jua Kiongozi 2027 — home"
        >
          <Emblem className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight text-bone">
            Jua Kiongozi <span className="text-gold">2027</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-full px-4 py-2 text-sm transition-colors',
                  active ? 'text-bone' : 'text-bone-dim hover:text-bone',
                )}
              >
                {link.href === pathname || active ? (
                  // Shared layoutId slides the pill between links instead of
                  // cross-fading two separate elements.
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{link.label}</span>
              </Link>
            )
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {signedIn ? (
            <Button asChild variant="glass" size="sm">
              <Link href="/voter-card">My Voter Card</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/register">Get your token</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-xl p-2 text-bone md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-white/10 bg-ink-900/95 backdrop-blur-xl md:hidden"
          >
            <div className="space-y-1 px-5 pb-6 pt-2">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-4 py-3 text-sm text-bone-muted hover:bg-white/[0.06] hover:text-bone"
                >
                  {link.label}
                </Link>
              ))}

              <div className="flex flex-col gap-2 pt-3">
                {signedIn ? (
                  <Button asChild variant="glass">
                    <Link href="/voter-card">My Voter Card</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="glass">
                      <Link href="/login">Sign in</Link>
                    </Button>
                    <Button asChild variant="primary">
                      <Link href="/register">Get your token</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
