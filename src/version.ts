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
  version:    '0.196.0-one-people-store-rc1',
  buildLabel: 'AbuBank 0.196.0 — ONE_PEOPLE_STORE_RC1 (M3): family relationships are derived correctly in real Hebrew from ONE canonical people model. New src/services/people/: peopleModel (reads the single source knowledge/family_data.json → direct edges parents/children/spouses/formerSpouses/partners/cohabits, gender only where known; a partner implies nothing about parenthood), kinship (DERIVES at query time, never stores: אח/אחות · דוד/דודה · אחיין/אחיינית · בן דוד/בת דודה · סבא/סבתא · נכד/נכדה · נין/נינה · גיס/גיסה · חתן/כלה · חם/חמות · מחותנים, gendered), and ONE people_lookup tool (who / relationship / relatives / contact by name OR by relationship; numbers resolve at the UI, never in the model). The three named on-device failures now pass: Leo=דוד of Mor\'s children, Gilad=גיס of Eili, Yarden=כלה of Rafi. A Hebrew-error validator (scripts/validate-people.ts) is wired into prebuild — a broken family file never builds. Instruction size if family moves from the prompt to people_lookup: 12978 → 9587 chars (−26%); the actual prompt removal, full retirement of resolve_contact, and generating the legacy stores (family_graph.json / abu-family.md) FROM the one source are staged (they touch the embedded-family tests). Evidence: CODE + AUTOMATED TEST (kinship engine incl. every derived type + the 3 named failures + 8 invariants; people_lookup; live-tool wiring — 59 tests; full suite 12327 pass; typecheck 0; build 0; validate:people green). On-device kinship in live speech is PHYSICAL_DEVICE — NOT claimed.',
  buildDate:  '2026-08-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
