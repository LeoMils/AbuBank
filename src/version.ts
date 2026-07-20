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
  version:    '0.143.0-understanding-wired-live',
  buildLabel: 'AbuBank — UNDERSTANDING_WIRED_LIVE (INTAKE REBUILD, session 4 · P1 live). Wired the understanding-first layer into the async turn path: on a pattern MISS (runtimeFullTurn `needsLLM` branch — patterns stay the fast-path cache), it now interpret()s the turn via a REAL transport (makeInterpretTransport → sendServerChat → /api/abuai-chat, strict json_schema), groundIntent()s it through the deterministic engines, and enriches the LLM grounding with VERIFIED facts (graph-resolved people, engine-parsed date/time) so the model cannot hallucinate them. Understanding never decides a family relation and can never invent a person (unresolved refs are dropped); a failed interpret never breaks a turn; latency is reported ([AbuAI][UNDERSTAND|LATENCY], onUnderstandLatency). Evidence: CODE/MOCK — understandingIntake 19/19 + live-wiring 3/3 (mock transport enriches grounding + latency reported + backward-compatible when absent) + FULL suite 11496 pass / 2 todo / 0 regressions, typecheck + build. PREVIEW/PENDING: the REAL provider call + on-device latency are proven only on a deploy — NOT yet. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P3 garble suite → P4–P8 → verification regime. Builds on 0.142.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
