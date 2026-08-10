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
  version:    '0.189.0-live-name-pronunciation-rc1',
  buildLabel: 'AbuBank 0.189.0 — LIVE_NAME_PRONUNCIATION_RC1: names are SPOKEN by an explicit per-language pronunciation field, never by English spelling. Each person in knowledge/family_data.json may carry an optional "pronunciation" map (language → the spoken form of the name); buildPronunciationGuidance() projects it into a new "# How to Say Names (Pronunciation)" section of buildLiveInstructions(), so the Realtime session is instructed to pronounce each name as written and NEVER anglicize it. Seed: לאו / Leo = Spanish "LEH-oh" (two clear syllables as written), never the English "LEE-oh". The field flows to the generated per-person YAML + memory automatically (validate:knowledge + validate:family green). A text-harness scenario asserts the guidance reaches the SESSION payload the wire sends (byte-identical to the voice session.update). Evidence: CODE + AUTOMATED TEST (pronunciation/instruction/harness tests green; typecheck 0; build 0). On-device TTS phonetics are PHYSICAL_DEVICE — NOT claimed.',
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
