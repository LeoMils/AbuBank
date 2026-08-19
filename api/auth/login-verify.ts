/*
 * /api/auth/login-verify — verify a passkey assertion and issue a session.
 * ════════════════════════════════════════════════════════════════════════════
 * Verifies the WebAuthn assertion signature against the enrolled credential's
 * public key (from the server-signed abu_device cert), the server's own fresh
 * challenge, origin, RP id and the user-verification flag (SimpleWebAuthn). Only
 * on success does it mint abu_session — the credential the billable endpoints
 * require. A stolen device cert is useless without the platform authenticator's
 * private key, and a replayed assertion fails the fresh-challenge check.
 */
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from '@simplewebauthn/server'
import {
  COOKIE, TTL, authConfigured, bytesFromB64url, clearCookie, deriveRp,
  jsonResponse, parseCookies, serializeCookie, signToken, unauthorized, verifyToken,
} from '../_session'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)
  if (!authConfigured()) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)

  let body: { response?: AuthenticationResponseJSON }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400)
  }
  if (!body.response) return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400)

  const device = await verifyToken('device', parseCookies(req)[COOKIE.device])
  const credId = typeof device?.credId === 'string' ? device.credId : ''
  const publicKeyB64 = typeof device?.publicKey === 'string' ? device.publicKey : ''
  const deviceId = typeof device?.deviceId === 'string' ? device.deviceId : ''
  if (!credId || !publicKeyB64 || !deviceId) return unauthorized()

  const chalClaims = await verifyToken('login_challenge', parseCookies(req)[COOKIE.loginChallenge])
  const expectedChallenge = typeof chalClaims?.challenge === 'string' ? chalClaims.challenge : ''
  if (!expectedChallenge) return jsonResponse({ ok: false, error: 'CHALLENGE_MISSING' }, 400)

  const { rpID, origin } = deriveRp(req)
  const counter = typeof device?.counter === 'number' ? device.counter : 0
  const transports = Array.isArray(device?.transports) ? (device.transports as AuthenticatorTransportFuture[]) : undefined

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: credId, publicKey: bytesFromB64url(publicKeyB64), counter, ...(transports ? { transports } : {}) },
    })
  } catch {
    return jsonResponse({ ok: false, error: 'ASSERTION_INVALID' }, 401, [clearCookie(COOKIE.loginChallenge)])
  }
  if (!verification.verified) {
    return jsonResponse({ ok: false, error: 'ASSERTION_INVALID' }, 401, [clearCookie(COOKIE.loginChallenge)])
  }

  const sessionToken = await signToken('session', { deviceId }, TTL.sessionMs)
  if (!sessionToken) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)

  // Re-issue the device cert with the advanced counter (replay-hardening for authenticators that increment it).
  const rotatedDevice = await signToken(
    'device',
    { deviceId, credId, publicKey: publicKeyB64, counter: verification.authenticationInfo.newCounter, transports: transports ?? [] },
    TTL.deviceMs,
  )

  const cookies = [serializeCookie(COOKIE.session, sessionToken, TTL.sessionMs), clearCookie(COOKIE.loginChallenge)]
  if (rotatedDevice) cookies.push(serializeCookie(COOKIE.device, rotatedDevice, TTL.deviceMs))
  return jsonResponse({ ok: true, deviceId }, 200, cookies)
}
