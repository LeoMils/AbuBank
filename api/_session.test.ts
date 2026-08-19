/*
 * _session.test.ts — the server-verifiable session/credential core (CODE evidence).
 * Proves the signed-token layer that gates every billable endpoint: forged,
 * tampered, expired, wrong-purpose and wrong-secret tokens are all denied; the
 * cookie and the x-abu-session header are equivalent; the CI/acceptance minter
 * produces a token the server accepts (format lock).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  signToken, verifyToken, requireSession, parseCookies, serializeCookie, clearCookie,
  enrollmentSecretOk, authConfigured, deriveRp, COOKIE, TTL,
} from './_session'
import { mintSessionToken } from '../scripts/lib/acceptance-session.mjs'

const SECRET = 'test-signing-secret-abu-ela-000000'
const ENROLL = 'owner-enroll-code-123'

beforeEach(() => {
  process.env.AUTH_SIGNING_SECRET = SECRET
  process.env.ENROLLMENT_SECRET = ENROLL
})

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://abu-ela.example/api/x', { method: 'POST', headers })
}

describe('signed-token layer', () => {
  it('round-trips a valid session token', async () => {
    const tok = await signToken('session', { deviceId: 'd1' }, TTL.sessionMs)
    expect(tok).toBeTruthy()
    const claims = await verifyToken('session', tok!)
    expect(claims?.deviceId).toBe('d1')
  })

  it('rejects a token signed with a DIFFERENT secret (forgery)', async () => {
    const tok = await signToken('session', { deviceId: 'd1' }, TTL.sessionMs)
    process.env.AUTH_SIGNING_SECRET = 'a-different-secret-entirely-999999'
    expect(await verifyToken('session', tok!)).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const tok = (await signToken('session', { deviceId: 'd1' }, TTL.sessionMs))!
    const [payload, sig] = tok.split('.')
    const tampered = `${payload}x.${sig}`
    expect(await verifyToken('session', tampered)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const tok = (await signToken('session', { deviceId: 'd1' }, 1000, 1_000_000))!
    expect(await verifyToken('session', tok, 3_000_000)).toBeNull()
  })

  it('rejects a purpose mismatch (a device token is not a session)', async () => {
    const deviceTok = (await signToken('device', { deviceId: 'd1', credId: 'c' }, TTL.deviceMs))!
    expect(await verifyToken('session', deviceTok)).toBeNull()
  })

  it('fails closed when no secret is configured', async () => {
    delete process.env.AUTH_SIGNING_SECRET
    expect(await signToken('session', { deviceId: 'd1' }, TTL.sessionMs)).toBeNull()
    expect(await verifyToken('session', 'anything.anything')).toBeNull()
  })
})

describe('requireSession — cookie and header, fail-closed', () => {
  it('accepts a valid session cookie', async () => {
    const tok = (await signToken('session', { deviceId: 'd1' }, TTL.sessionMs))!
    const info = await requireSession(reqWith({ cookie: `${COOKIE.session}=${tok}` }))
    expect(info?.deviceId).toBe('d1')
  })

  it('accepts the same token via x-abu-session header', async () => {
    const tok = (await signToken('session', { deviceId: 'd2' }, TTL.sessionMs))!
    const info = await requireSession(reqWith({ 'x-abu-session': tok }))
    expect(info?.deviceId).toBe('d2')
  })

  it('denies a request with NO credential', async () => {
    expect(await requireSession(reqWith({}))).toBeNull()
  })

  it('denies a forged cookie', async () => {
    expect(await requireSession(reqWith({ cookie: `${COOKIE.session}=not.a.valid.token` }))).toBeNull()
  })

  it('denies an expired session', async () => {
    const tok = (await signToken('session', { deviceId: 'd1' }, 1000, 1_000_000))!
    expect(await requireSession(reqWith({ 'x-abu-session': tok }), 3_000_000)).toBeNull()
  })
})

describe('CI/acceptance minter matches the server format', () => {
  it('a token minted by acceptance-session.mjs is accepted by the server', async () => {
    const tok = mintSessionToken(SECRET, { deviceId: 'ci' })
    const claims = await verifyToken('session', tok)
    expect(claims?.deviceId).toBe('ci')
  })

  it('a minted token signed with the WRONG secret is rejected', async () => {
    const tok = mintSessionToken('wrong-secret-xxxxxxxxxxxxxxxxxxxx', { deviceId: 'ci' })
    expect(await verifyToken('session', tok)).toBeNull()
  })
})

describe('owner enrollment bootstrap', () => {
  it('accepts the exact enrollment secret, rejects wrong/empty', () => {
    expect(enrollmentSecretOk(ENROLL)).toBe(true)
    expect(enrollmentSecretOk('nope')).toBe(false)
    expect(enrollmentSecretOk('')).toBe(false)
    expect(enrollmentSecretOk(undefined)).toBe(false)
  })

  it('authConfigured requires both secrets', () => {
    expect(authConfigured()).toBe(true)
    delete process.env.ENROLLMENT_SECRET
    expect(authConfigured()).toBe(false)
  })
})

describe('cookies + RP derivation', () => {
  it('serializes hardened cookies and clears them', () => {
    const c = serializeCookie(COOKIE.session, 'v', TTL.sessionMs)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Strict')
    expect(clearCookie(COOKIE.session)).toContain('Max-Age=0')
  })

  it('parses cookies and derives rpID/origin from the request', () => {
    expect(parseCookies(reqWith({ cookie: 'a=1; b=2' }))).toEqual({ a: '1', b: '2' })
    const { rpID, origin } = deriveRp(new Request('https://x/api', { headers: { origin: 'https://abu.example.com' } }))
    expect(rpID).toBe('abu.example.com')
    expect(origin).toBe('https://abu.example.com')
  })
})
