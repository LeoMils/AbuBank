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
  version:    '0.62.0-audible-voice-recovery',
  buildLabel: 'AbuBank — Audible-voice recovery (Phase A): pipeline TTS now has a Web Speech last-resort tier and returns a truthful played result; a failed playback raises a visible tap-to-hear button that re-speaks the reply; a Realtime per-turn audio failure auto-falls back to pipeline TTS exactly once; playback start is proven by a runtime counter (window.__abuTTSPlayed). No silent text-only success. STT Hebrew language pin + Family Phones import preserved. Voice-runtime repairs from 0.59.1 preserved.',
  buildDate:  '2026-07-12',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
