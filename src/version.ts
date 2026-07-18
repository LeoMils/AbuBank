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
  version:    '0.124.0-flight-recorder-import',
  buildLabel: 'AbuBank — FLIGHT_RECORDER_IMPORT (Cycle 44 — Priority 1: real conversations become permanent tests). Discovery-first: the CAPTURE side already exists and is REUSED not rebuilt — observeTurn (OBSERVE_ONLY) is wired INSIDE ExecutiveCognitiveController so both typed and voice are captured on the one runtime path; buildEnvelope redacts + minimizes (text-only, no audio, PII stripped, dedup); the durable IndexedDB evidence queue is the local store; the off switch is VITE_EVOLUTION_KILL / EvolutionConfig.enabled. The missing link, now built (src/eval/flightRecorderImport.ts): an IMPORTER that turns an exported transcript into a STANDING regression replay. envelopesToExport maps redacted envelopes to a stable text-only JSON (serializeExport/parseExport round-trip, asserted to carry no audio field); importLeoRepro converts docs/eval/LEO_DEVICE_FAILURES_REPRO.json into replay sessions with per-turn expectations derived from the STRUCTURED truth fields (resolvedToGilad, hasLocation, dateTomorrow, verbatimDump) not the stale recorded wording; replayExport runs every recorded turn back through the SAME app entry the marathon/scorecard use and asserts each recorded truth (expectContains/expectAbsent/expectSide) still holds — and CATCHES divergence (a probe asserting a false expectation is reported as a failure, proving no green-washing). Leo 3 real device transcripts now replay green as permanent tests. RED-first: the standing suite was written before the module existed. Evidence: CODE — flightRecorderImport 3/3, evolution + recorded-replay 71/71; full suite + typecheck + build. Voice/Realtime behavior untouched. PREVIEW/PHYSICAL not claimed. Docs: docs/eval/FLIGHT_RECORDER.md. Next: user-facing export button + off-switch toggle wiring. Builds on 0.123.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
