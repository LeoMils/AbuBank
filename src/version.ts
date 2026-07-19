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
  version:    '0.133.0-weakness-map',
  buildLabel: 'AbuBank — WEAKNESS_MAP (Cycle 53 — REVOLUTION mandate, session 3: proof c, the last). Built the weakness map (Constitution §5): src/truth/weaknessMap.ts auto-classifies every real miss from the flight-recorder reality into a failure ARCHETYPE — answer-not-the-question, phrase-not-resolved, fabricated-fact, capability-denial, repeated, rejected — tagged by domain + language. The detectors are domain-AGNOSTIC (the same predicate runs across calendar/family/memory/online). mineTranscript over Leo real stale-round turns yields the archetype map. CROSS-DOMAIN PROOF (c): the phrase-not-resolved archetype was closed in CALENDAR (Cycle 50) but the cross-domain probe caught it still OPEN in FAMILY — "מי החתן של רפי" / "מי הכלה של רפי" punted to the LLM. ONE general fix closes it across both domains: looksLikeFamilyQuery now recognizes in-law relation words (חתן/כלה/גיס/נין) so the who-is routes to the family engine, and familyReasoner resolves the phrase via the SAME resolvePersonPhrase the calendar uses (מי החתן של רפי → החתן של רפי הוא גלעד). Locked forever by the cross-domain probe suite (calendar + family). Evidence: CODE — weaknessMap 3/3, full suite 11083 pass / 2 todo, typecheck + build; no family/parity regressions. REVOLUTION proofs a,b,c,d,e,f ALL delivered. Remaining (product): the canonical Hebrew ledger FILE + conversation write path + birthdays→calendar. Builds on 0.132.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
