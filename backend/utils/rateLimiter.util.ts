import 'server-only'
import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/backend/db/client'

/**
 * Database-backed fixed-window rate limiting.
 *
 * Deliberately NOT an in-memory Map: the deployment target is serverless, where
 * process memory dies on every cold start and requests fan out across many
 * instances. An in-memory counter would be both unreliable and trivially
 * bypassed by an attacker who simply keeps opening new connections.
 */

export type RateLimitRule = {
  /** Maximum requests permitted inside one window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  retryAfter: number
}

/**
 * Production limits are tuned for citizens: a real person registers once and
 * asks for maybe two codes. A developer exercising the same flow burns through
 * that in minutes, and then cannot test at all for an hour — which is the
 * failure that prompted this change.
 *
 * The multiplier applies ONLY outside production, and only to the ceilings.
 * Every rule, key and window stays identical, so what is exercised in
 * development is the same code path that runs in production.
 */
const RELAX = process.env.NODE_ENV === 'production' ? 1 : 20

export const RATE_LIMITS = {
  /**
   * Verification codes cost real money to send, so this bucket protects the SMS
   * bill as much as the platform. Per-phone is the tighter of the two because
   * an attacker rotating numbers is the expensive case.
   */
  otpByIp: { limit: 10 * RELAX, windowSeconds: 60 * 60 },
  otpByPhone: { limit: 5 * RELAX, windowSeconds: 60 * 60 },
  /** Registration is the most abuse-prone endpoint: 5 attempts per IP per hour. */
  registerByIp: { limit: 5 * RELAX, windowSeconds: 60 * 60 },
  /** One phone number should only ever need a single successful registration. */
  registerByPhone: { limit: 3 * RELAX, windowSeconds: 60 * 60 * 24 },
  /** Login: 10 attempts per IP per 15 minutes. */
  loginByIp: { limit: 10 * RELAX, windowSeconds: 60 * 15 },
  loginByPhone: { limit: 8 * RELAX, windowSeconds: 60 * 15 },
  /**
   * Retrieving your own token. Tight on purpose: a legitimate citizen does this
   * rarely, and each attempt is a chance to brute-force a code against a session
   * that may not belong to the person holding it.
   */
  revealByIp: { limit: 10 * RELAX, windowSeconds: 60 * 60 },
  revealByUser: { limit: 5 * RELAX, windowSeconds: 60 * 60 },
  /** Voting: 7 candidates exist, so 30/hour leaves ample room for revisions. */
  voteByIp: { limit: 30 * RELAX, windowSeconds: 60 * 60 },
  voteByUser: { limit: 20 * RELAX, windowSeconds: 60 * 60 },
  /**
   * Operator sign-in. Far tighter than citizen sign-in, because the two are not
   * comparable prizes: guessing a citizen's token exposes one ballot, guessing
   * an operator's password exposes the registrant list for the whole platform.
   *
   * Keyed by username as well as IP so that distributing an attack across
   * addresses — the standard way around an IP-only limit — still runs into a
   * ceiling on the account being attacked.
   */
  adminLoginByIp: { limit: 5 * RELAX, windowSeconds: 60 * 15 },
  adminLoginByUsername: { limit: 10 * RELAX, windowSeconds: 60 * 15 },
} as const satisfies Record<string, RateLimitRule>

/**
 * Consumes one unit from a bucket and reports whether the caller may proceed.
 *
 * WHY ONE STATEMENT
 * ─────────────────
 * Read-then-check-then-increment across three round trips is a race: concurrent
 * requests all read the same count, all see room, and all proceed. The limit
 * then caps concurrency rather than volume, which is precisely the property an
 * attacker defeats by firing in parallel. The upsert below does the window
 * reset, the increment and the read in a single atomic statement, so the
 * returned `hits` is that caller's true position in the window.
 *
 * WHY IT FAILS CLOSED
 * ───────────────────
 * The limiter shares a database with every operation it guards. If Postgres is
 * unreachable, registration and voting are already failing — so failing open
 * would not keep anything working, it would only remove the brake at the moment
 * the system is least able to absorb abuse.
 */
export async function consumeRateLimit(
  bucketKey: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const windowStartedAfter = new Date(Date.now() - rule.windowSeconds * 1000)

  try {
    const rows = await prisma.$queryRaw<Array<{ hits: number; windowStart: Date }>>`
      INSERT INTO rate_limits (id, "bucketKey", hits, "windowStart")
      VALUES (${randomUUID()}, ${bucketKey}, 1, now())
      ON CONFLICT ("bucketKey") DO UPDATE SET
        hits = CASE
          WHEN rate_limits."windowStart" < ${windowStartedAfter} THEN 1
          ELSE rate_limits.hits + 1
        END,
        "windowStart" = CASE
          WHEN rate_limits."windowStart" < ${windowStartedAfter} THEN now()
          ELSE rate_limits."windowStart"
        END
      RETURNING hits, "windowStart"
    `

    const row = rows[0]
    if (!row) throw new Error('rate limit upsert returned no row')

    const elapsed = Math.floor((Date.now() - row.windowStart.getTime()) / 1000)

    return {
      allowed: row.hits <= rule.limit,
      remaining: Math.max(0, rule.limit - row.hits),
      retryAfter: Math.max(1, rule.windowSeconds - elapsed),
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('[rateLimiter] bucket check failed, failing closed:', error.code)
    } else {
      console.error('[rateLimiter] bucket check failed, failing closed:', error)
    }

    return { allowed: false, remaining: 0, retryAfter: rule.windowSeconds }
  }
}

/**
 * Whether this process can actually tell one client from another.
 *
 * When it cannot, IP-keyed limiting is not merely weak — it is actively
 * harmful, because every visitor lands in ONE bucket and the first ten of them
 * lock out the rest. `ipLimitingAvailable()` lets callers skip the IP layer in
 * that state rather than apply a control that punishes the innocent.
 */
export function ipLimitingAvailable(request: NextRequest): boolean {
  if (request.ip) return true

  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? '')
  return Number.isInteger(hops) && hops > 0
}

