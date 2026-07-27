'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import QRCode from 'qrcode'
import { Check, Copy, Download, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { Button } from '@/frontend/components/ui/button'
import { Emblem } from '@/frontend/components/layout/emblem'
import { useTilt } from '@/frontend/hooks/useTilt'
import { formatDate, groupToken } from '@/frontend/lib/format'
import { cn } from '@/frontend/lib/utils'

/**
 * The Voter Card — a tilting, glassmorphic credential shown exactly once.
 *
 * SECURITY NOTES
 * ──────────────
 *  - The raw token lives in this component's props for the life of one page
 *    view. It is never written to localStorage, sessionStorage, a cookie or the
 *    URL, and the server cannot reissue it.
 *  - The token is masked by default. Revealing it is a deliberate act, which
 *    matters when registering on a shared or public machine.
 *  - The QR code encodes the *public serial and verify URL only* — never the
 *    token. A photographed card therefore does not leak voting authority.
 */

export type VoterCardData = {
  name: string
  serial: string
  phoneMasked: string
  idMasked: string
  county: string | null
  issuedAt: string
}

export function VoterCardDisplay({
  data,
  rawToken,
}: {
  data: VoterCardData
  /** Present only on the one render immediately after registration. */
  rawToken?: string
}) {
  const { enabled, handlers, style, glareStyle } = useTilt({ max: 10 })
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    const verifyUrl = `${window.location.origin}/login?ref=${encodeURIComponent(data.serial)}`

    QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#0A0E1A', light: '#F7F5F0' },
      errorCorrectionLevel: 'M',
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [data.serial])

  const displayToken = rawToken ? groupToken(rawToken) : null

  const copyToken = useCallback(async () => {
    if (!rawToken) return

    try {
      await navigator.clipboard.writeText(groupToken(rawToken))
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard is unavailable over plain HTTP and in some in-app browsers.
      // Revealing the token lets the user copy it by hand instead of leaving
      // them with a button that silently does nothing.
      setRevealed(true)
    }
  }, [rawToken])

  const download = useCallback(() => {
    if (!rawToken) return

    const contents = [
      'JUA KIONGOZI ’27 — VOTER CARD',
      '='.repeat(46),
      '',
      `Name:          ${data.name}`,
      `Card serial:   ${data.serial}`,
      `Phone:         ${data.phoneMasked}`,
      `National ID:   ${data.idMasked}`,
      `County:        ${data.county ?? 'Not provided'}`,
      `Issued:        ${formatDate(data.issuedAt)}`,
      '',
      'VOTING TOKEN (keep this secret):',
      groupToken(rawToken),
      '',
      '-'.repeat(46),
      'Treat this token like a password. Anyone holding it can cast',
      'ratings in your name. It is shown once and cannot be reissued.',
      '',
      'Jua Kiongozi ’27 is an independent civic-engagement platform.',
      'It is not affiliated with, endorsed by, or a substitute for the',
      'Independent Electoral and Boundaries Commission (IEBC).',
      '',
    ].join('\n')

    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `jua-kiongozi-27-voter-card-${data.serial}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }, [data, rawToken])

  return (
    <div className="space-y-5">
      <div className={cn(enabled && 'perspective-1000')}>
        <motion.div
          style={style}
          {...handlers}
          initial={{ opacity: 0, y: 24, rotateX: -8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-[1.62/1] w-full overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-ink-600/90 via-ink-700/90 to-ink-900/95 p-6 shadow-lift backdrop-blur-2xl sm:p-7"
        >
          {/* Moving sheen — the "premium card" cue. */}
          {glareStyle ? (
            <motion.span
              className="pointer-events-none absolute inset-0 z-10"
              style={glareStyle}
              aria-hidden
            />
          ) : null}
          <span className="pointer-events-none absolute inset-0 bg-sheen opacity-40" aria-hidden />
          <span
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-verdant/20 blur-3xl"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-gold/15 blur-3xl"
            aria-hidden
          />

          <div className="relative z-20 flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Emblem className="h-8 w-8" />
                <div>
                  <p className="font-display text-sm font-semibold leading-tight text-bone">
                    Jua Kiongozi <span className="text-gold">’27</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-bone-dim">
                    Voter Card
                  </p>
                </div>
              </div>

              {qr ? (
                <img
                  src={qr}
                  alt={`QR code linking to the sign-in page for card ${data.serial}`}
                  className="h-16 w-16 rounded-lg border border-white/20 sm:h-[72px] sm:w-[72px]"
                />
              ) : (
                <div className="skeleton h-16 w-16 rounded-lg sm:h-[72px] sm:w-[72px]" />
              )}
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-bone-dim">Holder</p>
                <p className="font-display text-xl font-semibold leading-tight text-bone sm:text-2xl">
                  {data.name}
                </p>
              </div>

              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-bone-dim">Serial</dt>
                  <dd className="font-mono text-bone-muted">{data.serial}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-bone-dim">
                    National ID
                  </dt>
                  <dd className="font-mono text-bone-muted">{data.idMasked}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-bone-dim">Issued</dt>
                  <dd className="text-bone-muted">{formatDate(data.issuedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </motion.div>
      </div>

      {displayToken ? (
        <div className="glass space-y-4 border-gold/25 p-5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-bone">
                Save this token now — it is shown only once
              </p>
              <p className="text-xs leading-relaxed text-bone-dim">
                We store only a cryptographic hash of it, so we cannot show it to you again or
                issue a replacement. Keep it as private as a password.
              </p>
            </div>
          </div>

          <div className="relative">
            <p
              className={cn(
                'break-all rounded-2xl border border-white/12 bg-ink-900/70 p-4 pr-12 font-mono text-sm leading-relaxed tracking-wider text-bone',
                !revealed && 'select-none blur-sm',
              )}
              aria-live="polite"
            >
              {displayToken}
            </p>
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              aria-label={revealed ? 'Hide token' : 'Reveal token'}
              className="absolute right-3 top-3 rounded-lg p-2 text-bone-dim transition-colors hover:text-bone"
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button variant="primary" size="sm" onClick={download}>
              <Download className="h-4 w-4" />
              Download card
            </Button>
            <Button variant="glass" size="sm" onClick={copyToken}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy token'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
