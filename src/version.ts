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
  version:    '0.269.0-layer2-screens-gates',
  buildLabel: 'AbuBank 0.269.0 — MERGE BLOCKER 1c (screens) + 2 (gates). SCREENS: e2e/screen-invariants.spec is a REAL browser harness against a production Preview — Home + Settings render with RTL, key text >=16px, and NO QA/dev text (the DEV-gated "QA: v" badge is correctly absent; a global prod invariant for all screens); 13 screens per-nav is the mechanical remainder. GATES RUN: rc:verify quality gates PASS (aToC/provider/enlargedText/privacy) — its 2 blockers are the intentional non-promotion (health 0.179 alias, we are NOT promoting); qa:production-gate FAILS only on rows needing PHYSICAL_DEVICE/PRODUCTION_ADAPTER evidence (VOICE-QUALITY-LIVE etc. — the ear remainder, not a code defect); NO mutation gate is configured (no Stryker) — reported, not skipped silently. Cell coverage 87.8% -> 89.0%. NOT merge-ready: 13 screens nav + mutation-gate setup + device/ear rows remain (MERGE_READINESS.md). Prior: event invariants + repeat-guard (v0.268).',
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
