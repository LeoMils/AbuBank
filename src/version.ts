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
  version:    '0.238.0-online-depth',
  buildLabel: 'AbuBank 0.238.0 — ONLINE DEPTH (Item 3). Root cause fixed: ProviderSource now carries per-source content (the depth the one-line answer discarded); the Tavily adapter keeps each result content + raises max_results to 10; Brave carries its description too. New briefing.ts fans a briefing across Israel/world/culture/entertainment/society/health (NO sports, NO economics), dedups by URL, returns 10+ distinct headlines each with source + held snippet, and answers a follow-up from the SAME retrieval (detailFor) or says so honestly. Wired into api/abuai-online.ts behind a briefing intent and the SAME zero-source honesty gate. REAL keyed probe (PREVIEW): before = 1 line / 6 url-only sources; AFTER = 12 distinct headlines, 12/12 with snippets, 9 hosts, all 6 categories. Provider health: Brave + Perplexity LIVE; Tavily key DEAD (HTTP 401 — rotate); OpenAI key present. Cinema: real sources found (cinema-city.co.il Kfar Saba, seret.co.il) but reliable structured showtimes need a dedicated adapter — honest cannot until then. Mutant briefing-headline-without-a-source KILLED. Evidence: online tests green + real probe + full suite + build. Prior: cost controls (v0.237).',
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
