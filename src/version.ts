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
  version:    '0.202.0-abuela-online-winner-m2',
  buildLabel: 'AbuBank 0.202.0 — ABUELA_M2 (online winner): ran the REAL provider tournament on the 36-question Hebrew corpus with all four keys live. Reachability first — Brave was failing 422 because the adapter pinned country=IL, which is not in the Brave country enum; removed it (Hebrew via search_lang=he) with a regression test. Matrix: incumbent OpenAI 61% citation / 3941ms avg / 8851ms p95 (inadequate for voice); Tavily 100% / 1963ms / 3228ms with a clean speakable Hebrew answer; Brave 100% / 784ms / 1132ms but only raw snippets (not speakable); Perplexity 100% / 4501ms / 6860ms, best reasoning but too slow. Winner = Tavily (only provider giving a voice-ready grounded Hebrew answer inside the latency budget). Wired behind /api/abuai-online via selectProvider(ONLINE_PROVIDER); the DEFAULT stays openai so production and existing endpoint tests are unchanged until the env flips. Same honesty gate (zero sources means decline), personal / family / calendar still never reach the web, key stays server-side. Re-ran through the WIRED endpoint against live Tavily: grounded answers in 0.2-1.6s, a calendar query blocked in 1ms. Evidence: CODE + AUTOMATED TEST (winner-path + grounding-gate + brave regression) + PREVIEW-class real API numbers (docs/eval/ONLINE_BAKEOFF.json). Latency note: Tavily p95 3.2s can exceed the 2s voice target on some queries — recommend a bounded client timeout with a truthful checking state; Brave is the sub-second fallback.',
  buildDate:  '2026-08-11',
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
