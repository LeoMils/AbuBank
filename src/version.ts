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
  version:    '0.263.0-mishear-suggest',
  buildLabel: 'AbuBank 0.263.0 — DEVICE P0: a misheard name gets a "did you mean…?" instead of a silent decline + a lecture. STT mangled a nickname to "טורקי" and Abu lectured about Turkish coffee, then failed the same lookup again. Fix: suggestClosestPerson — when a name does NOT resolve, offer the closest entity by phonetic+edit similarity (≥0.5) so Abu ASKS "התכוונת ל…?"; if nothing is close it is GARBLE → she says "לא שמעתי טוב, תגידי שוב" and never confirms noise. Wired into people_lookup (who + contact) via a new suggest status; allowed_to_say forbids stating any fact and forbids lecturing about an unrelated meaning of the word. Regression mishearSuggest.test: a one-letter-mangled name suggests that person, garble → null. PARTIAL: the session-level "never repeat the same failed lookup twice" is model/session state, logged open. 275 people tests green. Prior: flag audit (v0.262).',
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
