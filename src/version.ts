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
  version:    '0.122.0-parity-live-crosscheck',
  buildLabel: 'AbuBank — PARITY_LIVE_CROSSCHECK (Cycle 42 — Priority 2, the live seam): implemented the pluggable LIVE reference/judge as a CROSS-CHECK panel (user choice): the reference reply is taken from BOTH a Claude model (claude-opus-4-8) and an OpenAI GPT model under the same warm-elderly-companion persona brief, and each AbuAI reply is scored by a judge panel — AND across judges (a dimension passes only if every judge agrees AbuAI matched the reference), then OR across references (compared against the stronger of the two). No new dependencies: raw fetch, so package.json is untouched (a human-approval gate). Anthropic calls follow the claude-api contract (claude-opus-4-8, output_config.effort high, structured-output judge schema). The KEYED run is OUT-OF-BAND (needs ANTHROPIC_API_KEY + OPENAI_API_KEY; a keyed run is PREVIEW/PRODUCTION evidence) — the request wiring and the cross-check aggregation are proven deterministically with mocked fetch (parityLiveJudge.test.ts 7/7, CODE). Deterministic scorecard remains 6/6 dimensions at 100% (17 scored turns). Evidence: parityLiveJudge 7/7 + parityScorecard + generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.121.0.',
  buildDate:  '2026-07-17',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
