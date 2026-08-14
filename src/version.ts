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
  version:    '0.236.0-one-voice-engine',
  buildLabel: 'AbuBank 0.236.0 — ONE VOICE ENGINE (D7): the AbuCalendar screen ran a SECOND speech engine (in-screen mic capture + calendar transcription + a parser action-switch + a voice reminder-confirm branch) that drifted behind Abu AI. Removed it — the calendar mic now routes to Abu AI, the single engine, which creates/reads/modifies appointments and reminders on the SAME AbuCalendar/service store (cognitiveRuntime.createAppointmentSafe, verified via loadAppointments). Retained the pure domain modules (voiceAutoCreate parser, correctionParser, VoiceCard/ConfirmCard, calendarTranscribe, reminders) as library code. Guard: singleVoiceEntry.test.ts (no capture in the calendar path; mic routes to Screen.AbuAI) + a mutation mutant proving teeth. Source-contract tests migrated to the new truth; the 3 named behavior tests stay green. Evidence: typecheck + full suite 12679 green + build. Prior: heartbeat alert (v0.235).',
  buildDate:  '2026-08-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
