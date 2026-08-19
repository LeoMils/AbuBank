/*
 * _session.ts — stateless, server-verifiable session + credential cookies. (NO_LOGIN_PWA_AUTH_POLICY)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The Abu Ela lock used to be a CLIENT-ONLY overlay: the server could not tell an authorized device
 * from any internet caller. This module is the server side of a REAL WebAuthn/passkey auth:
 *
 *   • signToken/verifyToken — HMAC-SHA256 signed tokens (standard primitive; NOT custom crypto). Used
 *     for three purpose-separated cookies, each independently short/long-lived:
 *       - reg_challenge / login_challenge : the server's random WebAuthn challenge (stateless replay
 *         protection = the challenge is bound into a short-TTL signed cookie and verified on response).
 *       - device            : the enrolled credential (id + COSE public key), server-signed after a
 *         verified, owner-bootstrapped registration. This is DEVICE_CREDENTIAL_STORAGE — held by the
 *         client, trusted only because the server HMAC-signed it. No shared KV required.
 *       - session           : issued only after a verified assertion. Billable endpoints require it.
 *   • requireSession — the hot-path guard the edge proxies call. Web Crypto only (edge-safe). Fails
 *     CLOSED: absent secret / missing / tampered / expired cookie ⇒ null ⇒ 401 with ZERO provider call.
 *
 * SESSION_VALIDATION is stateless (verify the signature + expiry; no per-request storage read).
 * DEVICE_CREDENTIAL_STORAGE is a separate, client-held server-signed cert. They are intentionally not
 * combined. Revocation is by rotating AUTH_SIGNING_SECRET (invalidates all device certs + sessions).
 */

function env(): Record<string, string | undefined> {
  return (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
}

/** The server HMAC secret. Absent ⇒ the whole auth system fails closed (no session can be minted or verified). */
export function authSecret(): string | null {
  const s = env().AUTH_SIGNING_SECRET
  return s && s.length >= 16 ? s : null
}

export const COOKIE = {
  session: 'abu_session',
  device: 'abu_device',
  regChallenge: 'abu_chal_reg',
  loginChallenge: 'abu_chal_login',
} as const

export const TTL = {
  /** Short session; a billable call past this must re-assert (matches the 5-min local re-lock cadence). */
  sessionMs: 15 * 60_000,
  /** Long-lived enrolled-credential cert (client re-enrolls after this, or on secret rotation). */
  deviceMs: 400 * 24 * 60 * 60_000,
  /** WebAuthn challenge validity — tight, single-ceremony (also single-USE via _replayStore). */
  challengeMs: 2 * 60_000,
} as const

export type Purpose = 'session' | 'device' | 'reg_challenge' | 'login_challenge'

const te = new TextEncoder()

export function b64urlFromBytes(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function bytesFromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function b64urlFromString(s: string): string {
  return b64urlFromBytes(te.encode(s))
}
function stringFromB64url(s: string): string {
  return new TextDecoder().decode(bytesFromB64url(s))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
async function mac(data: string, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), te.encode(data))
  return b64urlFromBytes(new Uint8Array(sig))
}
async function macValid(data: string, macB64: string, secret: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), bytesFromB64url(macB64), te.encode(data))
  } catch {
    return false
  }
}

interface TokenBody {
  p: Purpose
  exp: number
  [k: string]: unknown
}

/** Sign a purpose-scoped token: base64url(json).base64url(hmac). Returns null if no secret. */
export async function signToken(purpose: Purpose, claims: Record<string, unknown>, ttlMs: number, now = Date.now()): Promise<string | null> {
  const secret = authSecret()
  if (!secret) return null
  const body: TokenBody = { ...claims, p: purpose, exp: now + ttlMs }
  const payload = b64urlFromString(JSON.stringify(body))
  const sig = await mac(payload, secret)
  return `${payload}.${sig}`
}

/** Verify signature, purpose and expiry. Returns the claims, or null on ANY problem (fail-closed). */
export async function verifyToken(purpose: Purpose, token: string | undefined | null, now = Date.now()): Promise<Record<string, unknown> | null> {
  const secret = authSecret()
  if (!secret || !token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!(await macValid(payload, sig, secret))) return null
  let body: TokenBody
  try {
    body = JSON.parse(stringFromB64url(payload)) as TokenBody
  } catch {
    return null
  }
  if (body.p !== purpose) return null
  if (typeof body.exp !== 'number' || body.exp < now) return null
  return body
}

