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
  version:    '0.191.0-live-name-pronunciation-spanish-rc1',
  buildLabel: 'AbuBank 0.191.0 — LIVE_NAME_PRONUNCIATION_SPANISH_RC1: the pronunciation rule reduced to its simplest form — every family name is pronounced by READING ITS LATIN SPELLING AS SPANISH (pure Spanish vowel values, Spanish stress; no English vowel shifts, no English stress). knowledge/family_data.json now stores each person’s pronunciation as { es: <latin spelling> } for 16 people (leo, mor, rafi, ofir, gilad, anabel, ari, adar, eilon, ilay, yarden, adi, noam, yael, martita, papi); buildPronunciationGuidance projects them into the "# How to Say Names" section with NO invented respellings (replaces the old free-text "LEH-oh"). DATA CORRECTIONS: עדי/Adi and נועם/Noam are MALE — corrected in abu-family.md (were gender-ambiguous "ילד/ה" and listed under "unknown"); family_graph.json + genderMatrix already had them male (verified, unchanged). ALIASES: eilon (canonical Ayalon/איילון) and ilay (canonical Eili/עילי) added so both spellings resolve; canonical Hebrew spellings unchanged. victor = Papi’s given name and abu/marta are Martita nicknames — covered by the global Spanish rule. Evidence: CODE + AUTOMATED TEST (pronunciation data + rule, Adi/Noam-male in prose + live instructions, eilon/ilay resolution; full suite green; typecheck 0; build 0). On-device Spanish pronunciation is PHYSICAL_DEVICE — NOT claimed.',
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
