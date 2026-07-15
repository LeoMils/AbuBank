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
  version:    '0.104.0-realtime-audible',
  buildLabel: 'AbuBank — REALTIME_AUDIBLE (Voice mission): the iOS Safari PWA Realtime (WebRTC) beta path is made audible via MUTED-THEN-UNMUTE. The real remote-audio element is primed (created + played muted) INSIDE the tap gesture, the WebRTC stream is attached to it, then it is unmuted (unmuting a playing, user-activated element needs no gesture) — fixing connected-but-silent on iPhone, where an element first played after the token await was autoplay-blocked. Also injects date grounding (Hebrew day/date/time-of-day, Israel TZ) alongside the existing family/calendar/memory facts in buildRealtimeInstructions. Failures stay bounded + honest (REALTIME_AUDIO_TIMEOUT watchdog, onAudioBlocked tap-to-hear, onFatalError → pipeline). Evidence: realtimeAudioOut/full-duplex/watchdog 23 green (CODE); typecheck clean. Device audibility is PENDING-DEVICE (OP-004) — WebRTC + iOS autoplay cannot be proven in jsdom. Builds on 0.103.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
