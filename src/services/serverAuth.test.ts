/*
 * serverAuth.test.ts — the CLIENT ceremony's status parsing + graceful
 * degradation (CODE evidence). The real Face ID assertion is device-only; here
 * we prove the branching: status parsing, unavailable-platform, server-denied
 * enrolment, and not-enrolled login all resolve to the documented results.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'reg' })),
  startAuthentication: vi.fn(async () => ({ id: 'auth' })),
}))

import { authStatus, passkeyLogin, passkeyRegister } from './serverAuth'

const g = globalThis as unknown as { window?: unknown; fetch?: unknown }

afterEach(() => {
  delete g.window
  vi.restoreAllMocks()
})

function mockFetch(fn: (url: string, init?: RequestInit) => Promise<Response>) {
  g.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => fn(String(input), init)) as unknown
}
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status })

describe('authStatus', () => {
  it('parses configured/enrolled/authed', async () => {
    mockFetch(async () => json({ configured: true, enrolled: true, authed: false }))
    expect(await authStatus()).toEqual({ configured: true, enrolled: true, authed: false })
  })
  it('returns all-false on a network error (never throws)', async () => {
    mockFetch(async () => { throw new Error('offline') })
    expect(await authStatus()).toEqual({ configured: false, enrolled: false, authed: false })
  })
})

describe('graceful degradation without a platform authenticator', () => {
  beforeEach(() => { delete g.window }) // no window.PublicKeyCredential
  it('passkeyLogin → unavailable', async () => {
    expect(await passkeyLogin()).toBe('unavailable')
  })
  it('passkeyRegister → unavailable', async () => {
    expect(await passkeyRegister('code')).toBe('unavailable')
  })
})

describe('with a platform authenticator present', () => {
  beforeEach(() => { g.window = { PublicKeyCredential: function () {} } })

  it('passkeyLogin → no-device when the server has no enrolled credential (401)', async () => {
    mockFetch(async (url) => (url.includes('login-challenge') ? json({ ok: false }, 401) : json({ ok: true })))
    expect(await passkeyLogin()).toBe('no-device')
  })

  it('passkeyRegister → denied on a wrong enrollment secret (403)', async () => {
    mockFetch(async (url) => (url.includes('register-challenge') ? json({ ok: false }, 403) : json({ ok: true })))
    expect(await passkeyRegister('wrong')).toBe('denied')
  })

  it('passkeyRegister → ok on full success', async () => {
    mockFetch(async (url) => {
      if (url.includes('register-challenge')) return json({ ok: true, options: { challenge: 'c' } })
      if (url.includes('register-verify')) return json({ ok: true })
      return json({ ok: true })
    })
    expect(await passkeyRegister('right')).toBe('ok')
  })

  it('passkeyLogin → ok on full success', async () => {
    mockFetch(async (url) => {
      if (url.includes('login-challenge')) return json({ ok: true, options: { challenge: 'c' } })
      if (url.includes('login-verify')) return json({ ok: true })
      return json({ ok: true })
    })
    expect(await passkeyLogin()).toBe('ok')
  })
})
