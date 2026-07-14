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
  version:    '0.76.0-ios-whisper-stt-watchdog',
  buildLabel: 'AbuBank — IOS_WHISPER_STT_WATCHDOG: the P0 voice fix (device-gated, PENDING on-device verification via OP-003). Device root cause (docs/DEVICE_P0_ROOT_CAUSE.md): on iOS the primary STT webkitSpeechRecognition could start and fire NO events, hanging "מקשיבה..." forever. Fix: (1) on iOS, skip the flaky Web Speech and use the Whisper (MediaRecorder→Groq, audio/mp4) path as primary; (2) a listening WATCHDOG (LISTEN_WATCHDOG_MS) so any stall aborts and falls back instead of hanging forever — a bounded fallback per .claude/rules/voice.md. Pure decision layer in src/services/sttStrategy.ts (unit-tested); the actual iOS mic capture + audible TTS is still DEVICE-GATED (not proven in code). Builds on 0.75.0 ONLINE_GROUNDING_GATE.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
