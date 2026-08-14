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
  version:    '0.245.0-bundle-shrink',
  buildLabel: 'AbuBank 0.245.0 — G+D: the duplicated family portrait is removed from the live bundle, and relation queries now GROUND on the deterministic resolver. The instructions carried a 10,902-char family portrait (44% of the bundle) — data that already lives behind people_lookup — which is why relation queries answered from the prompt (0 tool calls) with a derivation chain instead of calling the resolver. Change: the portrait is removed entirely (import + call gone, module deleted); the # Family and People section is rewritten to ground every who/relationship/relatives answer through people_lookup (silently, per-intent, ONE short sentence, the relation only, no derivation), life story through history_lookup, and to accept a correction about her own family AT ONCE and never argue; the # Tools and Actions bullets flip from answer-from-prompt to call-the-tool. Instructions 24,513→13,855 chars; payload 36,863→26,188; a shrink-ratchet test locks the cut and ratchets toward the 5,000 target. Deterministic acceptance: bundle-size ratchet asserted, full Hebrew pair matrix green (relationMatrix.test), one-sentence relation. MEASURED on the real gpt-realtime instrument: relation tool-call rate 0/5→5/5 (עדי/לאו → people_lookup → "עדי בן של לאו"); collateral online/calendar/comm unchanged. Realtime stays the behavioral instrument; the throttle is handled by pacing + backoff + connect-error exclusion, never by demoting to the chat harness. Prior: one reconciled live-state indicator + QA badge hidden (v0.244).',
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
