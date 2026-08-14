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
  version:    '0.255.0-classified-monitor',
  buildLabel: 'AbuBank 0.255.0 — M2 classified checks (heuristic, FP-measured, gated OFF). Three intent-level defects now have detectors: DISTRESS_MENU (distress answered with a capability menu, not warmth + one action), METHOD_NARRATION (narrating its own lookup/method), UNGROUNDED_ENTITY (asserting a person-fact when no grounding tool returned this turn — the Gilad-class risk). classifiedCorpus GENERATES 82 model-free cases (40 engineered defects + 42 warm-correct built to be MISTAKEN for a defect; nothing verbatim from classifiedMonitor.ts). MEASURED: DISTRESS_MENU 30/30, METHOD_NARRATION 6/6, UNGROUNDED_ENTITY 4/4 = 100% interception, 0 FALSE POSITIVES over 42 clean cases; detector latency p95 0.0014ms. Wired into liveSession as OBSERVATION (always emits/logs, cannot block output) with per-turn grounded-tool tracking; the one-attempt classified REPAIR (buildClassifiedRepair) is DOUBLY gated OFF (LIVE_CLASSIFIED_MONITOR && LIVE_OUTPUT_MONITOR_REPAIR) — repair round-trip latency + warmth off/on are DEVICE-gated (API spend), not claimed. Fixed a real latent bug: JS word-boundary anchors are ASCII-only, so a word boundary next to a Hebrew letter never matched. Report: docs/eval/MONITOR_CLASSIFIED_REPORT.md. Prior: lookup cue (v0.254).',
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
