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
  version:    '0.118.0-marathon-p4',
  buildLabel: 'AbuBank — MARATHON_P4 (Reality-driven — P4 generative marathon): built the generative marathon — a seeded generator composing multi-turn sessions (family who × calendar CRUD with pronoun referability × date arithmetic × memory store/recall/forget) driven through the REAL app entry (index.tsx-faithful guarded pronoun/follow-up preprocessing + ExecutiveCognitiveController, mocked llm/online). The first batch found breaks in 2 general classes, both LAB-vs-APP divergences (P0): (1) DATE ROUTING — the date engine handles "בעוד N ימים" but classifyIntent only routed the "איזה יום … בעוד" ordering, not "בעוד … איזה יום" → LLM; fixed RELATIVE_DATE_QUERY_RE to accept both orderings. (2) DIALOGUE GUARD — a repeated FACTUAL answer (two questions sharing "מור", or two dates on the same day) was suppressed as a loop; now only STUCK/non-answer repeats escalate (fixed the truth in the test that encoded the bug). A 400-session batch now passes CLEAN. Evidence (CODE at app-entry level): generativeMarathon 400/400 clean; full suite 11017 green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.117.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
