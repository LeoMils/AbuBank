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
  version:    '0.137.0-nightly-autopilot',
  buildLabel: 'AbuBank — NIGHTLY_AUTOPILOT (Cycle 57 — LEDGER EXPANSION v3, session 1: the autopilot core). Built the invisible maintenance chain (Constitution §3/§4), CODE-provable, reusing the existing engines. LEDGER CURATOR (src/truth/ledgerCurator.ts + LedgerService.curate/undoCuration): dedupe identical facts, supersede a corrected value (latest wins, in place), reorder chronologically — NEVER deletes a fact; each substantive change is one Hebrew line and the whole curation is UNDOABLE. NIGHTLY CHAIN (src/eval/nightlyAutopilot.ts): runs the duel/guard corpus + the flight-recorder analyzer (weaknessMap → archetypes) + the curator, emits ONE Hebrew status line (🟢 הכל תקין / 🟠 נמצאו N דברים לתיקון) and, when items exist, a ready-made fix-the-queue prompt for Claude Code. LEO-ONLY NOTIFICATION (src/eval/notify.ts): email via raw fetch to Resend when RESEND_API_KEY + LEDGER_RECIPIENT exist, else the honest Leo-only status page — NOTHING is ever Martita-facing. SERVER CRON (api/cron/nightly.ts, nodejs runtime, + vercel.json crons 03:00) runs the server-safe curator and returns the status page. HONEST INFRA LIMITS (proven, not hidden): NO storage backend (KV/Postgres/Blob), NO email provider, NO deps addable (package.json gated) are provisioned here — so cloud-canonical persistence, real email, and guaranteed cron firing are DEFERRED; the endpoint + fallbacks are built and documented. Evidence: CODE — ledgerCurator 3/3, nightlyAutopilot 5/5, notify 4/4, cronNightly 2/2, full suite 11115 pass / 2 todo, typecheck + build. Deferred: cloud-canonical ledger store, full-person chapters, one-tap upload UI. Builds on 0.136.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