/** Logged once per process, not per request — this would otherwise flood. */
let warnedAboutClientIp = false

/**
 * Client IP, derived only from sources the caller cannot forge.
 *
 * WHY NOT THE LEFT-MOST x-forwarded-for ENTRY
 * ───────────────────────────────────────────
 * `X-Forwarded-For` is append-only: each proxy appends the address it received
 * the connection from. A client that sends `X-Forwarded-For: 1.2.3.4` and is
 * then proxied once produces `1.2.3.4, <real client ip>`. So the left-most
 * entry is whatever the *client* chose to put there, and reading it lets anyone
 * pick their own rate-limit bucket — rotating the header resets every limit.
 *
 * The trustworthy entry is counted from the RIGHT, one hop per proxy that is
 * actually in front of this app. That count cannot be guessed, so it is
 * configuration (`TRUSTED_PROXY_HOPS`), not a default.
 *
 * Order of preference:
 *   1. `request.ip` — populated by the platform (Vercel), never by the client.
 *   2. The Nth-from-right XFF entry, only when TRUSTED_PROXY_HOPS says how many
 *      proxies to skip.
 *   3. A single shared bucket. Deliberately NOT a per-request unique value: an
 *      unknown-origin request must not get its own private allowance. IP is the
 *      coarse layer anyway — the per-phone and per-user buckets, which key off
 *      values the caller cannot rotate freely, are the ones that bite.
 */
export function clientIp(request: NextRequest): string {
  if (request.ip) return request.ip

  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? '')

  if (Number.isInteger(hops) && hops > 0) {
    const chain = request.headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    // With one trusted proxy the real client is the last entry, with two it is
    // the second-to-last, and so on. Anything the client prepended sits to the
    // left of that and is ignored.
    if (chain?.length) {
      const candidate = chain[chain.length - hops]
      if (candidate) return candidate
    }
  }

  /*
   * Nothing trustworthy identifies this client.
   *
   * This used to return a single constant, which put EVERY visitor in the same
   * bucket: ten code requests from anyone, anywhere, locked out the entire
   * platform for an hour. That is a self-inflicted outage, and it is the exact
   * failure that brought us here — a developer testing registration exhausted
   * the global OTP allowance in a few minutes.
   *
   * Callers now check `ipLimitingAvailable()` and skip the IP layer instead, so
   * this value is only ever a label. The per-phone and per-user buckets — keyed
   * on values a caller cannot rotate freely — remain in force either way, and
   * they are the ones that actually bite.
   */

  return 'unidentified-client'
}

/**
 * Applies an IP-keyed limit, but only when the client can be told apart from
 * every other client.
 *
 * When it cannot, the limit is skipped rather than shared. A control that
 * cannot distinguish attacker from citizen does not protect the citizen — it
 * locks them out alongside the attacker, which is worse than not having it.
 * The per-phone and per-user buckets are unaffected and still apply.
 */
export async function consumeIpRateLimit(
  request: NextRequest,
  prefix: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  if (!ipLimitingAvailable(request)) {
    // Once per process, not per request — otherwise this floods the log.
    if (!warnedAboutClientIp) {
      warnedAboutClientIp = true
      console.warn(
        '[rateLimiter] No trustworthy client IP available, so IP-keyed limits are ' +
          'INACTIVE. On Vercel this resolves itself; behind any other proxy set ' +
          'TRUSTED_PROXY_HOPS to the number of proxies in front of this app. ' +
          'Per-phone and per-user limits are unaffected.',
      )
    }

    return { allowed: true, remaining: rule.limit, retryAfter: 0 }
  }

  return consumeRateLimit(`${prefix}:${clientIp(request)}`, rule)
}

/** Removes rate-limit rows whose windows expired long ago. Safe to call in cron. */
export async function pruneExpiredRateLimits(olderThanHours = 48): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  })
  return count
}
