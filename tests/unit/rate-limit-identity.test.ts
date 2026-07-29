import { describe, expect, it } from 'vitest'
import { ipLimitingAvailable, clientIp } from '@/backend/utils/rateLimiter.util'
import type { NextRequest } from 'next/server'

/**
 * IP-keyed limiting must never punish everyone for being unidentifiable.
 *
 * The bug this guards: with no trustworthy client IP, every visitor was keyed
 * to one shared bucket, so ten code requests from anyone locked out the whole
 * platform for an hour. A control that cannot tell attacker from citizen does
 * not protect the citizen.
 */

const req = (init: { ip?: string; xff?: string }) =>
  ({
    ip: init.ip,
    headers: new Headers(init.xff ? { 'x-forwarded-for': init.xff } : {}),
  }) as unknown as NextRequest

describe('ipLimitingAvailable', () => {
  it('is true when the platform supplies the IP', () => {
    expect(ipLimitingAvailable(req({ ip: '41.90.1.1' }))).toBe(true)
  })

  it('is true when the proxy depth is configured', () => {
    const previous = process.env.TRUSTED_PROXY_HOPS
    process.env.TRUSTED_PROXY_HOPS = '1'
    expect(ipLimitingAvailable(req({ xff: '1.2.3.4, 41.90.1.1' }))).toBe(true)
    process.env.TRUSTED_PROXY_HOPS = previous
  })

  it('is FALSE when nothing trustworthy identifies the client', () => {
    const previous = process.env.TRUSTED_PROXY_HOPS
    delete process.env.TRUSTED_PROXY_HOPS

    // This is the state that produced the outage. Callers must skip the IP
    // layer here rather than share one bucket.
    expect(ipLimitingAvailable(req({}))).toBe(false)
    expect(ipLimitingAvailable(req({ xff: '1.2.3.4' }))).toBe(false)

    process.env.TRUSTED_PROXY_HOPS = previous
  })
})

describe('clientIp', () => {
  it('prefers the platform-supplied address', () => {
    expect(clientIp(req({ ip: '41.90.1.1', xff: '9.9.9.9' }))).toBe('41.90.1.1')
  })

  it('ignores a client-supplied XFF when the proxy depth is unknown', () => {
    const previous = process.env.TRUSTED_PROXY_HOPS
    delete process.env.TRUSTED_PROXY_HOPS

    // Left-most XFF is attacker-controlled; trusting it would let anyone pick
    // their own bucket and reset every limit at will.
    expect(clientIp(req({ xff: '1.2.3.4' }))).not.toBe('1.2.3.4')

    process.env.TRUSTED_PROXY_HOPS = previous
  })

  it('counts from the right when the proxy depth is known', () => {
    const previous = process.env.TRUSTED_PROXY_HOPS
    process.env.TRUSTED_PROXY_HOPS = '1'

    // Client prepended 1.2.3.4; the real peer is the right-most entry.
    expect(clientIp(req({ xff: '1.2.3.4, 41.90.1.1' }))).toBe('41.90.1.1')

    process.env.TRUSTED_PROXY_HOPS = previous
  })
})
