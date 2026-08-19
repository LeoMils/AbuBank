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
  COOKIE, TTL, authConfigured, bytesFromB64url, clearCookie, deriveRp, isProduction,
  jsonResponse, parseCookies, serializeCookie, signToken, unauthorized, verifyToken,
} from '../_session'
import { consumeNonce, recordCounter, replayProtectionSatisfied, serverCounterBaseline } from '../_replayStore'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)
  if (!authConfigured()) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)
  // Production requires a DISTRIBUTED single-use store — otherwise global replay protection
  // is not guaranteed, so we fail closed rather than mint a session on best-effort memory.
  if (!replayProtectionSatisfied(isProduction())) return jsonResponse({ ok: false, error: 'REPLAY_STORE_REQUIRED' }, 503)

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
  const nonce = typeof chalClaims?.nonce === 'string' ? chalClaims.nonce : ''
  if (!expectedChallenge || !nonce) return jsonResponse({ ok: false, error: 'CHALLENGE_MISSING' }, 400)

  const { rpID, origin } = deriveRp(req)
  // Counter baseline is the SERVER's stored max (not the client-held cert value), so rolling
  // back to an older device cert cannot lower it. signCount===0 authenticators are handled by
  // single-use challenge consumption below (the counter is advisory for platform passkeys).
  const certCounter = typeof device?.counter === 'number' ? device.counter : 0
  const baseline = Math.max(certCounter, await serverCounterBaseline(credId))
  const transports = Array.isArray(device?.transports) ? (device.transports as AuthenticatorTransportFuture[]) : undefined

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: credId, publicKey: bytesFromB64url(publicKeyB64), counter: baseline, ...(transports ? { transports } : {}) },
    })
  } catch {
    return jsonResponse({ ok: false, error: 'ASSERTION_INVALID' }, 401, [clearCookie(COOKIE.loginChallenge)])
  }
  if (!verification.verified) {
    return jsonResponse({ ok: false, error: 'ASSERTION_INVALID' }, 401, [clearCookie(COOKIE.loginChallenge)])
  }

  // SINGLE-USE: consume the challenge nonce AFTER a valid assertion. A replay of the exact
  // same assertion + challenge cookie finds the nonce already consumed → DENIED.
  if (!(await consumeNonce(nonce, TTL.challengeMs))) {
    return jsonResponse({ ok: false, error: 'ASSERTION_REPLAY' }, 401, [clearCookie(COOKIE.loginChallenge)])
  }
  await recordCounter(credId, verification.authenticationInfo.newCounter)

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
