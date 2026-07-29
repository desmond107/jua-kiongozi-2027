import { beforeAll, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { createAdminToken, readAdminToken } from '@/backend/services/adminSession.service'
import { createSessionToken, readSessionToken } from '@/backend/services/session.service'

/**
 * The privilege boundary between a citizen session and an operator session.
 *
 * Both are HS256 JWTs signed with the SAME secret, because there is one
 * JWT_SECRET. That means a citizen's session cookie is a *validly signed* token
 * as far as the admin verifier's key is concerned, and the only thing standing
 * between "signed in as a voter" and "signed in as an operator" is the audience
 * claim.
 *
 * If these tests ever fail, the admin area is open to anyone with an account.
 */

beforeAll(() => {
  // The service reads env lazily through `env.jwtSecret`, so setting it here is
  // enough — no module reset needed.
  process.env.JWT_SECRET ??= 'test-jwt-secret-value-long-enough-to-pass-validation'
})

describe('admin session', () => {
  it('round-trips its own claims', async () => {
    const token = await createAdminToken({ adminId: 'adm_1', username: 'oneterm' })
    const claims = await readAdminToken(token)

    expect(claims).toEqual({ adminId: 'adm_1', username: 'oneterm' })
  })

  it('REJECTS a citizen session token presented as an admin token', async () => {
    const citizen = await createSessionToken({
      userId: 'usr_1',
      name: 'Asha Mwangi',
      serial: 'JK27-ABCD',
    })

    // The signature is genuine — this server minted it. Only the audience
    // differs, and that must be enough to refuse.
    expect(await readAdminToken(citizen)).toBeNull()
  })

  it('REJECTS an admin token presented as a citizen token', async () => {
    const admin = await createAdminToken({ adminId: 'adm_1', username: 'oneterm' })

    expect(await readSessionToken(admin)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const forged = await new SignJWT({ username: 'oneterm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('adm_1')
      .setIssuer('jua-kiongozi-27')
      .setAudience('jua-kiongozi-27-admin')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-completely-different-secret-value-here'))

    expect(await readAdminToken(forged)).toBeNull()
  })

  it('rejects a token with the right audience but a foreign issuer', async () => {
    const forged = await new SignJWT({ username: 'oneterm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('adm_1')
      .setIssuer('someone-else')
      .setAudience('jua-kiongozi-27-admin')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    expect(await readAdminToken(forged)).toBeNull()
  })

  it('rejects an expired admin token', async () => {
    const expired = await new SignJWT({ username: 'oneterm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('adm_1')
      .setIssuer('jua-kiongozi-27')
      .setAudience('jua-kiongozi-27-admin')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    expect(await readAdminToken(expired)).toBeNull()
  })

  it('rejects a token with no subject', async () => {
    const subjectless = await new SignJWT({ username: 'oneterm' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('jua-kiongozi-27')
      .setAudience('jua-kiongozi-27-admin')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    expect(await readAdminToken(subjectless)).toBeNull()
  })

  it('rejects rubbish without throwing', async () => {
    expect(await readAdminToken('')).toBeNull()
    expect(await readAdminToken('not.a.jwt')).toBeNull()
  })
})
