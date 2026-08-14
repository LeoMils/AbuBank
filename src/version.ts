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
  version:    '0.246.0-online-depth',
  buildLabel: 'AbuBank 0.246.0 — A (online DEPTH, price half): first-wins PAGE fetch so the perfume query returns a REAL price. The online path spoke from a search SNIPPET (a title + one-line description), which rarely carries a price — so "כמה עולה בלו דה שאנל" returned stores and "go check", never a number. New shared module firstWins.ts fetches the top result PAGES in parallel, extracts readable text, and speaks from the FIRST page that actually contains the answer (a real price token), aborting the losers, within a 4s soft / 6s hard budget (below the ceiling it returns what is known). Used by the eval instrument (firstWinsOnlineFetch) and, behind the default-OFF ONLINE_DEEP_FETCH flag, by the live endpoint api/abuai-online — device activation is one Vercel env step (like ONLINE_PROVIDER); with the flag off the endpoint behaves exactly as before and all its tests are unchanged. Never worse than the snippet: page content is used ONLY when a page truly contained the answer (hadAnswer), else the snippet stands (this protects the cinema case). Also fixed the instrument ttft to mean first SPOKEN token, not first event. MEASURED on the real gpt-realtime instrument: perfume BEFORE no price → AFTER "בערך 597 שקלים… 499… 749" (ttft ~3.0s, total ~3.8s, within the 4s budget); cinema unchanged via the snippet fallback. firstWins.test (8) locks winner/abort/ceiling/price-gate. STILL TODO in A: the prefetch warm-store (<1s for a prefetched topic) and the non-verbal in-flight cue. Prior: family portrait removed, relations ground on the resolver (v0.245).',
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
