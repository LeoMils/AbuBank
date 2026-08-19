/*
 * biometricAuth.ts — platform biometric unlock via WebAuthn.
 * ════════════════════════════════════════════════════════════════════════════
 * This is the honest web equivalent of "Face ID / Touch ID": the browser's
 * platform authenticator. On a supporting device, `get({userVerification:
 * 'required'})` presents the OS Face ID / Touch ID sheet. We build NO custom
 * facial recognition and store NO biometric data — only an opaque credential id
 * (localStorage). No server / relying party is involved; this is a local device
 * unlock for a no-account PWA.
 *
 * Every call is guarded and NEVER throws — any failure resolves to a value the
 * gate treats as "fall back to PIN". Availability checks return false in jsdom,
 * so this module is inert under unit tests (device verification is required to
 * prove the real Face ID sheet fires — CODE evidence only from here).
 */

const CRED_KEY = 'abu-biometric-cred-v1' // base64url rawId of the enrolled platform credential

export type BiometricResult = 'ok' | 'failed' | 'unavailable' | 'cancelled'

function randBytes(n: number): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(a)
  return a
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** True only when the OS exposes a user-verifying platform authenticator. */
export async function isPlatformBiometricAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return false
    const PKC = window.PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    }
    if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false
    return (await PKC.isUserVerifyingPlatformAuthenticatorAvailable()) === true
  } catch {
    return false
  }
}

export function isBiometricEnrolled(): boolean {
  try {
    return Boolean(localStorage.getItem(CRED_KEY))
  } catch {
    return false
  }
}

export function clearBiometricEnrollment(): void {
  try {
    localStorage.removeItem(CRED_KEY)
  } catch {
    /* ok */
  }
}

/** Enroll the device biometric. Stores only an opaque credential id locally. */
export async function enrollBiometric(displayName = 'Abu Ela'): Promise<{ ok: boolean; reason?: BiometricResult }> {
  try {
    if (!(await isPlatformBiometricAvailable())) return { ok: false, reason: 'unavailable' }
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randBytes(32),
        rp: { name: 'Abu Ela', id: window.location.hostname },
        user: { id: randBytes(16), name: displayName, displayName },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    if (!cred) return { ok: false, reason: 'cancelled' }
    localStorage.setItem(CRED_KEY, b64url(cred.rawId))
    return { ok: true }
  } catch (e) {
    const name = (e as { name?: string })?.name
    return { ok: false, reason: name === 'NotAllowedError' ? 'cancelled' : 'failed' }
  }
}

/** Present the platform biometric sheet and verify the enrolled credential. */
export async function verifyBiometric(): Promise<BiometricResult> {
  try {
    if (!(await isPlatformBiometricAvailable())) return 'unavailable'
    let idB64: string | null = null
    try {
      idB64 = localStorage.getItem(CRED_KEY)
    } catch {
      idB64 = null
    }
    if (!idB64) return 'unavailable'
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randBytes(32),
        timeout: 60_000,
        userVerification: 'required',
        rpId: window.location.hostname,
        allowCredentials: [
          { type: 'public-key', id: fromB64url(idB64), transports: ['internal'] },
        ],
      },
    })
    return assertion ? 'ok' : 'failed'
  } catch (e) {
    const name = (e as { name?: string })?.name
    return name === 'NotAllowedError' ? 'cancelled' : 'failed'
  }
}
