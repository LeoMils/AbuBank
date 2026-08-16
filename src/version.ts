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
  version:    '0.284.0-earonly',
  buildLabel: 'AbuBank 0.283.0 — GOLDEN-SESSION. ONLINE REBUILT (device: every query returned garbage). The JUDGE now gates EVERY spoken answer — a raw provider snippet is NEVER spoken; on a miss it REFINES with a fresh search, then judges the snippets, else an honest miss. TIME is deterministic (Asia/Jerusalem), never web-searched (it had returned the Ashburn datacenter clock). News is synthesized, not category names. diag.answerPath proves which path answered from the deployed endpoint. NAME fixed: her own name failed on ט/ת homophones — folded, so she ALWAYS resolves and is never told she does not exist. RELATIONSHIPS: the relation BETWEEN two people as one natural possessive phrase (Yael is the partner of Leo sister), never routed through Martita, never the בני משפחה non-answer. BARGE-IN: local playback is now MUTED synchronously on user speech (a server cancel never stopped the buffered audio — why she did not stop). FORCED-RESPONSE + REPETITION: the tool-result watchdog re-arms on progress so it no longer fires during a slow two-response/online answer and force-DUPLICATES it (that was the 7x forced-response and the same-sentence-3x). Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
