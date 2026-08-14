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
  version:    '0.250.0-output-monitor',
  buildLabel: 'AbuBank 0.250.0 — M2 output monitor (deterministic). The realtime audio path streams speech directly, so there is no pre-delivery interception point (BRIEF_AUDIT); the design is a POST-TURN monitor + one-attempt next-turn repair. Deterministic detectors (zero false-positive): language script purity, response length, a named source/URL, reading back on-screen text, and literal count (asked 1-5, counted 0-5). monitorTurn runs after every live turn as OBSERVATION (logged; onMonitorViolations callback) with ~0ms added latency and no change to output. A HARD violation (wrong language, named source, wrong count) stashes ONE corrective redo fired on response.done when the wire is free, gated behind LIVE_OUTPUT_MONITOR_REPAIR (default OFF) — pending device measurement, since the audio already played and a redo is an audible self-correction. MEASURED: outputMonitor.test 9 (each detector fires on the real device defect, silent on a good answer); interception on the instrument 0/5 real turns (the root-cause fixes already produce clean output — the monitor is the standing net + the interception-rate signal). Classified checks (distress-to-menu, method narration, invented entity) are deferred until their false-positive rate is measured. Gates: typecheck 0, full suite 12,781 passed, build ok. Prior: online relevance + synthesis (v0.249).',
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
