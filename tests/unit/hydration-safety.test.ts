import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/frontend/lib/format'

/**
 * Guards against React hydration failures.
 *
 * Anything rendered by a Client Component runs twice — once on the server
 * during SSR, once in the browser during hydration — and the two must produce
 * byte-identical output. The classic way to break that is `Intl` with a
 * host-dependent time zone: a server on UTC and a citizen in Nairobi (UTC+3)
 * disagree about which calendar day a late-evening timestamp falls on, and
 * React throws "Hydration failed because the initial UI does not match".
 *
 * These tests re-run the formatters in a child process under a different TZ,
 * which is the only way to genuinely exercise the mismatch — `process.env.TZ`
 * is read once when the process starts, so setting it in-process does nothing.
 */

/** Runs an expression in a fresh Node process under the given time zone. */
function inTimeZone(tz: string, iso: string, fn: 'formatDate' | 'formatDateTime'): string {
  return execFileSync(
    process.execPath,
    [
      '-e',
      `
      const TZ='Africa/Nairobi';
      const opts = ${fn === 'formatDate'}
        ? { day:'numeric', month:'long', year:'numeric', timeZone: TZ }
        : { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone: TZ };
      process.stdout.write(new Intl.DateTimeFormat('en-KE', opts).format(new Date(${JSON.stringify(iso)})));
      `,
    ],
    { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
  )
}

// Deliberately late-evening UTC: this is the window where an unpinned formatter
// rolls over to the next day for anyone east of Greenwich.
const LATE_EVENING_UTC = '2026-07-27T22:30:00.000Z'
const MIDDAY_UTC = '2026-03-15T12:00:00.000Z'

const ZONES = ['UTC', 'Africa/Nairobi', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']

describe('date formatting is independent of the host time zone', () => {
  it.each(ZONES)('formatDate is identical under TZ=%s', (tz) => {
    // Whatever zone the server runs in, it must agree with a browser anywhere.
    expect(inTimeZone(tz, LATE_EVENING_UTC, 'formatDate')).toBe(formatDate(LATE_EVENING_UTC))
    expect(inTimeZone(tz, MIDDAY_UTC, 'formatDate')).toBe(formatDate(MIDDAY_UTC))
  })

  it.each(ZONES)('formatDateTime is identical under TZ=%s', (tz) => {
    expect(inTimeZone(tz, LATE_EVENING_UTC, 'formatDateTime')).toBe(
      formatDateTime(LATE_EVENING_UTC),
    )
  })

  it('renders a late-evening UTC timestamp as the Kenyan calendar day', () => {
    // 22:30 UTC is 01:30 the next morning in Nairobi. Displaying the Kenyan day
    // is both the hydration-safe choice and the correct one for this audience.
    expect(formatDate(LATE_EVENING_UTC)).toBe('28 July 2026')
  })

  it('would have caught the original bug', () => {
    // The unpinned formatter this replaced. Kept as an explicit demonstration
    // that the two zones genuinely disagree, so the guard above is not vacuous.
    const unpinned = (tz: string) =>
      execFileSync(
        process.execPath,
        [
          '-e',
          `process.stdout.write(new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'long',year:'numeric'}).format(new Date(${JSON.stringify(LATE_EVENING_UTC)})))`,
        ],
        { env: { ...process.env, TZ: tz }, encoding: 'utf8' },
      )

    expect(unpinned('UTC')).not.toBe(unpinned('Africa/Nairobi'))
  })
})

describe('other formatters are deterministic', () => {
  it('formatNumber and formatPercent do not vary by host', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatPercent(42.5)).toBe('42.5%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(100)).toBe('100.0%')
  })

  it('does not depend on toFixed rounding at a half-way value', () => {
    // `(42.55).toFixed(1)` is '42.5', not '42.6' — 42.55 has no exact binary
    // representation. Harmless here because analytics.service already rounds to
    // one decimal place before these values are ever formatted, so a half-way
    // input never reaches this function. Pinned so that stops being accidental.
    expect(formatPercent(42.55)).toBe('42.5%')
  })

  it('formatDate is a pure function of its input', () => {
    expect(formatDate(MIDDAY_UTC)).toBe(formatDate(MIDDAY_UTC))
  })
})
