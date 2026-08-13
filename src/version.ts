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
  version:    '0.220.0-companion-brain-portrait',
  buildLabel: 'AbuBank 0.220.0 — THE COMPANION BRAIN (Phase 3): Abu now HOLDS her family in her head instead of looking them up. The insight: retrieval made her a clerk who truthfully announces she is about to check. The old 10,000-char instructions cap was a MISDIAGNOSIS — measured against the real provider, session.instructions accepts AT LEAST 200,000 chars (the device crash was the 1024-char transcription prompt, never instructions). So a warm PROSE portrait of everyone durable now lives in the instructions, GENERATED from the data files (familyPortrait.ts): the closest circle in full warmth, the extended family and the Papi side a line each, the friends (so who-are-my-friends finally has a warm answer), the life history as story, and the shape of what is unknown. Adding a person stays a data-only edit — proven by a test that adds a person and finds them in the assembled context. people_lookup stays but only to REACH someone for an action or to double-check; the model no longer looks up who family is. Cap raised 10,000 to 60,000 (about 3x the real ~21k assembled size, far under the 200k limit). Verified: the real provider accepts the full Companion-Brain session payload (instructions 21,393 chars) with HTTP 200. Evidence: CODE + AUTOMATED TEST + PREVIEW (real-API 200); typecheck + full suite (12,640) + build. Prior in this branch: FIX 1/2/4/7/5/3 (v0.215-0.219). Next: P4 relationships + lists, P5 friend behaviour, P6 actions, P7 online depth, P8 reliability, P9 companion suite.',
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
