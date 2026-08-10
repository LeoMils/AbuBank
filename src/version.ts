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
  version:    '0.183.0-live-default-rc1',
  buildLabel: 'AbuBank 0.183.0 — LIVE_DEFAULT_RC1: the home Abu AI tile now opens the LIVE path (default and only Abu AI); ?live=1 requirement removed; legacy AbuAI screen survives only via ?legacy=1; the live overlay shows BUILD_ID in the corner so a screenshot proves the build. New TEXT-MODE conversation harness (src/services/textHarness): drives the SAME buildSessionUpdate instructions, the SAME liveTools registry and the SAME turn/response lifecycle as the voice path (proven by sharedConstruction.test.ts), with typed Hebrew input and no audio; 40 seed scenarios, six assertion families (tool-before-speech, no stalling, persisted-state-matches-claim, name-in-long-convo, no-capability-without-tool, Hebrew/feminine/no-English), wired into qa:production-gate as an informational report that prints the exact build-time instructions + the abu-persona/family/knowledge word counts. Model driver is real-OpenAI when a key is present, else BLOCKED (never faked). No failing scenario was fixed in this milestone — failures are made visible only. Evidence: CODE (typecheck 0; harness + entry-point tests). PHYSICAL_DEVICE NOT claimed.',
  buildDate:  '2026-08-10',
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
