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
  version:    '0.115.0-voice-parity',
  buildLabel: 'AbuBank — VOICE_PARITY (Voice mission — controller parity): voice ↔ typed parity for calendar referability. Both voice input paths (pipeline STT + Realtime) already route through the SAME ExecutiveCognitiveController + shared cognitiveRuntimeStateRef as typed, but they pre-resolved pronouns WITHOUT the calendar-focus guard added in 0.113.0 — so "תבטלי אותה"/"תעבירי אותה" in voice would mis-resolve the pronoun to a gendered last-person (the exact bug fixed for text). Applied the identical hasCalFocus guard to BOTH voice handlers so a pronoun stays RAW under a calendar focus and the runtime resolves it via focus. New voiceReferabilityParity source-contract: all 3 input paths route through the controller, seed from the shared state, and guard the pronoun rewrite. Runtime behaviour proven by calendarReferability + generalization (CODE). Physical voice audibility/latency remains PHYSICAL_DEVICE-only (NOT claimed here). Evidence (CODE): voiceReferabilityParity 4/4; full suite 11002 green; typecheck+build clean. Builds on 0.114.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
