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
  version:    '0.139.0-family-record-screen',
  buildLabel: 'AbuBank — FAMILY_RECORD_SCREEN (Cycle 59 — LEDGER EXPANSION v3, session 3: the תעודת המשפחה screen). Shipped the senior-safe Family Record screen (Settings → תעודת המשפחה). It renders the canonical Hebrew ledger (renderLedgerHebrew, with per-fact provenance + change log), and gives Leo a paste-free-text box: each pasted line runs through extractChange (parseFreeText) into a one-line accept/reject DIFF, and every recognised fact is COMMITTED ON TAP through LedgerService.writeFact — i.e. THE LAWS gate (a poison line like "אופיר היא אשתו של רפי" is refused with a Hebrew reason and nothing is stored). Plus an EXPORT-BACKUP button (downloads the full change-log + rendered ledger as JSON) and an UNDO-last-change button. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake/ledgerCurator/ledgerView — no parallel path; the screen is pure UI over the existing engine. RED-first: familyRecordLogic (parseFreeText + commitProposal, poison-refused) 2/2, screen render 1/1. Evidence: CODE — FamilyRecord 3/3, full suite green, typecheck + build. PREVIEW: fresh deploy + re-run e2e. This is the FINAL pre-verification cycle — cloud storage / email / other expansion intentionally NOT started; Leo verification round + voice phase come next. Builds on 0.138.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
