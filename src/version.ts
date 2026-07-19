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
  version:    '0.134.0-family-ledger',
  buildLabel: 'AbuBank — FAMILY_LEDGER (Cycle 54 — REVOLUTION mandate, session 4: the living ledger core). Built the product-facing Truth-Loop foundation on top of THE LAWS. LedgerService (src/truth/ledgerService.ts): ONE canonical state where the ledger IS a pure function of (seed, change-log) — file-as-view. EVERY write, from any source, goes through familyLaws.applyChange (THE LAWS gate) so a contradiction can never enter; a rejected fact leaves NO log entry (poison never stores). Every change is one log line and UNDOABLE (pop the log, replay from the seed); state persists across reload (localLedgerStore). renderLedgerHebrew (ledgerView.ts) regenerates the canonical human-readable Hebrew ledger from state. CONVERSATION INTAKE (conversationIntake.ts) — three doors: explicit "תזכרי ש…" writes immediately; a plainly-stated fact ("X היא אשתו של Y") gets ONE soft confirmation (pending change + Hebrew prompt); a vague hint ("אולי", "נראה לי") NEVER writes. extractChange parses spouse/parent/sibling/birthdate into a gated Change — even an explicit poisoning fact is still refused at the gate. Manual upload returns a one-line diff per fact (reuses applyBatch). Birthdays propose a yearly calendar entry on approval. Evidence: CODE — ledgerService 12/12, truth suite 28, full suite 11095 pass / 2 todo, typecheck + build. NOT yet wired into the live conversation runtime / one-tap UI (next session). Reuses familyLaws — no parallel path. Builds on 0.133.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