// ── cookies ──────────────────────────────────────────────────────────────────
export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.get('cookie') || ''
  const out: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

/** Serialize a hardened cookie. `maxAgeMs<=0` clears it. Same-origin PWA ⇒ SameSite=Strict. */
export function serializeCookie(name: string, value: string, maxAgeMs: number): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    maxAgeMs <= 0 ? 'Max-Age=0' : `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  return attrs.join('; ')
}

export function clearCookie(name: string): string {
  return serializeCookie(name, '', 0)
}

// ── the hot-path guard used by every billable endpoint ────────────────────────
export interface SessionInfo {
  deviceId: string
}

/**
 * Validate the session. Browsers present it as the HttpOnly `abu_session` cookie;
 * non-browser callers (CI/acceptance, server-to-server) may present the SAME
 * HMAC-signed token in an `x-abu-session` header. Both require the server secret
 * to forge, so security is identical; the cookie's HttpOnly is an XSS mitigation
 * that only matters in a browser. Returns null on ANY problem (fail-closed).
 */
export async function requireSession(req: Request, now = Date.now()): Promise<SessionInfo | null> {
  const token = parseCookies(req)[COOKIE.session] || req.headers.get('x-abu-session') || undefined
  const claims = await verifyToken('session', token, now)
  if (!claims) return null
  const deviceId = typeof claims.deviceId === 'string' ? claims.deviceId : ''
  if (!deviceId) return null
  return { deviceId }
}

/** Standard 401 for an unauthenticated billable request — asserted BEFORE any provider call. */
export function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'AUTH_REQUIRED' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** True on a Vercel PRODUCTION deployment (VERCEL_ENV=production). Preview/dev are not. */
export function isProduction(): boolean {
  return env().VERCEL_ENV === 'production'
}

/** PRODUCTION requires BOTH secrets; running without them is a misconfiguration that must fail closed. */
export function productionMisconfigured(): boolean {
  return isProduction() && !authConfigured()
}

/**
 * Whether the billable endpoints are gated (require a verified session) OR denied.
 * True when the signing secret is present (enforce) or in production (fail closed).
 * Only a NON-production deployment WITHOUT a signing secret runs open (dev/test).
 */
export function authEnforced(): boolean {
  return authSecret() !== null || isProduction()
}

function serviceUnavailable(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'AUTH_NOT_CONFIGURED' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * The single billable-endpoint guard. Returns a Response to short-circuit the
 * request (BEFORE any provider call), or null to proceed.
 *  • production without BOTH secrets → 503 FAIL-CLOSED (never falls back to open),
 *  • signing secret present → require a valid session (401 otherwise),
 *  • non-production without a signing secret → open (explicit dev/test mode).
 */
export async function guardBillable(req: Request, now = Date.now()): Promise<Response | null> {
  if (productionMisconfigured()) return serviceUnavailable()
  if (authSecret()) return (await requireSession(req, now)) ? null : unauthorized()
  return null
}

// ── WebAuthn relying-party derivation + owner enrollment bootstrap ─────────────
/**
 * The RP id + expected origin for THIS request. rpID is the request hostname (no
 * port); expectedOrigin is the browser's Origin (scheme+host+port). A passkey is
 * bound to the exact origin it was enrolled on — correct for per-deployment RCs.
 */
export function deriveRp(req: Request): { rpID: string; origin: string } {
  const originHeader = req.headers.get('origin') || ''
  let host = req.headers.get('host') || ''
  try {
    if (originHeader) host = new URL(originHeader).host
  } catch {
    /* keep Host header */
  }
  const rpID = host.split(':')[0] || 'localhost'
  const origin = originHeader || `https://${host}`
  return { rpID, origin }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/**
 * Owner-controlled enrollment bootstrap. Registration is refused unless the caller
 * presents the server-only ENROLLMENT_SECRET (never in the client bundle). This is
 * what stops a random internet visitor from self-enrolling as a trusted device.
 */
export function enrollmentSecretOk(provided: string | undefined | null): boolean {
  const expected = env().ENROLLMENT_SECRET
  if (!expected || expected.length < 8 || !provided) return false
  return timingSafeEqual(provided, expected)
}

export function authConfigured(): boolean {
  return authSecret() !== null && (env().ENROLLMENT_SECRET || '').length >= 8
}

/** JSON response that can set multiple hardened cookies (Set-Cookie appended per cookie). */
export function jsonResponse(obj: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(JSON.stringify(obj), { status, headers })
}
