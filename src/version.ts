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
  version:    '0.260.0-general-search',
  buildLabel: 'AbuBank 0.260.0 — ONE GENERAL online search loop, no per-topic gates. Deleted the price-specific relevance gate (isPriceQuery/priceNearProduct/price-token extraction) and replaced the per-intent patchwork with a general agentic loop (generalSearch.ts): SEARCH → FETCH pages first-wins → a CHEAP MODEL JUDGES+SYNTHESIZES one clean answer (no type heuristic) → REFINE the query once if it misses (budget permitting) → HONEST no_answer instead of a dump. synthesize.ts generalized to every question kind; firstWins.ts de-priced to a general content screen. Wired into the live tool (firstWinsFetch) + the endpoint (abuai-online). ACCEPTANCE (63 diverse he/es questions, real Brave+fetch+gpt-4o-mini): PASS 55/63 = 87.3%, 0 hard fails, 0 source-name leaks, 8 honest misses (JS-rendered listings / live widgets); latency p50 2180ms p95 5237ms max 5622ms (all in the 6s ceiling — a synth-time reserve keeps fetch+judge under budget). Never worse than the snippet MEASURED: OFF-only 0, ON-only 2. ORACLE LIMIT stated: pass = a real answer of the requested KIND, no source named, in budget — the VALUE is not asserted (no oracle). ONLINE_DEEP_FETCH moved from a Preview env var to a CODE flag (flags.ts) DEFAULT ON (survives a merge); prefetch warm default OFF pending device measurement. Report docs/eval/ONLINE_ACCEPTANCE.md. Prior: source gaps (v0.259).',
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
