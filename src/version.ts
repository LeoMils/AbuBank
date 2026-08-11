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
  version:    '0.211.0-family-decisions-closed',
  buildLabel: 'AbuBank 0.211.0 — the four flagged family decisions, now closed: (1a) maiden name is canonical Müller, with Muller/Miller as aliases so all three resolve to Martita. (1b) Alon = Ayalon confirmed as one person (Alon/אלון are aliases; the identity-conflict flag removed). (1c) the Yefi bundle IS Rafi — accountant / finance manager at a cosmetics-field company, lives Rosh HaAyin, loves wine + food, forgets to bring wine, not a good cook; Nili added as her own person (Argentine nurse, Rafi partner, Rosh HaAyin); unresolved_identities removed. (1d) the wine conflict resolved as TWO facts: Martita does NOT drink red wine (removed; never offer it), her drinks are sweet white wine + shandy only; Papi loved red wine; red wine stored per-person on Rafi, Mor, Leo, Noam, Ofir, Adar, Yael, Eili, Yarden and Gilad — the family drink. Five open questions closed; family 67 -> 68 people. Evidence: CODE + AUTOMATED TEST — validators + full suite 12387 green.',
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
