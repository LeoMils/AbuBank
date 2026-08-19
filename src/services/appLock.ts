/*
 * appLock.ts — the premium entry gate's session-lock policy + local PIN.
 * ════════════════════════════════════════════════════════════════════════════
 * PURE where it matters: `decideEntry()` is a side-effect-free function so the
 * intro / auth / re-lock rules are unit-testable without a DOM. Storage helpers
 * are thin, guarded wrappers (private mode / SSR safe). Nothing here throws to
 * the caller — the gate is fail-OPEN by design (a broken lock never bricks the
 * app; it just means "no protection").
 *
 * Security note: this is a LOCAL device unlock for a no-account PWA, not network
 * auth. The PIN is stored only as a salted SHA-256 digest (never plaintext), and
 * biometrics use the platform authenticator (see biometricAuth.ts) — no custom
 * face recognition, no secrets, no server.
 */

/** Resume within this window → skip intro AND auth (feels instant, not annoying). */
export const RESUME_SKIP_MS = 60_000
/** Away in background at least this long → require biometric/PIN again (no intro replay). */
export const RELOCK_AFTER_MS = 5 * 60_000

const CONFIG_KEY = 'abu-lock-config-v1'
const WARM_KEY = 'abu-entry-warm-v1'        // sessionStorage: set once this app session is unlocked
const HIDDEN_AT_KEY = 'abu-entry-hidden-at-v1' // sessionStorage: epoch ms the app was last hidden

export interface LockConfig {
  /** True once the user has enabled ANY protection (PIN and/or biometric). */
  protectionEnabled: boolean
  /** True once a platform biometric credential is enrolled (see biometricAuth). */
  biometricEnrolled: boolean
  /** Salted SHA-256 PIN digest (hex) + its salt. Absent = no PIN set. */
  pinHash?: string
  pinSalt?: string
  /** True once the one-time "Protect Abu Ela" setup card has been shown/dismissed. */
  setupPromptSeen: boolean
}

const DEFAULT_CONFIG: LockConfig = {
  protectionEnabled: false,
  biometricEnrolled: false,
  setupPromptSeen: false,
}

export interface EntryDecision {
  /** Play the cold-open handwritten intro. */
  showIntro: boolean
  /** Require biometric/PIN before revealing the app. */
  requireAuth: boolean
  /** Offer the one-time opt-in protection setup (first run only). */
  offerSetup: boolean
}

/**
 * The one rule that governs the entry experience. Pure — no storage, no DOM.
 *
 * - Cold launch always shows the intro. It requires auth only if protection is
 *   enabled; on the very first run it instead offers (skippable) setup.
 * - A resume never replays the intro. It re-locks only when protection is on AND
 *   the app was backgrounded past the inactivity threshold.
 */
export function decideEntry(input: {
  coldLaunch: boolean
  config: LockConfig
  awayMs: number | null
}): EntryDecision {
  const { coldLaunch, config, awayMs } = input
  if (coldLaunch) {
    return {
      showIntro: true,
      requireAuth: config.protectionEnabled,
      offerSetup: !config.protectionEnabled && !config.setupPromptSeen,
    }
  }
  const requireAuth =
    config.protectionEnabled && awayMs !== null && awayMs >= RELOCK_AFTER_MS
  return { showIntro: false, requireAuth, offerSetup: false }
}

// ── storage (all guarded; degrade to defaults) ──────────────────────────────

export function readLockConfig(): LockConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<LockConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function writeLockConfig(patch: Partial<LockConfig>): LockConfig {
  const next = { ...readLockConfig(), ...patch }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
  } catch {
    /* private mode — protection simply won't persist */
  }
  return next
}

// ── session warmth + away-time (sessionStorage: dies on a true cold launch) ──

export function isSessionWarm(): boolean {
  try {
    return sessionStorage.getItem(WARM_KEY) === '1'
  } catch {
    return false
  }
}

export function markSessionWarm(): void {
  try {
    sessionStorage.setItem(WARM_KEY, '1')
  } catch {
    /* ok */
  }
}

export function recordHidden(now: number): void {
  try {
    sessionStorage.setItem(HIDDEN_AT_KEY, String(now))
  } catch {
    /* ok */
  }
}

/** ms since the app was last hidden, or null if we never recorded a hide. */
export function readAwayMs(now: number): number | null {
  try {
    const raw = sessionStorage.getItem(HIDDEN_AT_KEY)
    if (!raw) return null
    const then = Number(raw)
    if (!Number.isFinite(then)) return null
    return Math.max(0, now - then)
  } catch {
    return null
  }
}

// ── local PIN (salted SHA-256; never plaintext) ─────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSaltHex(): string {
  try {
    const a = new Uint8Array(16)
    crypto.getRandomValues(a)
    return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Non-crypto fallback keeps the salt non-empty; PIN is a local convenience gate.
    return 'x'.repeat(32)
  }
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

/** Persist a new PIN (enables protection). Returns false if hashing is unavailable. */
export async function setPin(pin: string): Promise<boolean> {
  try {
    const salt = randomSaltHex()
    const pinHash = await hashPin(pin, salt)
    writeLockConfig({ pinHash, pinSalt: salt, protectionEnabled: true })
    return true
  } catch {
    return false
  }
}

export function hasPin(): boolean {
  const c = readLockConfig()
  return Boolean(c.pinHash && c.pinSalt)
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const c = readLockConfig()
    if (!c.pinHash || !c.pinSalt) return false
    const h = await hashPin(pin, c.pinSalt)
    return h === c.pinHash
  } catch {
    return false
  }
}
