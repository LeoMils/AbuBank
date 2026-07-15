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
  version:    '0.90.0-create-person-correction',
  buildLabel: 'AbuBank — CREATE_PERSON_CORRECTION (Intelligence Parity Cycle 11, text-only via the real ExecutiveCognitiveController): probe-2 gap. After תקבעי פגישה עם דני …, the correction לא, לא עם דני, עם מור fell to the LLM — the pending-create engines had no PERSON-correction path (only date/time), so a companion swap with no date/time hit the off-topic guard and was parked as a side question (a later כן would then save the STALE person). The default conversation engine is V2 (classifySignalV2/reduceV2), so the fix lives there AND in the shared updateCreate: added PERSON_CORRECTION_RE (a negation + a new עם/אצל <name>) → field_answer → update, and updateCreate now swaps the companion + rewrites the title when confirming. So לא, לא עם דני, עם מור → פגישה עם מור, and כן saves מור (not דני). Evidence: createPersonCorrection.test.ts 2/2 green (CODE); calendar + V2 regression suites 329 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.89.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
