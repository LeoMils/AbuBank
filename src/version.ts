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
  version:    '0.54.0-voice-text-brain-unification',
  buildLabel: 'AbuBank — AbuAI voice=text brain unification: the mic transcript routes through the SAME ExecutiveCognitiveController as typed text (family/calendar/online/memory); Realtime = STT+TTS transport, brain answers; Product Truth proves BRAIN_PIPELINE_USED',
  buildDate:  '2026-07-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
