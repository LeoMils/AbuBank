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
  version:    '0.210.0-family-knowledge-master',
  buildLabel: 'AbuBank 0.210.0 — master family knowledge update: merged the full human source of truth into knowledge/family_data.json, growing the family from 21 to 67 records (Martita birth family, Papi family, the Vancouver / LA / Mendoza branches, and the Kfar Saba + Argentine friends circle) — all MERGED not replaced, with distinct ids for the two Ariels and two Oscars, uncertainty and 25 open_questions tracked, the unresolved Yefi-maybe-Rafi bundle kept unattached, and PII (address / phone / national ID) intentionally excluded and documented. Wired a role-based extended_family group into the live people model, contacts and pronunciation so the new people are known and Spanish-pronounced in speech; deceased relatives are knowable but never reachable. Added Martita personal facts (hates cilantro + cinnamon, sweet white wine + shandy, loves TV / sushi, Tuesday at Mor, home as the gathering place, car, tech) to martita_personality.yaml and the live abu-knowledge profile. Fixed a response-shaper bug that mislabelled any husband-of-X as your-husband, and a normalizeName over-strip that collapsed Sharon into Ron. Evidence: CODE + AUTOMATED TEST — full suite 12387 green, all knowledge validators + build green, and a deterministic speech-reachability check (friend origins, two Ariels never confused, unknown to not-found, deceased decline).',
  buildDate:  '2026-08-11',
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
