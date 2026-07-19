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
  version:    '0.136.0-ledger-soft-confirm',
  buildLabel: 'AbuBank — LEDGER_SOFT_CONFIRM (Cycle 56 — REVOLUTION mandate, session 6: the soft-confirm door). Completed the three-door conversation intake. A plainly-stated family fact with NO "תזכרי" ("רותי היא אשתו של דני") is caught ONLY in the general path (every real domain wins first), replies ONE Hebrew confirmation prompt ("לרשום שזה נכון? … כן/לא"), and sets pendingLedgerChange on RuntimeState WITHOUT writing. The NEXT "כן" commits it through THE LAWS gate (LedgerService.writeFact) and it becomes answerable; "לא" abandons it ("בסדר, לא רשמתי"); any other turn drops the pending fact. The pending-confirm resolver runs BEFORE the conversation engine and is guarded (createState idle + no pendingReminder + pendingLedgerChange set), so it can NEVER hijack the calendar "כן" — a calendar create still saves normally. RED-first controller round-trip: state fact → prompt → "כן" → in the ledger AND answerable ("מי אשתו של דני" → "דני נשוי לרותי"); "לא" writes nothing; calendar confirm untouched. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake — no parallel path. Evidence: CODE — ledgerSoftConfirm 3/3, truth + AbuAI 4545 pass, full suite 11101 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Remaining (next): birthdays→calendar write, one-tap upload diff UI, ledger view surface. Builds on 0.135.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
