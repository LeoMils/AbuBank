/*
 * /api/auth/register-verify — finish passkey enrollment (server-verified).
 * ════════════════════════════════════════════════════════════════════════════
 * Verifies the WebAuthn attestation against the server's own challenge, origin
 * and RP id (SimpleWebAuthn). On success it mints:
 *   • abu_device  — the server-signed enrolled credential (id + public key). This
 *     is the device certificate; it is trusted later only because we HMAC-signed
 *     it. (Reaching here already required the ENROLLMENT_SECRET via -challenge.)
 *   • abu_session — a short-lived authenticated session.
 * A caller who never passed -challenge has no valid reg-challenge cookie ⇒ denied.
 */
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import {
  COOKIE, TTL, authConfigured, b64urlFromBytes, clearCookie, deriveRp, isProduction, jsonResponse,
  parseCookies, serializeCookie, signToken, verifyToken,
} from '../_session'
import { consumeNonce, replayProtectionSatisfied } from '../_replayStore'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)
  if (!authConfigured()) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)
  // Production requires a DISTRIBUTED single-use store (global replay protection) — fail closed otherwise.
  if (!replayProtectionSatisfied(isProduction())) return jsonResponse({ ok: false, error: 'REPLAY_STORE_REQUIRED' }, 503)

  let body: { response?: RegistrationResponseJSON }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400)
  }
  if (!body.response) return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400)

  const chalClaims = await verifyToken('reg_challenge', parseCookies(req)[COOKIE.regChallenge])
  const expectedChallenge = typeof chalClaims?.challenge === 'string' ? chalClaims.challenge : ''
  const nonce = typeof chalClaims?.nonce === 'string' ? chalClaims.nonce : ''
  if (!expectedChallenge || !nonce) return jsonResponse({ ok: false, error: 'CHALLENGE_MISSING' }, 400)

  const { rpID, origin } = deriveRp(req)
  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    })
  } catch {
    return jsonResponse({ ok: false, error: 'REGISTRATION_INVALID' }, 401, [clearCookie(COOKIE.regChallenge)])
  }
  if (!verification.verified || !verification.registrationInfo) {
    return jsonResponse({ ok: false, error: 'REGISTRATION_INVALID' }, 401, [clearCookie(COOKIE.regChallenge)])
  }
  // SINGLE-USE: a replayed registration (same attestation + challenge) is denied.
  if (!(await consumeNonce(nonce, TTL.challengeMs))) {
    return jsonResponse({ ok: false, error: 'REGISTRATION_REPLAY' }, 401, [clearCookie(COOKIE.regChallenge)])
  }

  const cred = verification.registrationInfo.credential
  const deviceId = cred.id
  const deviceToken = await signToken(
    'device',
    { deviceId, credId: cred.id, publicKey: b64urlFromBytes(cred.publicKey), counter: cred.counter, transports: cred.transports ?? [] },
    TTL.deviceMs,
  )
  const sessionToken = await signToken('session', { deviceId }, TTL.sessionMs)
  if (!deviceToken || !sessionToken) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)

  return jsonResponse({ ok: true, deviceId }, 200, [
    serializeCookie(COOKIE.device, deviceToken, TTL.deviceMs),
    serializeCookie(COOKIE.session, sessionToken, TTL.sessionMs),
    clearCookie(COOKIE.regChallenge),
  ])
}
