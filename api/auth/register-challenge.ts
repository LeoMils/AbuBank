/*
 * /api/auth/register-challenge — begin owner-bootstrapped passkey enrollment.
 * ════════════════════════════════════════════════════════════════════════════
 * Refuses unless the caller presents the server-only ENROLLMENT_SECRET (never in
 * the client bundle) — this is what stops a random internet visitor from
 * self-enrolling as a trusted Abu Ela device. Returns standards WebAuthn
 * registration options and binds the server's random challenge into a short-TTL
 * signed HttpOnly cookie (stateless replay protection; verified on -verify).
 */
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { COOKIE, TTL, authConfigured, deriveRp, enrollmentSecretOk, jsonResponse, serializeCookie, signToken } from '../_session'

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 405)
  if (!authConfigured()) return jsonResponse({ ok: false, error: 'AUTH_NOT_CONFIGURED' }, 503)

  let body: { enrollmentSecret?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400)
  }
  if (!enrollmentSecretOk(body.enrollmentSecret)) {
    return jsonResponse({ ok: false, error: 'ENROLLMENT_DENIED' }, 403)
  }

  const { rpID } = deriveRp(req)
  const options = await generateRegistrationOptions({
    rpName: 'Abu Ela',
    rpID,
    userName: 'Martita',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
    timeout: 60_000,
  })

  const chalCookie = serializeCookie(
    COOKIE.regChallenge,
    (await signToken('reg_challenge', { challenge: options.challenge }, TTL.challengeMs)) ?? '',
    TTL.challengeMs,
  )
  return jsonResponse({ ok: true, options }, 200, [chalCookie])
}
