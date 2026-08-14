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
  version:    '0.251.0-prefetch-warm',
  buildLabel: 'AbuBank 0.251.0 — M4 prefetch warm store. One user, predictable interests, cinema listings changing about once a day. warmStore.ts caches the high-frequency topics (cinema, weather, headlines, transit) with a per-topic TTL; a matching question is served WARM from cache when fresh (zero network, under 1s) and falls through to the live first-wins fetch on a miss or when stale — a miss is never cached. prefetchWarmTopics warms all four in the background on session open, so a later cinema question is served warm (this also covers the earlier cinema no_answer). Wired into liveSession behind LIVE_PREFETCH_WARM (default OFF — serving cache trades a little freshness for latency; enables after off/on measurement). MEASURED deterministically (warmStore.test 6): a warm+fresh hit makes ZERO network calls (the <1s path); stale/miss/one-off fall through and repopulate; a miss is never cached. STILL TODO in M4: the non-verbal in-flight cue (sound + lookup screen state) — a device/UI item. Gates: typecheck 0, full suite 12,787 passed, build ok. Prior: output monitor (v0.250).',
  buildDate:  '2026-08-14',
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
