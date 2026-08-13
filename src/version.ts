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
  version:    '0.226.0-mutation-online-privacy-guards',
  buildLabel: 'AbuBank 0.226.0 — Phase M expanded to 7 deterministic mutants + a negative control. The online honesty gate KILLED (the World-Cup incident is guarded: zero web_search sources ⇒ ONLINE_NO_RESULTS, never a fabricated answer surfaced as ok:true). A second real survivor closed: the Israeli-ID (9-digit) PII mask in redaction was UNTESTED — disabling it passed the whole suite — now locked by red-before-green assertions (ID ⇒ [id], raw digits gone; long run ⇒ [number]). Kill rate 100% (7/7), control never mis-fired; every mutant restores its file in finally. docs/warroom/ carries the coverage matrix and the honest empty cells (App/Platform/Journey mutation not yet seeded; model-instruction P0s like distress are out of deterministic scope). Evidence: harness 7/7 + typecheck + full suite + build. Prior: label-guard (v0.225).',
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
