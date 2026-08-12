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
  version:    '0.212.0-connect-failure-diagnosable',
  buildLabel: 'AbuBank 0.212.0 — Abu AI connection failures are now diagnosable, not a blind "try again". A failed connect shows the SPECIFIC reason in plain Hebrew (connectionReasonHe): server key missing/invalid (OPENAI_API_KEY), no network, microphone permission denied, quota, or provider error — and mic-permission errors are classified separately instead of a generic connect error. The flight recorder now logs the connection attempt + its failure reason (onConnectAttempt / onFailure / onConnectOk), so a session that never connects STILL produces a downloadable trace whose CONNECTION section leads with why. Diagnosis: the recent ONLINE_PROVIDER/version work did NOT touch api/realtime-token.ts or the token path; running the real mint locally with the real key succeeds (gpt-realtime-2.1, ephemeral secret minted) — so a deployed failure is an ENV issue (OPENAI_API_KEY not present for that Vercel environment / the deploy predates it), not a code regression. Evidence: CODE + AUTOMATED TEST (liveSession + liveTrace regressions; full suite 12390 green; real local mint verified).',
  buildDate:  '2026-08-11',
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
