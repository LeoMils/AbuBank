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
  version:    '0.147.0-no-fabrication-guard',
  buildLabel: 'AbuBank — NO_FABRICATION_GUARD (INTAKE REBUILD, session 8 · P6). A pre-emission hard law: an LLM/fallback answer may NEVER assert a specific appointment (the "1 באוקטובר" hallucination class) — calendar is deterministic, never the LLM. guardNoFabricatedCalendar runs before finalize in runtimeFullTurn: an APPOINTMENT FRAME (יש לך/קבעתי/התור/הפגישה) + a concrete date/clock in an LLM-sourced answer is neutralized to an honest deferral ("בואי נבדוק ביומן ביחד…"). PRECISE: ordinary prose + historical dates ("המהפכה ב-1789") pass untouched; the deterministic calendar engine + online answers are trusted and never scrubbed. Evidence: CODE — noFabricationGuard 6/6 (incl. a live turn where an LLM invents "פגישה ב-1 באוקטובר" and it is scrubbed from the display) + FULL suite 11536 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P7 correction-verify → P8 toast → verification regime. Builds on 0.146.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
