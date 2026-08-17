/*
 * _rateLimit.test.ts — the billable-proxy abuse throttle (challenge B). Proves the sliding window
 * admits legitimate bursts and rejects abuse, the window slides, the circuit trips globally, and the
 * client key is derived from the forwarded IP (never a value).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimited, circuitTripped, clientKey, _resetRateLimit } from './_rateLimit'

beforeEach(() => _resetRateLimit())

describe('rateLimited — per-key sliding window', () => {
  it('admits up to the limit, rejects the next, within the window', () => {
    const now = 1_000_000
    for (let i = 0; i < 30; i++) expect(rateLimited('k', 30, 60_000, now)).toBe(false) // 30 admitted
    expect(rateLimited('k', 30, 60_000, now)).toBe(true)                                 // 31st rejected
  })

  it('the window slides — old hits expire so legitimate steady use is never blocked', () => {
    for (let i = 0; i < 30; i++) rateLimited('k', 30, 60_000, 0)
    expect(rateLimited('k', 30, 60_000, 0)).toBe(true)          // full at t=0
    expect(rateLimited('k', 30, 60_000, 61_000)).toBe(false)    // t=61s → old hits expired, admitted
  })

  it('keys are independent (one abusive IP does not block another)', () => {
    for (let i = 0; i < 30; i++) rateLimited('ipA', 30, 60_000, 0)
    expect(rateLimited('ipA', 30, 60_000, 0)).toBe(true)
    expect(rateLimited('ipB', 30, 60_000, 0)).toBe(false)
  })
})

describe('circuitTripped — global cost breaker', () => {
  it('trips after the class limit regardless of key (flood control)', () => {
    for (let i = 0; i < 100; i++) expect(circuitTripped('tts', 100, 60_000, 0)).toBe(false)
    expect(circuitTripped('tts', 100, 60_000, 0)).toBe(true)
  })
})

describe('clientKey — forwarded IP, never a value', () => {
  it('takes the first x-forwarded-for hop', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } })
    expect(clientKey(req)).toBe('203.0.113.7')
  })
  it('falls back to unknown when absent', () => {
    expect(clientKey(new Request('http://x'))).toBe('unknown')
  })
})
