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
  version:    '0.64.0-durable-flush-on-hide',
  buildLabel: 'AbuBank — DURABLE_FLUSH_ON_HIDE: in-flight durable (IndexedDB) writes are now tracked and flushed on pagehide / visibilitychange-hidden, so a just-created appointment, reminder, or family contact cannot be lost if the PWA is backgrounded or killed before the async write settled and the localStorage mirror is later evicted (iOS data-loss gap closed). Builds on 0.63.0 REALTIME_AUDIO_TIMEOUT watchdog.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
