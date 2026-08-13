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
  version:    '0.218.0-tool-timeout-honest-fallback',
  buildLabel: 'AbuBank 0.218.0 — FIX 5: a tool can no longer leave the model (and Martita) waiting on a silent hang. Two holes closed in the live tool executor: (1) the SYNC path had a try/finally with NO catch — a tool that threw never sent a function_call_output, so the model waited forever for a result that never came (the "people_lookup fired, no result arrived, both sides waited" hang). It now catches and always sends an honest error output ("could not do that just now", never a false success) so the turn completes. (2) the ASYNC online tool (get_current_info) had no timeout — a hung fetch never returned. It is now raced against an 8s budget (LIVE_TOOL_TIMEOUT_MS); on timeout it sends the honest "could not check current information" miss and lets the model speak it. Every non-returning call is LOGGED to the flight recorder (onToolIssue: name + error/timeout), so a stuck tool is visible in the trace instead of a silent wait. Evidence: CODE + AUTOMATED TEST (a never-resolving online fetch times out to no_result + logs; a throwing sync tool replies error + logs; the every-tool-speaks guarantee still holds). typecheck + full suite + build. Prior in this branch: FIX 1+2 one retrieval path (v0.215), FIX 4 the active-response crash (v0.216), FIX 7 announce-before-checking (v0.217). Still open: FIX 3 history retrieval, FIX 6 news/cinema depth, FIX 8 audio.',
  buildDate:  '2026-08-13',
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
