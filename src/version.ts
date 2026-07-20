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
  version:    '0.152.0-per-turn-shadow',
  buildLabel: 'AbuBank — PER_TURN_SHADOW (INTAKE REBUILD, session 13 · standing obligations #2/#6/#7/#8). Shadow validation now covers the WHOLE understanding path, not only the family seam. understandingShadow.ts compares, PER TURN, the legacy pattern intake (observeOldIntake on the real runCognitiveTurn — family turns resolve the REAL legacy people via the live seam) against the understanding path (interpret to groundIntent to decideIntakeAction), classifying each turn into agree / recovered / regressed / disagree / clarify / false_clarify / unresolved. It is wired LIVE observation-only in runtimeFullTurn (onIntakeShadow, fire-and-forget so it adds ZERO latency to the answer; a pattern MISS reuses its interpretation via shadowPre so NO turn fires a second provider call) and in fullTurnBridge via intakeShadowCollector (bounded ring buffer, rolling KPI log, immediate disagree/regressed risk surfacing). aggregateKPIs reports understanding RATES not test counts (agreement, semantic recovery, disagreement, regression, ambiguity, false-clarify, unresolved) and pctl reports latency p50/p95/worst per stage (interpret/ground/decide/total). The KPI corpus test publishes docs/eval/UNDERSTANDING_SHADOW_KPI.md and asserts the migration-safety gate: regressed=0 and disagree=0 (understanding never loses or contradicts the engines), recovery>0, ambiguity>0. It also surfaced a real finding: on under-specified turns the legacy path acts while understanding asks one question — the safer behavior, a migration candidate. Evidence: CODE — understandingShadow 13/13, shadow-wiring 2/2, KPI corpus 1/1, typecheck + full suite. The MOCK interpreter encodes target behavior; live real-provider rates + interpret latency are PREVIEW-pending. NOT device-proven; only the Leo free-language round decides ready. NEXT: system-level whole-conversation proof (#1), paraphrase/multilingual tolerance (#4), meaning-cache (#10), transcript-to-gold pipeline (#11). Builds on 0.151.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
