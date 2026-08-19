/*
 * acceptance-session.mjs — mint a valid Abu session token for CI/acceptance.
 * ════════════════════════════════════════════════════════════════════════════
 * The billable Abu endpoints now require a server-verified session. Real users
 * get one from the passkey ceremony (device-only). CI/acceptance instead mints
 * the SAME HMAC-signed token here using the shared AUTH_SIGNING_SECRET (which the
 * owner also configured on the deployment) and presents it in the `x-abu-session`
 * header (node) or the `abu_session` cookie (browser). This is a server
 * credential, not a public bypass: without AUTH_SIGNING_SECRET you cannot forge a
 * token, so unauthenticated internet callers still get 401.
 *
 * The token format matches api/_session.ts signToken('session', …) exactly:
 *   base64url(JSON.stringify({ deviceId, p:'session', exp })) + '.' + base64url(HMAC_SHA256(payload))
 * (verification reads the payload substring verbatim, so key order is irrelevant.)
 */
import crypto from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function acceptanceSecret() {
  return process.env.AUTH_SIGNING_SECRET || ''
}

export function mintSessionToken(secret, { deviceId = 'ci-acceptance', ttlMs = 15 * 60_000, now = Date.now() } = {}) {
  const payload = b64url(Buffer.from(JSON.stringify({ deviceId, p: 'session', exp: now + ttlMs }), 'utf8'))
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest())
  return `${payload}.${sig}`
}

/** Monkeypatch global fetch so every /api/ request carries a minted session header. No-op without the secret. */
export function installNodeFetchAuth() {
  const secret = acceptanceSecret()
  if (!secret) return false
  const token = mintSessionToken(secret)
  const orig = globalThis.fetch
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    const headers = new Headers(init.headers || (typeof input === 'object' && input ? input.headers : undefined))
    if (String(url).includes('/api/')) headers.set('x-abu-session', token)
    return orig(input, { ...init, headers })
  }
  return true
}

/** A Playwright cookie object for context.addCookies — carries the session into browser /api requests. */
export function playwrightSessionCookie(rcUrl, { deviceId = 'ci-acceptance' } = {}) {
  const secret = acceptanceSecret()
  if (!secret) return null
  const u = new URL(rcUrl)
  return {
    name: 'abu_session',
    value: mintSessionToken(secret, { deviceId }),
    domain: u.hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  }
}
