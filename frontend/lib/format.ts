/**
 * Display formatting helpers. Pure functions, safe on both server and client.
 *
 * WHY EVERY DATE FORMATTER PINS A TIME ZONE
 * ─────────────────────────────────────────
 * These run during SSR *and* again during hydration. `Intl.DateTimeFormat`
 * defaults to the host's zone, which is the server's on one pass and the
 * browser's on the other — a production server on UTC and a citizen in Nairobi
 * (UTC+3) disagree about which calendar day a late-evening timestamp falls on,
 * so the two passes emit different text and React throws a hydration error.
 *
 * Pinning the zone makes the output a pure function of the ISO string. Nairobi
 * is also the correct zone to display in: this is a Kenyan platform, and a
 * registration timestamp means the day it happened in Kenya.
 */

const TIME_ZONE = 'Africa/Nairobi'

const numberFormatter = new Intl.NumberFormat('en-KE')

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/** "42.5%" — analytics rates arrive pre-rounded to one decimal place. */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

/** Initials for the candidate photo placeholder, e.g. "Martha Karua" → "MK". */
export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Re-groups a voting token into blocks of four for display.
 * The server already hyphenates, but a token pasted from a password manager
 * may arrive stripped.
 */
export function groupToken(token: string): string {
  const clean = token.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return (clean.match(/.{1,4}/g) ?? []).join('-')
}

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
  ]

  let value = seconds
  for (const [amount, unit] of divisions) {
    if (Math.abs(value) < amount) return formatter.format(-value, unit)
    value = Math.round(value / amount)
  }

  return formatter.format(-value, 'week')
}
