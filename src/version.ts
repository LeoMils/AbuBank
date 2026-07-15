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
  version:    '0.79.0-pipeline-default-realtime-beta',
  buildLabel: 'AbuBank — PIPELINE_DEFAULT_REALTIME_BETA: Option C from docs/VOICE_ARCHITECTURE_VERDICT.md. The default voice path was the OpenAI Realtime (WebRTC) path (useRealtime=true), which was never proven on device and whose remote audio element was autoplay-blocked → the real user heard NOTHING. Now the DEFAULT is the reliable pipeline (push-to-talk STT → controller → server TTS via a gesture-unlocked AudioContext, which is proven to produce audio); Realtime is OPT-IN beta (localStorage abu-voice-realtime-beta=1). Also fixed the Realtime audio-out for when beta is on: the <audio> element is now appended to the DOM (not-in-DOM elements are autoplay-blocked) + removed on teardown — DEVICE-GATED (OP-003). Regression voiceModePreference (pipeline is default) + realtimeAudioOut (DOM attach) + updated 11 source-contracts. Builds on 0.78.0 SPANISH_FAMILY_IDENTITY.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
