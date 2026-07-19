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
  version:    '0.138.0-person-chapters',
  buildLabel: 'AbuBank — PERSON_CHAPTERS (Cycle 58 — LEDGER EXPANSION v3, session 2: full-person chapters). Extended the ledger from relations to a full CHAPTER per person. familyLaws gained a PersonFact { kind, value, source, at } model (residence/work/hobby/health/event/story/preference — every fact carries PROVENANCE + DATE) and an addFact op gated by THE LAWS (person must exist, no empty fact); the curator supersedes a single-valued fact (a MOVED residence — latest wins, no fact deleted). CONVERSATION: extractChange now parses residence ("דני גר ב…"), work ("דני עובד ב…") and preference ("דני אוהב …"); first-person ("אני אוהבת יין") stays Martita own preference-memory. The explicit "תזכרי ש<fact>" write moved BEFORE the memory/reminder split so a chapter fact is never mis-read as a reminder; every write still passes THE LAWS gate. READ: ledgerChapterAnswer answers a PERSONAL question from the chapter — "איפה גר X" / "איפה עובד X" / "מה X אוהב" / "מה את יודעת על X" — before punting to the LLM. The chapter renders into the canonical Hebrew ledger view with provenance. RED-first controller round-trip: state a personal fact → written (gated, dated) → Abu answers it from the chapter. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake/ledgerCurator — no parallel path. Evidence: CODE — personChapter 5/5, truth 42, AbuAI + eval 8921 pass, full suite 11120 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Deferred (infra-gated): cloud-canonical store, real email/cron; and the תעודת המשפחה view + one-tap upload UI. Builds on 0.137.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
