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
  version:    '0.121.0-parity-scorecard',
  buildLabel: 'AbuBank — PARITY_SCORECARD (Cycle 41 — Priority 2, deterministic half): built the PARITY SCORECARD — a standing, repeatable measure of the ACTUAL AbuAI app-path reply on the 6 mandate dimensions (correctness · warmth · brevity · answered-what-was-asked · language discipline · naturalness) over a curated He+Es real-capability turn set, run through the SAME app entry as the marathon. It REUSES the existing judges (conversationQualityJudge.judgeTurn + judgeRunner.judgeResponse) — no parallel judge — plus engine-computed oracles, and exposes a PLUGGABLE reference/judge seam for a future LIVE ChatGPT-class run (honestly labelled deterministic, NOT live-model, since this env mocks the LLM). On its FIRST run it caught a real language-discipline bug: a Rioplatense "cancelalo" deleted correctly but confirmed in HEBREW (detectLang is conservative; deleteReasoner emitted its Hebrew title). Fixed: deleteReasoner self-detects a Rioplatense delete command and confirms in Spanish via personName. Scorecard now 6/6 dimensions at 100% (11 scored turns). Evidence (CODE at app-entry level): parityScorecard + generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.120.0.',
  buildDate:  '2026-07-17',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
