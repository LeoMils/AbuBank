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
  version:    '0.70.0-spanish-create-stays-spanish',
  buildLabel: 'AbuBank — SPANISH_CREATE_STAYS_SPANISH: a Spanish calendar create now speaks Spanish end-to-end (§20.2 "remain in Spanish"). The clarify ("¿A qué hora?"), the confirm ("Te agendo una reunión con Gabi mañana a las 15:00. ¿Está bien?"), the save ("Listo, te agendé…") and the cancel are all Spanish instead of Hebrew, and the Hebrew "פגישה עם X" title is rendered "una reunión con X". The create remembers its language on the draft so it stays Spanish across turns even when a bare answer ("a las cuatro") detects as Hebrew. Hebrew creates are unchanged. Builds on 0.69.0 SPANISH_TRANSCRIPT_LOCALE_INTEGRITY.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
