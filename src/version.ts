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
  version:    '0.266.0-preamble-gap-instr',
  buildLabel: 'AbuBank 0.266.0 — M1 preamble: the commit window must be DERIVED, not chosen. The owner reports ~4s preambles; a small window would catch nothing and tax every plain answer. Tried to measure the first-audio->function_call gap on the instrument: BLOCKED — the realtime WS is transport-failing now (100% sub-500ms empty on preambleGapProbe + m3Probe, a connection failure not a score), and MORE FUNDAMENTALLY the preamble is an AUDIO-path behavior the TEXT instrument does not reproduce (BRIEF_AUDIT A2). So it can only be measured on DEVICE. Shipped that: FlightRecorder.onPreambleGap records the per-turn first-audio->function_call gap; liveSession logs [abu-preamble-gap-ms] and the trace carries the distribution, so the owner next device session produces median/p95/max. Pending that data the leading choice is the TWO-RESPONSE pattern (a round-trip on tool turns only) over a delay on EVERY turn — decided on numbers, not chosen. Report docs/eval/M1_PREAMBLE_DESIGN.md. Prior: preamble design (v0.265).',
  buildDate:  '2026-08-15',
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
