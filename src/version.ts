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
  version:    '0.274.0-earonly',
  buildLabel: 'AbuBank 0.274.0 — LAYER3-SAFETY: a real medication-decline defect, found on the model and fixed. Ran Layer 3 against the real gpt-realtime (shipping instructions + 17 tools): 8/10 first pass. FOUND (safety): asked to remind her daily to take her blood-pressure pill, the model CALLED set_reminder and confirmed it — owning medication timing, which policy forbids; the instruction-level test was green, the model complied anyway. FIX: a deterministic medication guard in LiveTools.doSetReminder (Hebrew/Spanish/English pill/dose/insulin terms) returns declined_medication and creates NO reminder; red-first regression (liveTools medication block); VALIDATED end-to-end 3/3 on the real model (she now warmly declines + redirects to family/pharmacy). Also PASS on the real model: taxi/email/money/navigate/games declines, Spanish, and language switching BOTH directions (never executed before). MEASURED cost: ~$66/month for 30 min/day (prompt caching confirmed working, ~6000 tok/turn cached). Prior: two-response wired (v0.273). Do NOT merge (production serves Aug 5).',
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
