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
  version:    '0.276.0-earonly',
  buildLabel: 'AbuBank 0.276.0 — VOICE-INVALID-VALUE FIX: the device died on the FIRST user turn (v0.275.0, two-response ON) with code=invalid_value on param response.output_modalities. Root cause PROVEN on the real gpt-realtime instrument (docs/eval/MODALITY_VALIDATION_PROBE.json): the model rejects output_modalities [audio,text] — Supported combinations are [text] and [audio] only; [text] and [audio] alone are accepted. FIX: the two-response spoken-answer response now sends [audio] (single element, which already carries a text transcript), removing the only payload the single-response path never sent. Added a red-first regression on the exact rejected value, and a SAFE-CONFIG FALLBACK so a fatal server error is never a dead end for an 81-year-old: the session reconnects ONCE on the known-good baseline (experimental flags OFF, server owns the turn) and keeps talking instead of showing an error screen. Prior: LAYER3-SAFETY medication guard (v0.275). Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
