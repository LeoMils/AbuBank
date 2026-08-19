/*
 * replayProtection.test.ts — the exact replay/counter attack the review demands.
 * (CODE evidence; the deployed Preview adds a live same-instance replay test.)
 *
 * Proves, with the REAL server-side _replayStore (in-memory here) and the WebAuthn
 * crypto mocked (a vetted lib):
 *   • CHALLENGE_SINGLE_USE: a nonce is consumed exactly once.
 *   • WEBAUTHN_ASSERTION_REPLAY: submit A+C → success; replay the EXACT same A+C
 *     while the challenge cookie is still within TTL → DENIED (ASSERTION_REPLAY).
 *   • WEBAUTHN_COUNTER_ROLLBACK: the counter baseline passed to the verifier is the
 *     SERVER's stored max, so rolling back to an older client-held device cert
 *     cannot lower it; signCount===0 is accepted per WebAuthn (single-use covers it).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as swa from '@simplewebauthn/server'
import { signToken, COOKIE, TTL } from './_session'
import {
  consumeNonce, serverCounterBaseline, recordCounter, replayStoreKind, _resetReplayStore,
} from './_replayStore'

vi.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: 'srv-login-chal', allowCredentials: [] })),
  verifyAuthenticationResponse: vi.fn(async () => ({ verified: true, authenticationInfo: { newCounter: 0 } })),
}))

import loginChallenge from './auth/login-challenge'
import loginVerify from './auth/login-verify'

const SECRET = 'test-signing-secret-abu-ela-000000'
const ORIGIN = 'https://abu-ela.example.com'

beforeEach(() => {
  process.env.AUTH_SIGNING_SECRET = SECRET
  process.env.ENROLLMENT_SECRET = 'owner-enroll-code-123'
  delete process.env.VERCEL_ENV
  _resetReplayStore()
  vi.clearAllMocks()
})

const deviceCookie = async (counter = 0) =>
  (await signToken('device', { deviceId: 'cred1', credId: 'cred1', publicKey: 'AQID', counter, transports: ['internal'] }, TTL.deviceMs))!

function req(cookies: Record<string, string>, body: unknown = { response: { id: 'cred1' } }): Request {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return new Request(`${ORIGIN}/api/auth/login-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: ORIGIN, cookie },
    body: JSON.stringify(body),
  })
}
const setCookies = (res: Response): string[] =>
  (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []

/** Run login-challenge and return the exact abu_chal_login cookie VALUE (as an attacker would capture). */
async function obtainChallengeCookie(): Promise<string> {
  const res = await loginChallenge(
    new Request(`${ORIGIN}/api/auth/login-challenge`, {
      method: 'POST',
      headers: { origin: ORIGIN, cookie: `${COOKIE.device}=${await deviceCookie()}` },
    }),
  )
  const set = setCookies(res).find((c) => c.startsWith(COOKIE.loginChallenge))!
  return decodeURIComponent(set.split(';')[0]!.split('=').slice(1).join('='))
}

describe('_replayStore — single-use + monotonic counter', () => {
  it('consumeNonce returns true ONCE then false (single-use)', async () => {
    expect(replayStoreKind()).toBe('memory')
    expect(await consumeNonce('n1', TTL.challengeMs)).toBe(true)
    expect(await consumeNonce('n1', TTL.challengeMs)).toBe(false)
    expect(await consumeNonce('n2', TTL.challengeMs)).toBe(true)
  })

  it('counter baseline is monotonic; rollback cannot lower it', async () => {
    expect(await serverCounterBaseline('c')).toBe(0)
    await recordCounter('c', 7)
    expect(await serverCounterBaseline('c')).toBe(7)
    await recordCounter('c', 3) // stale/rollback attempt
    expect(await serverCounterBaseline('c')).toBe(7)
    await recordCounter('c', 9)
    expect(await serverCounterBaseline('c')).toBe(9)
  })
})

describe('WEBAUTHN_ASSERTION_REPLAY — the exact attack', () => {
  it('1) challenge C, 2) assertion A, 3) A+C → success, 4) replay EXACT A+C → DENIED', async () => {
    const C = await obtainChallengeCookie()
    const dev = await deviceCookie()

    // Step 3: first submission succeeds and mints a session.
    const first = await loginVerify(req({ [COOKIE.device]: dev, [COOKIE.loginChallenge]: C }))
    expect(first.status).toBe(200)
    expect(setCookies(first).some((c) => c.startsWith(COOKIE.session))).toBe(true)

    // Step 4: replay the EXACT same assertion + EXACT same challenge cookie (still within TTL).
    const replay = await loginVerify(req({ [COOKIE.device]: dev, [COOKIE.loginChallenge]: C }))
    expect(replay.status).toBe(401)
    expect((await replay.json()).error).toBe('ASSERTION_REPLAY')
  })

  it('CHALLENGE_SINGLE_USE: a second, DIFFERENT challenge still works (only the reused one is burnt)', async () => {
    const dev = await deviceCookie()
    const C1 = await obtainChallengeCookie()
    expect((await loginVerify(req({ [COOKIE.device]: dev, [COOKIE.loginChallenge]: C1 }))).status).toBe(200)
    const C2 = await obtainChallengeCookie() // fresh challenge → fresh nonce
    expect((await loginVerify(req({ [COOKIE.device]: dev, [COOKIE.loginChallenge]: C2 }))).status).toBe(200)
  })
})

describe('WEBAUTHN_COUNTER_ROLLBACK — server baseline defeats a rolled-back device cert', () => {
  it('after a login at counter 7, a rolled-back cert (counter 0) still verifies against baseline 7', async () => {
    vi.mocked(swa.verifyAuthenticationResponse).mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 7 } } as never)
    // First login advances the server-stored counter to 7.
    const C1 = await obtainChallengeCookie()
    await loginVerify(req({ [COOKIE.device]: await deviceCookie(0), [COOKIE.loginChallenge]: C1 }))
    expect(await serverCounterBaseline('cred1')).toBe(7)

    // Attacker presents an OLD device cert claiming counter 0. The verifier must receive the
    // SERVER baseline (7), not the cert's 0 — so a stale (<=7) assertion would be rejected.
    const C2 = await obtainChallengeCookie()
    await loginVerify(req({ [COOKIE.device]: await deviceCookie(0), [COOKIE.loginChallenge]: C2 }))
    const calls = vi.mocked(swa.verifyAuthenticationResponse).mock.calls
    const args = calls[calls.length - 1]![0]
    expect(args.credential.counter).toBe(7)
  })
})
