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
  version:    '0.125.0-flight-recorder-ui',
  buildLabel: 'AbuBank — FLIGHT_RECORDER_UI (Cycle 45 — Priority 1 tail: user-facing export + off switch). Settings now has a Flight Recorder control (About/diagnostics area): a senior-first OFF SWITCH toggle for local conversation capture and an EXPORT button that downloads the redacted, text-only transcript. Clean architecture: the pure export shape + serializers moved to a RUNTIME module (src/evolution/recorderExport.ts — envelopesToExport / serializeExport / parseExport / exportStoredTranscript reads the durable evidence queue) so the app bundle never pulls the eval/replay harness; src/eval/flightRecorderImport.ts re-exports them so the shape has ONE source. The off switch (src/evolution/recorderSwitch.ts) persists in localStorage and is read PER-TURN at the single serving seam (observeTurn) so toggling takes effect immediately and can only make capture SAFER (never escalate) — consistent with the Evolution Central Law. RED-first: recorderSwitch.test proved observeTurn kept capturing when off BEFORE the guard was added, then green. Evidence: CODE — recorderSwitch 3/3, recorderExport 3/3, flightRecorderControls 3/3, flightRecorderImport 3/3; full suite + typecheck + build. Voice/Realtime behavior untouched. PREVIEW = deploy + health only. Docs: docs/eval/FLIGHT_RECORDER.md. Builds on 0.124.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
