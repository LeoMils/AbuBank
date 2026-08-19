/*
 * /api/auth/login-challenge — begin a passkey assertion for an enrolled device.
 * ════════════════════════════════════════════════════════════════════════════
 * Requires the server-signed device certificate (abu_device). A caller with no
 * enrolled device has nothing to assert → 401. Returns WebAuthn authentication
 * options scoped to the enrolled credential and binds a fresh server challenge
 * into a short-TTL signed cookie.
 */
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import { COOKIE, TTL, authConfigured, deriveRp, jsonResponse, parseCookies, serializeCookie, signToken, unauthorized, verifyToken } from '../_session'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)
  if (!authConfigured()) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)

  const device = await verifyToken('device', parseCookies(req)[COOKIE.device])
  const credId = typeof device?.credId === 'string' ? device.credId : ''
  if (!credId) return unauthorized()

  const { rpID } = deriveRp(req)
  const transports = Array.isArray(device?.transports) ? (device.transports as AuthenticatorTransportFuture[]) : undefined
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: credId, ...(transports ? { transports } : {}) }],
    userVerification: 'required',
    timeout: 60_000,
  })

  const chalCookie = serializeCookie(
    COOKIE.loginChallenge,
    (await signToken('login_challenge', { challenge: options.challenge }, TTL.challengeMs)) ?? '',
    TTL.challengeMs,
  )
  return jsonResponse({ ok: true, options }, 200, [chalCookie])
}
