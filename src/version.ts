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
  version:    '0.184.0-live-harness-fixes-rc1',
  buildLabel: 'AbuBank 0.184.0 — LIVE_HARNESS_FIXES_RC1: acted on the text-harness findings. GROUP 1 (stalling): removed the seeded "רגע, בודקת" filler from BOTH the instruction frame (now "# Before a Tool Call": call the tool first, speak only the grounded result, any ack rides with the tool call) AND abu-persona.md. GROUP 2 (over-claim): calendar rules now forbid save-verbs (קבעתי/שמרתי/נקבע) until confirm_calendar_event returns saved:true, and require calling confirm on approval. GROUP 4 (name): abu-persona.md reconciled — Abu uses the name Martita naturally at least once in a long exchange, warm/varied/non-repetitive. Two harness assertion bugs fixed: MASC_SELF drops gender-homographic verbs (רואה/רוצה); the save-claim check is now negation-aware ("לא קבעתי"). Added 3 location-survival scenarios (create+confirm+readback, correct-time-keeps-location, update-location) that expose the device "location dropped on save" bug (LiveEvent gains an optional location the commit path still does not persist). Scenarios 40→43. Evidence: CODE (typecheck 0; harness/instructions tests green) + a real gpt-4o-mini harness run. PHYSICAL_DEVICE NOT claimed.',
  buildDate:  '2026-08-10',
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
