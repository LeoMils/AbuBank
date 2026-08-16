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
  version:    '0.286.0-earonly',
  buildLabel: 'AbuBank 0.286.0 — GOLDEN-SESSION. Device round 4: THREE P0 wrong-answers fixed. TIME is injected into the session and answered directly — no tool call, no more datacenter clock; the golden turn now asserts expectTool none. GRAPH: generational kinship terms are derived (Martin is Martita great-nephew = בן האחיין, not great-grandson of her mother); long chains 435->0, at most two hops, never routed through Martita; a human-authored matrix oracle + a kinship-audit diagnostic. CACHE: a specific-item or follow-up query (a film plot or cast) now MISSES the topic cache and fetches live — it was returning the whole cinema listing. Priors: online judge-gated (no garbage), relationships are the kinship TERM not a path, her own name resolves on every spelling, barge-in mutes local playback, the tool-result watchdog re-arms on progress. Open (device): forced-response clean-path no-speak, machinery narration, unprompted opening. Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
