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
  version:    '0.256.0-scope-inventory',
  buildLabel: 'AbuBank 0.256.0 — deferred QA build-out: cell-level SCOPE off zero. scopeInventory.ts derives the acceptance SCOPE MECHANICALLY from the code (LIVE_TOOL_SCHEMAS, Screen enum, family_data.json, liveSession event switch) — not a hand list that could drift, so a tool/screen/event added there appears automatically. Enumerated: 17 tools · 30 param cells · 35 failure paths · 15 screens · 19 realtime event types · 65 entities (4160 ordered pairs, covered by relationMatrix.test) · 6 declared-unbuilt capabilities. Layer-1 CONTRACT cells EXECUTED (valid types, non-empty descriptions, required⊆properties, unknown-param rejection additionalProperties:false, well-formed enums): 97/97 pass. Cell-level ledger seeded: 172 cells, 97 executed (56.4%); the rest are Layer-2 (failure-path behaviour via generated args, every screen via a browser harness, realtime-event invariants) and Layer-3 (unbuilt-capability declines) not_run — the next work, named. Reports: docs/eval/SCOPE_INVENTORY.json + .md. Prior: classified checks (v0.255).',
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
