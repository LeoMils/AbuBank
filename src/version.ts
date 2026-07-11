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
  version:    '0.63.0-realtime-audio-timeout',
  buildLabel: 'AbuBank — REALTIME_AUDIO_TIMEOUT watchdog: if a Realtime response.create receives NO output-audio event within 5s, the attempt is cancelled, classified REALTIME_AUDIO_TIMEOUT, recorded in Evolution (voice_synthesis / fallbackReason), and voiced via pipeline TTS exactly once — never a silent wait. Builds on 0.62.0 audible-voice recovery (Web Speech tier + truthful played + tap-to-hear + playback-proof counter). Voice-runtime repairs from 0.59.1 preserved.',
  buildDate:  '2026-07-12',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
