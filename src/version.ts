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
  version:    '0.75.0-online-grounding-gate',
  buildLabel: 'AbuBank — ONLINE_GROUNDING_GATE: a real device test on 0.74.0 (iPhone) exposed broken foundations; see docs/DEVICE_P0_ROOT_CAUSE.md for the 4-way root-cause report (voice, memory, online, calendar). First fix: the online endpoint no longer returns a confident current-info answer without evidence of retrieval. It used to return ok:true with the model free text whenever an answer existed (attaching sources only when present), so an ungrounded/hallucinated answer with ZERO sources — the fabricated World Cup fixtures — was surfaced as fact. Now zero sources ⇒ honest failure (ONLINE_NO_RESULTS: "I could not find current info, I would rather tell you that than make something up"). §47 / NO TOOL RESULT = NO CLAIM. web_search itself is functional (weather returns sources, PREVIEW-verified). Voice/mic remains device-gated (root-caused; Operator Protocol). Builds on 0.74.0 FAMILY_POSSESSIVE_SPOUSE.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
