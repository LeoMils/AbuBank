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
  version:    '0.135.0-ledger-wiring',
  buildLabel: 'AbuBank — LEDGER_WIRING (Cycle 55 — REVOLUTION mandate, session 5: the ledger goes live in conversation). Wired the ledger CORE into the AbuAI runtime through THE LAWS gate. WRITE: an explicit "תזכרי ש<family fact>" (e.g. תזכרי שדני נשוי לרותי) is intercepted in the memory-save path and written to the ledger via LedgerService.writeFact (auto-creating any new relative, atomically) — a contradiction is REFUSED at the gate ("לא רשמתי — <reason>") and never stores; a normal preference "תזכרי ש…" is untouched and still goes to preference-memory. READ: the family engine now reads FROM the ledger — a conversation-added relation the static graph is silent about ("מי אשתו של דני" → "דני נשוי לרותי") is answered from the ledger, using the RAW input so possessive pronouns are not rewritten. Ledger-fills-the-gap is safe because the LAWS gate guarantees a ledger fact can never contradict the graph. RED-first controller round-trip: state a fact → it is written (gated) → answerable; a bigamy poison against the real graph is refused. Reuses familyLaws/ledgerService/conversationIntake — no parallel path. Evidence: CODE — ledgerWiring 3/3, truth suite, AbuAI 4511 pass, full suite 11098 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Remaining (next): soft-confirm flow (pending-change state), one-tap upload diff UI, birthdays→calendar write. Builds on 0.134.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
