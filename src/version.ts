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
  version:    '0.142.0-understanding-first-layer',
  buildLabel: 'AbuBank — UNDERSTANDING_FIRST_LAYER (INTAKE REBUILD, session 3 · P1 foundation). Built the understanding-first intake layer (src/screens/AbuAI/understandingIntake.ts): a STRICT StructuredIntent schema {operation, personRefs (relation phrases in any morphology OR names), dateWords, timeWords, place, title, fact{kind,value}, correction, confirmation, ambiguousQuestion}, an interpret() step with an INJECTED transport (LLM half — MOCK-provable; real provider call + latency is PREVIEW-class, deliberately unproven), and groundIntent() — the PURE deterministic half that grounds an intent through the EXISTING engines: person refs resolve via the ONE seam ("החתן של מור"→גלעד), date/time via the date engine ("מחר"/"בשלוש אחר הצהריים"→date+15:00), nothing invented (a dog ref stays in unresolvedRefs; an unparseable date stays null). normalizeIntent() coerces arbitrary/malformed model JSON to a safe shape (bad op→unknown) so the caller always falls back cleanly. Evidence: CODE/MOCK — understandingIntake 13/13 + FULL suite 11488 pass / 2 todo / 0 regressions, typecheck + build. HONEST LIMIT: this layer is test-covered but NOT yet wired as the live gate in the async turn path (a separate careful step); patterns remain the fast-path cache. NOT device-proven; only the Leo free-language round decides readiness. NEXT: wire P1 live (async, real-latency PREVIEW) + P3–P8. Builds on 0.141.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
