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
  version:    '0.151.0-fail-closed-understanding',
  buildLabel: 'AbuBank — FAIL_CLOSED_UNDERSTANDING (INTAKE REBUILD, session 12 · standing obligation #9). The understanding layer now FAILS CLOSED under every degenerate interpreter outcome and NEVER fabricates a structured action. interpretUtterance got a bounded timeout (a hanging provider → operation:unknown, never blocks a turn); malformed/partial-schema/provider-down/unsupported-op all coerce to a safe unknown shape. Added decideIntakeAction — the explicit policy that, given a grounded intent, returns act / clarify (ONE question) / decline: it never acts on empty or contradictory meaning (a "create" with nothing concrete → asks; a family query with an unresolvable person → asks; ambiguity flagged by the model → asks its one question; unknown/chat → declines to the normal path). Evidence: CODE — understandingFailClosed 10/10 (incl. a fake-timer timeout) + FULL suite 11562 pass / 2 todo / 0 regressions, typecheck + build. decideIntakeAction is the proven policy for action-routing (test-covered); wiring it to DRIVE actions is the deeper P1 integration, next. NOT device-proven; only the Leo free-language round decides ready. NEXT: latency stage KPIs (#8), shadow over create/ledger paths, meaning-cache (#10), transcript→gold pipeline (#11), paraphrase/multilingual tolerance (#4). Builds on 0.150.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
