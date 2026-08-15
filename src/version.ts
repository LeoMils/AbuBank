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
  version:    '0.270.0-earonly',
  buildLabel: 'AbuBank 0.270.0 — DECLARE EAR-ONLY. (1) ALL 15 screens: e2e/screen-invariants.spec drives every screen via a ?screen= diagnostic param on a real browser vs a production preview — 15/15 render with RTL, >=16px heading, and NO QA/dev text in the prod build. (2) MUTATION GATE: found the repo own harness (scripts/mutation-harness.mjs — NOT Stryker), extended it +8 mutants covering the code added since (subsetResolve fabrication guard, mishear floor, repeat-lookup guard, oversized-arg bound, output+classified detectors, general search loop, preamble gate); ran it — 30/30 mutants KILLED (100%), control OK. Cell coverage 89.0% -> 96.5% (the 6 not_run are Layer-3 model-behaviour declines = device/ear). Every non-device row is GREEN; the ONLY remaining work is the 6 PHYSICAL_DEVICE/PRODUCTION_ADAPTER production-gate rows + AUDIO_CHECK.md — enumerated in MERGE_READINESS.md. Do NOT merge (production serves Aug 5). Prior: screens+gates (v0.269).',
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
