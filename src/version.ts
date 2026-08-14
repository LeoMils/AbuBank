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
  version:    '0.262.0-flag-audit',
  buildLabel: 'AbuBank 0.262.0 — TRACK 2 flag audit (blocks the merge). Enumerated all 8 flags (docs/eval/FLAG_AUDIT.md): each with its evidence, default, survives-merge status, and what is still missing before default-ON. No flag fails invisibly on a merge anymore — every default is a CODE default (or an env var that defaults to the safe value when unset). ONLINE_DEEP_FETCH (the Preview-only env hazard) is already a code default ON (v0.260). LIVE_PREFETCH_WARM made ENV-flippable (VITE_LIVE_PREFETCH_WARM), default OFF, survives merge — so the owner can A/B it on a Preview like the audio flags; default stays OFF pending the device freshness-vs-latency measurement. Remaining OFF flags (monitor repairs, audio, prefetch) are OFF because their off/on measurement is DEVICE/EAR, not an env hazard. Prior: full-name P0 (v0.261).',
  buildDate:  '2026-08-15',
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
