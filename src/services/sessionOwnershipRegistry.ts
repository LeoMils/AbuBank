/*
 * SESSION OWNERSHIP REGISTRY (ADR-0001 §5 — one live voice runtime).
 * ════════════════════════════════════════════════════════════════════════════
 * A deterministic module-level registry that enforces EXACTLY ONE active
 * RealtimeVoiceSession (and therefore one peer connection / data channel / mic
 * stream / remote track / audio element, since each session owns one of each and
 * drains them on release). This is NOT a counter: acquiring ownership DRAINS the
 * previous owner first (detach-before-replace), and a stale release (from a
 * superseded session after reconnect/rerender) is REJECTED. Wired into
 * RealtimeVoiceSession.connect() (acquire) and cleanup() (release).
 */

interface Owner { token: number; drain: () => void }

let active: Owner | null = null
let seq = 0

/** A unique ownership token per session instance. */
export function nextSessionToken(): number { seq += 1; return seq }

/**
 * Acquire the single live-session slot for `token`. If a DIFFERENT owner holds it,
 * that owner is DRAINED first (its cleanup runs) so there is never a parallel live
 * session/track/audio element. Idempotent for the same token.
 */
export function acquireSession(token: number, drain: () => void): { replacedPrevious: boolean } {
  let replaced = false
  if (active && active.token !== token) {
    try { active.drain() } catch { /* draining the old owner is best-effort */ }
    replaced = true
  }
  active = { token, drain }
  return { replacedPrevious: replaced }
}

/** Release ownership — ONLY the current owner may release (a stale release is rejected). */
export function releaseSession(token: number): boolean {
  if (active && active.token === token) { active = null; return true }
  return false
}

export function isActiveOwner(token: number): boolean { return !!active && active.token === token }
export function activeSessionCount(): number { return active ? 1 : 0 }

/** Test hook — reset the singleton between tests. */
export function _resetSessionOwnershipForTests(): void { active = null; seq = 0 }
