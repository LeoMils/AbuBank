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
  version:    '0.97.0-spanish-meal-create',
  buildLabel: 'AbuBank — SPANISH_MEAL_CREATE (Intelligence Parity Cycle 18, text-only via the real ExecutiveCognitiveController): widened-probe gap. agendá una cena con Anabel el viernes a las ocho fell to the LLM while anotá una cita … works — CREATE_INTENT_ES recognized cita/reunión/turno/evento but not meal nouns. And, like the Hebrew dinner bug, a bare a las ocho for a cena defaulted to 08:00 (an 8 AM dinner). Added cena/almuerzo/comida/desayuno/café/merienda to the Spanish create schedulable objects, and cena/almuerzo/merienda → PM (desayuno → AM) to the meal-context period detection. Now agendá una cena con Anabel el viernes a las ocho → calendar_create with Anabel, viernes, 20:00 (not 08:00). Evidence: spanishDinnerCreate.test.ts 3/3 green (CODE); Spanish + calendar regression suites 111 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.96.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
