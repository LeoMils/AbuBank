/*
 * authCeremony.test.ts — the WebAuthn ceremony endpoints' access control + the
 * server-verification WIRING (CODE evidence). SimpleWebAuthn's crypto is a vetted
 * library and is mocked here; what we prove is that OUR endpoints:
 *   • refuse enrollment without the owner ENROLLMENT_SECRET (no self-enrol),
 *   • bind + require the server's own challenge (missing challenge → denied),
 *   • require an enrolled device cert to log in,
 *   • pass the SERVER-derived expectedOrigin / expectedRPID / expectedChallenge
 *     (and the enrolled credential) into the verifier — i.e. wrong origin / RP /
 *     challenge / replay are actually checked, not ignored,
 *   • deny when verification fails.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as swa from '@simplewebauthn/server'
import { signToken, COOKIE, TTL } from './_session'
import { _resetReplayStore } from './_replayStore'

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(async () => ({ challenge: 'srv-reg-chal', rp: {}, user: {}, pubKeyCredParams: [] })),
  generateAuthenticationOptions: vi.fn(async () => ({ challenge: 'srv-login-chal', allowCredentials: [] })),
  verifyRegistrationResponse: vi.fn(async () => ({
    verified: true,
    registrationInfo: { credential: { id: 'cred1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } },
  })),
  verifyAuthenticationResponse: vi.fn(async () => ({ verified: true, authenticationInfo: { newCounter: 1 } })),
}))

// Import the handlers AFTER the mock is registered.
import registerChallenge from './auth/register-challenge'
import registerVerify from './auth/register-verify'
import loginChallenge from './auth/login-challenge'
import loginVerify from './auth/login-verify'

const SECRET = 'test-signing-secret-abu-ela-000000'
const ENROLL = 'owner-enroll-code-123'
const ORIGIN = 'https://abu-ela.example.com'

beforeEach(() => {
  process.env.AUTH_SIGNING_SECRET = SECRET
  process.env.ENROLLMENT_SECRET = ENROLL
  delete process.env.VERCEL_ENV
  _resetReplayStore()
  vi.clearAllMocks()
})

function post(body: unknown, cookies: Record<string, string> = {}): Request {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  return new Request(`${ORIGIN}/api/auth/x`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}
const setCookies = (res: Response): string[] =>
  (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []

describe('register-challenge — owner bootstrap only', () => {
  it('503 when server auth is not configured', async () => {
    delete process.env.AUTH_SIGNING_SECRET
    const res = await registerChallenge(post({ enrollmentSecret: ENROLL }))
    expect(res.status).toBe(503)
  })
  it('403 for a wrong / missing enrollment secret (no self-enrol)', async () => {
    expect((await registerChallenge(post({ enrollmentSecret: 'wrong' }))).status).toBe(403)
    expect((await registerChallenge(post({}))).status).toBe(403)
  })
  it('200 + reg-challenge cookie for the correct secret', async () => {
    const res = await registerChallenge(post({ enrollmentSecret: ENROLL }))
    expect(res.status).toBe(200)
    expect(setCookies(res).some((c) => c.startsWith(COOKIE.regChallenge))).toBe(true)
  })
})

describe('register-verify — challenge required, verification enforced', () => {
  it('400 without a reg-challenge cookie', async () => {
    const res = await registerVerify(post({ response: {} }))
    expect(res.status).toBe(400)
  })
  it('verifies against the SERVER challenge/origin/RP, then issues device + session', async () => {
    const chal = (await signToken('reg_challenge', { challenge: 'srv-reg-chal', nonce: 'rn' }, TTL.challengeMs))!
    const res = await registerVerify(post({ response: { id: 'x' } }, { [COOKIE.regChallenge]: chal }))
    expect(res.status).toBe(200)
    const args = vi.mocked(swa.verifyRegistrationResponse).mock.calls[0]![0]
    expect(args.expectedChallenge).toBe('srv-reg-chal')
    expect(args.expectedOrigin).toBe(ORIGIN)
    expect(args.expectedRPID).toBe('abu-ela.example.com')
    expect(args.requireUserVerification).toBe(true)
    const cookies = setCookies(res)
    expect(cookies.some((c) => c.startsWith(COOKIE.device))).toBe(true)
    expect(cookies.some((c) => c.startsWith(COOKIE.session))).toBe(true)
  })
  it('401 when the attestation does not verify', async () => {
    vi.mocked(swa.verifyRegistrationResponse).mockResolvedValueOnce({ verified: false } as never)
    const chal = (await signToken('reg_challenge', { challenge: 'srv-reg-chal', nonce: 'rn' }, TTL.challengeMs))!
    const res = await registerVerify(post({ response: { id: 'x' } }, { [COOKIE.regChallenge]: chal }))
    expect(res.status).toBe(401)
  })
})

describe('login — requires an enrolled device', () => {
  const deviceCookie = async () =>
    (await signToken('device', { deviceId: 'cred1', credId: 'cred1', publicKey: 'AQID', counter: 0, transports: ['internal'] }, TTL.deviceMs))!

  it('login-challenge 401 without a device cert', async () => {
    expect((await loginChallenge(post({}))).status).toBe(401)
  })
  it('login-challenge 200 + challenge cookie with a device cert', async () => {
    const res = await loginChallenge(post({}, { [COOKIE.device]: await deviceCookie() }))
    expect(res.status).toBe(200)
    expect(setCookies(res).some((c) => c.startsWith(COOKIE.loginChallenge))).toBe(true)
  })
  it('login-verify 401 without a device cert', async () => {
    const chal = (await signToken('login_challenge', { challenge: 'srv-login-chal', nonce: 'ln' }, TTL.challengeMs))!
    expect((await loginVerify(post({ response: {} }, { [COOKIE.loginChallenge]: chal }))).status).toBe(401)
  })
  it('login-verify 400 without a challenge cookie', async () => {
    expect((await loginVerify(post({ response: {} }, { [COOKIE.device]: await deviceCookie() }))).status).toBe(400)
  })
  it('verifies assertion vs SERVER challenge/origin/RP + enrolled credential → session', async () => {
    const chal = (await signToken('login_challenge', { challenge: 'srv-login-chal', nonce: 'ln' }, TTL.challengeMs))!
    const res = await loginVerify(post({ response: { id: 'cred1' } }, { [COOKIE.device]: await deviceCookie(), [COOKIE.loginChallenge]: chal }))
    expect(res.status).toBe(200)
    const args = vi.mocked(swa.verifyAuthenticationResponse).mock.calls[0]![0]
    expect(args.expectedChallenge).toBe('srv-login-chal')
    expect(args.expectedOrigin).toBe(ORIGIN)
    expect(args.expectedRPID).toBe('abu-ela.example.com')
    expect(args.requireUserVerification).toBe(true)
    expect(args.credential.id).toBe('cred1')
    expect(setCookies(res).some((c) => c.startsWith(COOKIE.session))).toBe(true)
  })
  it('login-verify 401 when the assertion does not verify (e.g. wrong challenge/replay)', async () => {
    vi.mocked(swa.verifyAuthenticationResponse).mockResolvedValueOnce({ verified: false } as never)
    const chal = (await signToken('login_challenge', { challenge: 'srv-login-chal', nonce: 'ln' }, TTL.challengeMs))!
    const res = await loginVerify(post({ response: { id: 'cred1' } }, { [COOKIE.device]: await deviceCookie(), [COOKIE.loginChallenge]: chal }))
    expect(res.status).toBe(401)
  })
})
