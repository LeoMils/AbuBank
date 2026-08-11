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
  version:    '0.194.0-live-online-tool-rc1',
  buildLabel: 'AbuBank 0.194.0 — LIVE_ONLINE_TOOL_RC1 (live-wiring + honesty-guard): Abu can now answer CURRENT facts in the live conversation via a real grounded tool. New async live tool get_current_info (LiveTools) POSTs to the server-side grounded /api/abuai-online (key server-only, no-sources honesty gate) and lets the model speak ONLY what it returns, with its source; no verified result ⇒ an honest "I could not check", NEVER a current fact from memory. LiveTools gained its FIRST async tool — it keeps the call-id in-flight and replies when the round-trip returns, deduped exactly-once like the sync tools. HONESTY GUARD INVERTED (authorized): news/weather/cinema were REMOVED from TOOLLESS_CAPABILITY_GUARD and their "do NOT" disclaimers dropped — they now have a tool; memory + games stay disclaimed. Instructions now require get_current_info for anything current/live and forbid answering a current fact from memory. Evidence: CODE + AUTOMATED TEST (async tool grounded/no-result/thrown/exactly-once; guard-teeth retargeted to memory+games; full suite 12273 pass, typecheck 0, build 0). REAL PROBE (key reachable, NOT blocked): web_search grounding is INCONSISTENT — the provider attaches url_citations for some queries but not others; when uncited the endpoint correctly returns an HONEST NO_RESULTS and never fabricates. So the tool is wired + safe, but reliable real answers still need provider/prompt tuning — NOT claimed. On-device speech is PHYSICAL_DEVICE — NOT claimed.',
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
