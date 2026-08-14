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
  version:    '0.237.0-cost-controls',
  buildLabel: 'AbuBank 0.237.0 — COST, the first real number (Item 2). New aiCostModel.ts (real OpenAI Realtime per-minute rates) prices a representative 20-min companion session: BEFORE the O-LIFECYCLE idle-stop the mic streamed the whole call = ~$2.26/₪8.34; AFTER = ~$1.45/₪5.37 — a 35.7% saving, and ONLY idle mic-input minutes are cut (Abu audio output + text are byte-identical, so conversational quality cannot drop — asserted by test). Quality bugs (stalls forcing repeats, repeated formulations) cost ~$0.24/₪0.90 per session on top. New costMeter.ts: a persisted session/day/month counter, a 70%-of-ceiling alert to Leo (once per tier, via the existing sendNotification sink), and at the ceiling a GRACEFUL DEGRADE (cheaper gpt-4o-mini-realtime + shorter replies) that NEVER disconnects Martita and NEVER tells her — the deliberate fix to the old spend guard that cut her off. Mutant cost-ceiling-disconnects-instead-of-degrades KILLED. Headline numbers pinned by tests. Live wiring into WebRTC response.done + mid-session model swap is documented, not rushed (device-class voice path). Evidence: cost tests green + full suite + build. Prior: one voice engine (v0.236).',
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
