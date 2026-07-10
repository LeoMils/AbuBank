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
  version:    '0.59.1-iphone-voice-runtime-repair',
  buildLabel: 'AbuBank — iPhone voice runtime repair: Realtime event contract updated to current OpenAI names (response.output_audio.*) with legacy fallback + unknown-event recording; transcription failure becomes explicit (no silent listening); shared realtime model constant (no drift); output audio play() awaited with a tap-to-play recovery; mic-track liveness checked. On-device Voice Flight Recorder (28 stages) + "העתקת אבחון קול" button makes the next iPhone test observable. NOT device-proven yet.',
  buildDate:  '2026-07-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
