/*
 * AbuBank — build identity. Single source of truth for the visible version
 * label, branch hint, and operator-readable build name. Imported by main.tsx
 * (startup console.info) and by Settings/About (visible badge).
 *
 * IMPORTANT
 * - This is a build-identity surface, NOT a feature flag.
 * - Do not store secrets, tokens, or private data here.
 * - Bump `version` and `buildDate` each time a new operator-testable build ships.
 * - The package.json semver is exposed separately as `import.meta.env.VITE_APP_VERSION`.
 */

export const APP_VERSION = {
  appName:    'AbuBank',
  version:    '0.221.0-companion-behaviour-and-safety',
  buildLabel: 'AbuBank 0.221.0 — P5: Abu BEHAVES like a friend, and is safe. Built first, because it is safety not polish: a prominent DISTRESS protocol that overrides every other rule — if Martita says she fell, is in pain, unwell, frightened or that something is wrong, Abu stays calm, does not diagnose or minimise, immediately prepares a call to Leo (phone_call), and for a real emergency (chest pain, a fall, trouble breathing) also tells her clearly to call מד״א 101 herself, never claims a call was made, and STAYS WITH HER — grounding her (where are you, can you sit down, is the door open) until she is calm or someone is there. A standing safety guard (companionSafety.guard.test.ts) fails the build if the distress protocol or the invariants regress: residence is not live location, no medical or financial details kept or advised, she draws Martita toward real family rather than into dependency, and she never claims an action a tool has not confirmed. Plus the friend behaviours: she brings things up unprompted (rate-limited, never nagging), connects sideways (food to gefilte fish, Tuesday is Mor day, wine is never red), is warm without performance, softens into a gentle mode when Martita repeats herself or is confused, and after two failed understandings offers a concrete action instead of a third rephrase. Second pass added the grounding cue to the distress protocol after a self-review found it escalated before steadying her. Evidence: CODE + AUTOMATED TEST (deterministic guards; the real-model behaviour is P9). typecheck + full suite (12,653) + build. Note: the brief asked for specialist agents, but the checked-in V4 rule mandates one foreground writer with no subagents, so I stayed the sole writer and self-reviewed. Prior: Companion Brain P0-P3 (v0.220). Next: P6 actions, P7 online depth, P8 reliability, P9 companion suite.',
  buildDate:  '2026-08-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
