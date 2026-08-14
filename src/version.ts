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
  version:    '0.239.0-online-no-source-leak',
  buildLabel: 'AbuBank 0.239.0 — ONLINE NO-SOURCE-LEAK (convergence v3, Phase 2A structural). The device AND the new gpt-realtime harness both reproduced Abu naming the websites she checked (cinema named Cinema City + Seret; price named four stores). Root cause was structural and self-inflicted: get_current_info handed the model a sources array AND told it to mention the source. Fix: the function_call_output the model receives now carries NO sources, NO URL, NO bare domain (scrubForSpeech strips markdown links, URLs, www, source trailers, and domain tokens), and the permitted-speech line FORBIDS naming any source. Re-measured on the REAL realtime instrument: source-naming eliminated on both cinema and price. Regression onlineNoSourceLeak (6) + mutant online-source-leaks-to-model. Residual (listed, not hidden): the online answer is still a search snippet, not fetched page content, so a real price is still missing — needs the fetch+synthesize build. Prior: online depth (v0.238).',
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
