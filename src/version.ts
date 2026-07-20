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
  version:    '0.148.0-correction-verify-and-toast',
  buildLabel: 'AbuBank — CORRECTION_VERIFY_AND_TOAST (INTAKE REBUILD, session 9 · P7 + P8). P7 correction-verification: when Martita corrects the FACTS of a prior ONLINE answer ("לא נכון", "טעית", "בעצם זה…"), runtimeFullTurn now RE-SEARCHES that topic (conversation focus=online → re-run the online tool) instead of blind-agreeing — a false "you are right" is worse than a re-check. Only overrides when the runtime would otherwise merely chat/fall back; deterministic domains keep priority; a plain "לא/לא תודה" is NOT treated as a factual correction. P8: killed the "אבחון הקול הועתק" chat-bubble spam — repeated taps no longer append duplicate confirmations (dedup on the last message). Evidence: CODE — correctionVerification 5/5 (incl. a live turn: a correction after a weather answer re-runs the online tool with the topic and does NOT blind-agree) + FULL suite 11542 pass / 2 todo / 0 regressions, typecheck + build. P8 is a UI onClick (BROWSER-class, verified by inspection, not unit-tested). Real online retrieval quality = PREVIEW. NOT device-proven; only the Leo free-language round decides readiness. NEXT: the verification regime (full corpus green + fresh preview deploy + internal free-language simulation) — the deploy is human-gated. Builds on 0.147.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
