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
  version:    '0.261.0-fullname-p0',
  buildLabel: 'AbuBank 0.261.0 — DEVICE P0: full-name lookup fixed. people_lookup("גלעד אבורדי") returned not_found though גלעד is in the dataset — the 739-variant oracle covered given-name spellings but not "given name + unknown surname". Fix: SUBSET matching (peopleModel.subsetResolve) — a spoken multi-word name where exactly ONE person is named by any word WINS even with an unknown surname; several different people → ambiguous (ask), never a silent wrong pick; wired into whoIs + resolveContactTarget. Also matches a given name against the FIRST token of a multi-word display name ("אריאל (בן טאבלה)"). Regression: fullNameLookup.test — גלעד אבורדי→Gilad, EVERY living person findable by givenName+surname (miss 0), "מור לאו"→ambiguous. 272 people tests green. Prior: general search loop (v0.260).',
  buildDate:  '2026-08-15',
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
