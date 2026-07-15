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
  version:    '0.102.0-grandchildren-of-x',
  buildLabel: 'AbuBank — GRANDCHILDREN_OF_X (Intelligence Parity Cycle 23, text-only via the real ExecutiveCognitiveController): first VERIFIED against knowledge/family_data.json that בן הזוג של מור → יעל is CORRECT (Yael is Mor partner) — not a wrong-person bug. Then fixed the real gap: מי הנכדים של X fell to the LLM because the family routing matched singular נכד/נכדה but not PLURAL נכדים/נכדות, and there was no grandchildren-of-X relation rule (though the graph computes children-of-children). Added a grandchildren REL rule (grandchildrenOfPublic, singular+plural) + routing. מי הנכדים של מור → אנאבל, ארי; מי הנכדים של לאו → honest (Leo has none), never fabricated. Evidence: grandchildrenOfX.test.ts 3/3 green (CODE); family regression suites 256 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.101.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
