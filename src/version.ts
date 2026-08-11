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
  version:    '0.207.0-online-diagnostic',
  buildLabel: 'AbuBank 0.207.0 — online provider DIAGNOSTIC + Tavily fix: /api/abuai-online now returns a non-secret diag on EVERY response (requested + resolved provider, providerKeyPresent, openaiKeyPresent, reached, sourceCount, outcome) so a misconfigured provider can never again look identical to a search that genuinely found nothing. Both client callers (live get_current_info seam + the text answerOnlineCurrentInfo path) capture + console.info the diag and expose lastDiag on the operator health snapshot. Root-cause fix: the Tavily adapter pinned topic=news, which restricts Tavily to recent news ARTICLES and returns ZERO results for the non-news current queries the endpoint also serves (rates, hours, shabbat, holidays) — zero results then trip the honesty gate and read as no_result; removed the pin so Tavily runs a general current-info search. Regression tests added: diag distinguishes missing-key (reached=false) from empty-search (reached=true, sourceCount=0), and the Tavily body no longer pins topic=news. Evidence: CODE + AUTOMATED TEST (33 online endpoint/provider + 44 client/liveTools green). Vercel: confirm ONLINE_PROVIDER=tavily is visible (non-sensitive) for the Preview env + rc5, TAVILY_API_KEY present, and REDEPLOY after setting; then one request shows the diag truth.',
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
