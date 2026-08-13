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
  version:    '0.230.0-always-on-invariants',
  buildLabel: 'AbuBank 0.230.0 — O2 always-on deterministic invariants (src/eval/alwaysOnInvariants.test.ts). The A4 invariants were encoded only in the KEY-GATED companion suite, so without OpenAI credits they were not continuously enforced. This drives the SAME cognitive controller typed input uses (runFullTurn / IDLE_RUNTIME) with NO API key, over a deterministic corpus (family identity+in-law, calendar create→save→read, greeting, general knowledge, distress probe), and asserts on EVERY turn: no phone number aloud, no announce-before-answer, no red wine, feminine self-reference. The corpus passes AND the checkers have TEETH (a second test proves each detector fires on a real violation — caught a dead Hebrew-boundary regex that had made no-announce a no-op). Evidence: 2/2 green + typecheck + full suite. Prior: DOM harness (v0.229).',
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
