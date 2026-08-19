/*
 * serverAuth.ts — the CLIENT half of the real, server-verified passkey auth.
 * ════════════════════════════════════════════════════════════════════════════
 * The local Face ID/PIN overlay (appLock/biometricAuth) unlocks the UI on THIS
 * device. This module additionally obtains a SERVER session so the billable Abu
 * APIs (chat/tts/stt/online/news/realtime-token) accept the request — the server
 * can now distinguish an authorized Abu Ela device from any internet client.
 *
 * The passkey gesture IS the Face ID gesture: `passkeyLogin()` runs a WebAuthn
 * assertion (userVerification required → the OS Face ID/Touch ID sheet) and, on
 * server verification, the server sets an HttpOnly session cookie. Enrollment is
 * owner-bootstrapped (an ENROLLMENT_SECRET the owner enters once) so a random
 * visitor cannot self-enrol. Everything degrades gracefully: if server auth is
 * not configured or the platform has no authenticator, callers fall back to the
 * local-only lock (billable features then simply stay unauthenticated).
 */
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export type AuthStatus = { configured: boolean; enrolled: boolean; authed: boolean }
export type CeremonyResult = 'ok' | 'failed' | 'cancelled' | 'unavailable' | 'no-device' | 'denied' | 'not-configured'

/**
 * RESTRICTED = server auth is configured for this deployment but this device has NO
 * live server session. A PIN-only entry (or a device Leo never activated) lands here.
 * The UI MUST surface this (no false success). Pure so the invariant is unit-testable.
 */
export function deriveRestricted(s: AuthStatus): boolean {
  return s.configured && !s.authed
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function postJson(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: JSON_HEADERS,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

/** Current server auth status (configured? device enrolled? live session?). Never throws. */
export async function authStatus(): Promise<AuthStatus> {
  try {
    const r = await fetch('/api/auth/session', { credentials: 'same-origin' })
    if (!r.ok) return { configured: false, enrolled: false, authed: false }
    const j = (await r.json()) as Partial<AuthStatus>
    return { configured: !!j.configured, enrolled: !!j.enrolled, authed: !!j.authed }
  } catch {
    return { configured: false, enrolled: false, authed: false }
  }
}

function platformHasWebAuthn(): boolean {
  return typeof window !== 'undefined' && typeof (window as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined'
}

/**
 * Owner-bootstrapped device enrollment: register a platform passkey with the
 * server (requires the ENROLLMENT_SECRET). On success the server issues the
 * device certificate + a session. Triggers the Face ID/Touch ID sheet.
 */
export async function passkeyRegister(enrollmentSecret: string): Promise<CeremonyResult> {
  if (!platformHasWebAuthn()) return 'unavailable'
  try {
    const chal = await postJson('/api/auth/register-challenge', { enrollmentSecret })
    if (chal.status === 403) return 'denied'
    if (chal.status === 503) return 'not-configured'
    if (!chal.ok) return 'failed'
    const { options } = (await chal.json()) as { options: Parameters<typeof startRegistration>[0]['optionsJSON'] }
    let attResp
    try {
      attResp = await startRegistration({ optionsJSON: options })
    } catch (e) {
      return (e as { name?: string })?.name === 'NotAllowedError' ? 'cancelled' : 'failed'
    }
    const verify = await postJson('/api/auth/register-verify', { response: attResp })
    return verify.ok ? 'ok' : 'failed'
  } catch {
    return 'failed'
  }
}

/**
 * Returning-device sign-in: assert the enrolled passkey (Face ID) and, on server
 * verification, obtain a session. `no-device` means this device has never been
 * enrolled (owner must run passkeyRegister first).
 */
export async function passkeyLogin(): Promise<CeremonyResult> {
  if (!platformHasWebAuthn()) return 'unavailable'
  try {
    const chal = await postJson('/api/auth/login-challenge')
    if (chal.status === 401) return 'no-device'
    if (chal.status === 503) return 'not-configured'
    if (!chal.ok) return 'failed'
    const { options } = (await chal.json()) as { options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }
    let asseResp
    try {
      asseResp = await startAuthentication({ optionsJSON: options })
    } catch (e) {
      return (e as { name?: string })?.name === 'NotAllowedError' ? 'cancelled' : 'failed'
    }
    const verify = await postJson('/api/auth/login-verify', { response: asseResp })
    return verify.ok ? 'ok' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Drop the server session (keeps the device enrolled). Best-effort. */
export async function serverLogout(): Promise<void> {
  try {
    await postJson('/api/auth/session', { action: 'logout' })
  } catch {
    /* ignore */
  }
}
