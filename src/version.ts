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
  version:    '0.282.0-earonly',
  buildLabel: 'AbuBank 0.282.0 — ONE EAR BUILD: all four device-gated audio flags ship ON in a single A/B build (LIVE_AUDIO_TUNE_V2 + LIVE_BARGE_IN_TRUNCATE + LIVE_PREFETCH_WARM + LIVE_CLASSIFIED_MONITOR) plus the preamble fix; EAR_CHECK.md is four items in five minutes. FIX CLASSES not instances (CLASS_AUDIT.md): whoIs no longer speaks a raw relationship hop chain (class C); the one dark flag without a promotion criterion, classified-monitor, now has one and is machine-enforced (class B); family answers may be WARM and add one true known detail, still grounded (class F). GOLDEN-SESSION 18/18. Companion score now runs BESIDE it: heuristic 100/100, gpt-4o-mini judge 90/100 (golden correctness 18/18) — she reads as a warm friend, not an assistant. REACHABILITY_LIST.md lets the owner confirm contacts in one pass; flagged a data gap (Dora/Jacobo appear living). Only outstanding = the four EAR items on the phone. Do NOT merge (production serves Aug 5).',
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
