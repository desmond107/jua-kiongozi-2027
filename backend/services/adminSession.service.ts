import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  env,
} from '@/backend/config/env'

/**
 * The operator session. Separate from the citizen session in every dimension
 * that matters.
 *
 * WHY A DIFFERENT AUDIENCE RATHER THAN JUST A DIFFERENT COOKIE
 * ────────────────────────────────────────────────────────────
 * Both sessions are signed with the same JWT_SECRET, so a citizen's session
 * token is a *validly signed* JWT as far as this module's key is concerned. If
 * the only thing separating them were the cookie name, anyone could copy their
 * own `jk27_session` value into a `jk27_admin` cookie and be admitted — the
 * signature would verify, because it is a real signature this server produced.
 *
 * The audience claim closes that. `jwtVerify` is given a required audience of
 * ...-admin, so a token minted for the web audience fails verification outright
 * rather than being accepted with the wrong claims. `tests/unit/admin-session`
 * asserts exactly this replay, because it is the difference between an admin
 * area and a decoration.
 */

export type AdminClaims = {
  adminId: string
  username: string
}

const ISSUER = 'jua-kiongozi-27'
const AUDIENCE = 'jua-kiongozi-27-admin'

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret)
}

export async function createAdminToken(claims: AdminClaims): Promise<string> {
  return new SignJWT({ username: claims.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.adminId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey())
}

export async function readAdminToken(token: string): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    if (!payload.sub) return null

    return { adminId: payload.sub, username: String(payload.username ?? '') }
  } catch {
    // Expired, tampered with, or — importantly — a citizen session presented as
    // an admin one. All three mean "not an operator".
    return null
  }
}

export async function setAdminSessionCookie(claims: AdminClaims): Promise<void> {
  const token = await createAdminToken(claims)

  cookies().set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    // Strict, not Lax. The citizen session is Lax so that following a link into
    // the site keeps you signed in; nothing should ever arrive at the admin area
    // by following a link from somewhere else, and Strict means a cross-site
    // request cannot carry this cookie at all.
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  })
}

export function clearAdminSessionCookie(): void {
  cookies().set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

/** Current operator session, or null. Safe to call from Server Components. */
export async function getAdminSession(): Promise<AdminClaims | null> {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE_NAME)
  if (!cookie?.value) return null
  return readAdminToken(cookie.value)
}
