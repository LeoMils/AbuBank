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
  version:    '0.146.0-ledger-intake-width',
  buildLabel: 'AbuBank — LEDGER_INTAKE_WIDTH (INTAKE REBUILD, session 7 · P5). Explicit-remember ("תזכרי ש…") now covers EVERY chapter kind, not just residence/work/preference: a new explicit-only extractor (extractExplicitFact) adds education (למד/לומד/סיים תואר), hobby (מנגן/מצייר/רוקד/אוסף/משחק), event (התחתן/התארס/טס ל/טייל ב), and a GENERIC STORY catch-all so any stated fact about a KNOWN person is stored (the whole sentence, nothing lost) instead of "לא יכולה לזכור". THE LAWS still gate every write (unknown person → refused honestly). Privacy holds: medical + financial + phone content is declined and NEVER stored, even on explicit remember; first-person ("אני…") stays Martita own preference-memory. Crucially the WIDTH is explicit-only — the shared soft-confirm extractChange is UNCHANGED, so no conversational/eval drift. Added the education FactKind. Evidence: CODE — ledgerWidth 13/13 + FULL suite green / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P6 no-fabrication guard → P7 correction-verify → P8 toast → verification regime. Builds on 0.145.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
