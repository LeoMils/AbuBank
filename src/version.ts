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
  version:    '0.61.0-stt-hebrew-language',
  buildLabel: 'AbuBank — Voice STT language fix: all three STT engines (Realtime gpt-4o-mini-transcribe, pipeline Groq Whisper, browser Web Speech) now pin an explicit language via the canonical resolveSttLanguage — Hebrew (her primary) by default, Spanish only for an ACTIVE Spanish conversation. Ends the blanket auto-detect that misheard short Hebrew ("בוקר טוב") as Russian/Cyrillic, without reintroducing the stale-preference Hebrew→Spanish bug. Family Phones import + "rafi"→"raphi" alias preserved. Voice-runtime repairs from 0.59.1 preserved.',
  buildDate:  '2026-07-11',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
