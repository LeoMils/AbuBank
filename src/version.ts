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
  version:    '0.249.0-online-relevance',
  buildLabel: 'AbuBank 0.249.0 — M4 online: relevance gate + synthesis. Two device defects: (1) the hadAnswer gate checked for ANY currency token, so a store pricing a hundred perfumes passed a Chanel question and returned Clive Christian / Fugazzi prices; (2) the tool handed the realtime model a RAW page dump (cart text, filter counts, marketing copy). Fix (1) RELEVANCE: firstWins requires a price token NEAR a discriminating product term from the query (priceNearProduct) — a page pricing something else is a MISS. Fix (2) SYNTHESIS: synthesizeAnswer sends the fetched text + the original query to a cheap model and returns ONE clean sentence about the QUERIED product, or no_answer — never a raw dump, never a different product; wired into firstWinsOnlineFetch (eval) and api/abuai-online (device, behind ONLINE_DEEP_FETCH). MEASURED on the real gpt-realtime instrument: three differently-phrased Bleu de Chanel questions all returned a real price in a consistent range (597-649 shekels), each one clean sentence; ttft 3.0-4.2s. STILL TODO in M4: prefetch warm store + non-verbal cue. Gates: typecheck 0, full suite 12,772 passed, build ok. Prior: input oracle (v0.248).',
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
