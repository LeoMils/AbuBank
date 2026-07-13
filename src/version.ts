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
  version:    '0.68.0-fragment-ambiguous-hour-parity',
  buildLabel: 'AbuBank — FRAGMENT_AMBIGUOUS_HOUR_PARITY: a fragmented ("drip") create with an AM/PM-ambiguous bare hour ("תקבעי"→"עם מור"→"מחר בשמונה"→"כן") now completes IDENTICALLY to the single-utterance path — the smart layer resolves "בשמונה" to the same default reading and moves to confirm, so a following "כן" SAVES exactly once instead of dead-ending forever in the loop-breaker (typed/voice parity). And a bare period correction ("לא בערב") at confirm now flips AM→PM instead of being lost — tie-break #1, never lose a correction. Builds on 0.67.0 NATURAL_SLOTFILL_CLARIFY.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
