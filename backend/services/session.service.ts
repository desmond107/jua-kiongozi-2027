import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, env } from '@/backend/config/env'

/**
 * Signed, HTTP-only session cookie.
 *
 * The session identifies *which account* is browsing. It deliberately does NOT
 * carry voting authority — every vote and flag submission must still present
 * the raw voting token, which the server re-hashes and checks. A stolen session
 * cookie therefore cannot cast a vote on its own.
 */

export type SessionClaims = {
  userId: string
  name: string
  serial: string
}

const ISSUER = 'jua-kiongozi-27'
const AUDIENCE = 'jua-kiongozi-27-web'

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret)
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ name: claims.name, serial: claims.serial })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey())
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    if (!payload.sub) return null

    return {
      userId: payload.sub,
      name: String(payload.name ?? ''),
      serial: String(payload.serial ?? ''),
    }
  } catch {
    // Expired, tampered with, or signed under a rotated secret — all of which
    // mean "no session" rather than an error worth surfacing.
    return null
  }
}

/** Writes the session cookie. Callable from Route Handlers and Server Actions. */
export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await createSessionToken(claims)

  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/** Current session, or null. Safe to call from Server Components. */
export async function getSession(): Promise<SessionClaims | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME)
  if (!cookie?.value) return null
  return readSessionToken(cookie.value)
}
