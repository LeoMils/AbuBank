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
  version:    '0.223.0-companion-quality-suite',
  buildLabel: 'AbuBank 0.223.0 — P9: the companion quality suite, the only honest measure of whether the Companion Brain worked. It runs 9 companion scenarios against the REAL model through the EXACT live instructions + tools + executor (the same runner the harness uses), and scores Abu on companion qualities from her actual Hebrew output and tool calls: identifies a person by name and relationship, describes an in-law path instead of denying a relationship, lists the friend circle, knows a friend story, recalls the history (Mendoza, the store), says she does not know warmly without inventing, never offers red wine, never announces a check before a tool, and handles distress (prepares help, never claims a call). Key-gated and infra-safe: with no key, or when the model is unavailable, it reports BLOCKED and never fakes a pass and never fails the build — the pass-rate floor is asserted only when the model actually produced output. Tonight the measurement is BLOCKED: the OPENAI_API_KEY has no credits (HTTP 429 no credits remaining), so I could not get a real pass rate — the suite is built and green and will print the rate the moment the key is funded (npx vitest run companionSuite.test.ts). Evidence: CODE + AUTOMATED TEST (the suite itself); the companion pass rate is PENDING on a funded key. typecheck + full suite (12,661) + build. Prior: Companion Brain P0-P3 (v0.220), P5 behaviour+safety (v0.221), P8 name matching (v0.222). Remaining: run P9 once funded; P7 online depth; P6 actions polish; P8 429-backoff/audio/one-voice-engine.',
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
