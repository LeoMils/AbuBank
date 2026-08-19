/*
 * Session lifecycle policy (O-LIFECYCLE) — the single source of truth for what an
 * idle live session does, as a PURE deterministic reducer (easy to test, easy to
 * mutation-cover). The realtime session drives it each tick with the current clocks;
 * this module owns the WHAT (thresholds + warm copy + the never-close-mid-task law),
 * never the HOW (no timers, no audio, no I/O here).
 *
 * The brief's contract:
 *   ~12s silence → stop streaming the mic upstream (an idle session must stop costing money)
 *   ~25s silence → Abu asks ONCE, warmly: "את שם?"
 *   ~45s silence → a warm goodbye, and close
 *   NEVER close (or interrupt) mid-task — the most important rule
 *   ~20 min of a live session → ONE warm outward suggestion, never nagging
 *   one tap resumes with the thread intact → the caller resets the silence clock;
 *   conversation state is never discarded here (see onUserActivity).
 */
export const LIFECYCLE = {
  STOP_UPSTREAM_MS: 12_000,        // ~12s → stop streaming mic upstream (cost)
  ASK_PRESENCE_MS: 25_000,         // ~25s → ask once warmly
  GOODBYE_MS: 45_000,              // ~45s → warm goodbye + close
  OUTWARD_NUDGE_MS: 20 * 60_000,   // ~20 min → one warm outward suggestion
} as const

export type LifecycleAction =
  | 'none' | 'stop-upstream' | 'ask-presence' | 'warm-goodbye' | 'outward-nudge'

export interface LifecycleInput {
  /** ms since the last user activity (speech/tap/typing). Reset on activity. */
  silenceMs: number
  /** ms since the live session opened. */
  sessionAgeMs: number
  /** a pending create/confirm/tool is in flight — NEVER close or interrupt. */
  midTask: boolean
  /** already asked "את שם?" during THIS idle stretch (reset on activity). */
  askedPresence: boolean
  /** already gave the one 20-minute outward suggestion this session. */
  nudgedOutward: boolean
}

export interface LifecycleDecision {
  action: LifecycleAction
  /** warm Hebrew line to speak, when the action has one. */
  speak?: string
  /** whether this decision closes the session (only ever the warm goodbye). */
  closes: boolean
}

// Warm, feminine, senior-appropriate copy (never patronizing — see emotional-accuracy).
const PRESENCE_HE = 'את שם, מתוקה? אני כאן.'
const GOODBYE_HE = 'אני נחה רגע. תגעי במסך כשבא לך ואני חוזרת מיד.'
const OUTWARD_HE = 'אולי שווה להתקשר למור? היא תשמח לשמוע אותך.'

/**
 * Decide the single lifecycle action for the current tick. Deterministic and total.
 * Order encodes priority: the never-close-mid-task law first; then the outward nudge
 * only while actively conversing; then the silence ladder (goodbye → ask → stop).
 */
export function lifecycleDecision(i: LifecycleInput): LifecycleDecision {
  // 1) NEVER close or interrupt mid-task — the most important rule.
  if (i.midTask) return { action: 'none', closes: false }

  // 2) One warm outward suggestion at ~20 min, but ONLY while she is actively there
  //    (not deep in silence) and only once — never nagging.
  if (i.sessionAgeMs >= LIFECYCLE.OUTWARD_NUDGE_MS && !i.nudgedOutward
      && i.silenceMs < LIFECYCLE.STOP_UPSTREAM_MS) {
    return { action: 'outward-nudge', speak: OUTWARD_HE, closes: false }
  }

  // 3) Silence ladder.
  if (i.silenceMs >= LIFECYCLE.GOODBYE_MS) {
    return { action: 'warm-goodbye', speak: GOODBYE_HE, closes: true }
  }
  if (i.silenceMs >= LIFECYCLE.ASK_PRESENCE_MS && !i.askedPresence) {
    return { action: 'ask-presence', speak: PRESENCE_HE, closes: false }
  }
  if (i.silenceMs >= LIFECYCLE.STOP_UPSTREAM_MS) {
    return { action: 'stop-upstream', closes: false }
  }
  return { action: 'none', closes: false }
}

/**
 * On any user activity the session resets its silence clock and the once-per-stretch
 * "asked presence" flag. Conversation state (the thread) is deliberately NOT part of
 * this — a resume keeps the thread intact; only the idle clocks reset.
 */
export function onUserActivity(): Pick<LifecycleInput, 'silenceMs' | 'askedPresence'> {
  return { silenceMs: 0, askedPresence: false }
}
