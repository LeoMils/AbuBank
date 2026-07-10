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
  version:    '0.59.0-multilingual-voice-language-policy',
  buildLabel: 'AbuBank — P0 multilingual voice fix: one canonical LanguagePolicyResolver across typed/pipeline-mic/Realtime. STT AUTO-DETECTS per utterance (no more sticky-preference pin that transcribed Hebrew as Spanish); response and TTS follow the detected utterance; Realtime speaks the reply language. Voice state machine adds explicit failure states (no indefinite silent listening). Evolution trace records real input modality and full language chain.',
  buildDate:  '2026-07-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
