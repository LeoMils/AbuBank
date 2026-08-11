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
  version:    '0.193.0-abu-news-grounded-rc1',
  buildLabel: 'AbuBank 0.193.0 — ABU_NEWS_GROUNDED_RC1 (Part 3): Abu News is a real, grounded news app. New edge endpoint /api/abuai-news (server-side key, OpenAI Responses web_search) returns Israel-primary Hebrew stories as STRUCTURED JSON — each requiring a headline + plain-Hebrew summary + source + real url + time. A GROUNDING GATE (web_search must cite ≥1 source) plus a per-story completeness guard mean nothing half-blank, stale or fabricated is ever shown; on any failure the screen says so honestly and shows NO stories. The client (newsClient) re-validates the wire and caches the SAME grounded results so Abu can later speak from them (live wiring is the next commit). Screen is senior-first: large type, high contrast, source+time on every card, honest failure + retry, dynamic story count. Evidence: CODE + AUTOMATED TEST (endpoint grounding/honest-failure, client validation+cache, completeness guard — 20 tests; full suite green; typecheck 0; build 0). REAL PROBE (key reachable via the shared loader — NOT blocked): the provider retrieves and cites (7 url_citations observed), but reliable per-story structured extraction still needs prompt tuning — meanwhile the endpoint correctly returns an HONEST NEWS_NO_RESULTS rather than fabricating. Real on-screen stories are PROVIDER/PREVIEW — NOT yet claimed.',
  buildDate:  '2026-08-10',
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
