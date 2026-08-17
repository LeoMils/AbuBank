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
  version:    '0.288.0-earonly',
  buildLabel: 'AbuBank 0.288.0 — FINAL MACHINE-CLOSURE PASS. (1) YARDEN ESCAPE CLASS FIX: spouse-of-descendant in-laws (grandchild-in-law כלה/חתן) are first-class relative to Martita on BOTH paths (shapeFamilyAnswer + describeRelation.detectSpouseOfDescendant); ירדן+גלעד resolve, gendered, no invented relation. (2) 13 red voice/STT tests RESOLVED: classified (stale-after-Groq/Gemini-client-removal) + updated to assert the NEW server-only architecture, not weakened; full suite green. (3) DATED-SEARCH: news/latest-result freshness is now a real GROUNDED+FRESH capability (Tavily published_date / Brave page_age carried to the freshness oracle; answer only ≤21d dated, else decline). Priors: TEMPORAL=GROUNDED+FRESH weather/FX dated APIs; tool-sequencing RAW-EVENT oracle; replacement-path proofs (TTS→STT round-trip). Do NOT merge (production serves an older build; 3 old keys await owner revocation).',
  buildDate:  '2026-08-17',
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
