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
  version:    '0.248.0-input-oracle',
  buildLabel: 'AbuBank 0.248.0 — P0 INPUT ORACLE: a misheard name no longer returns not_found. On the device people_lookup for "גילעד" returned not_found — STT added a yud, the dataset spells "גלעד", and the family tests fed names spelled exactly as stored (input-side circularity, the Gilad problem again on the input side). Fix (resolver): a matres-lectionis SKELETON drops the optional yud/vav STT freely adds or drops and resolves the mangled name; resolvePersonId now indexes and tries BOTH the true base form and the prefix-stripped form, so names that START with a prefix letter (לאו, מור, מרתה) match by their true spelling and prefixed forms still reduce onto them; the reach path returns AMBIGUOUS (asks which one, naming a deceased match too) instead of not_found or a wrong edit-distance guess. Generator: sttVariants() produces realistic STT variants (yud/vav insert and drop, final forms, sibilant/guttural swaps, prefix, spacing) with no hand-written lists. Standing Layer-1 rule enforced by inputOracle.test: no test feeds a value verbatim from the source it validates against; every one of the 65 names is run through generated variants; not_found=0 and wrong=0 on the recoverable set (739 variants), with genuinely-indistinguishable variants (empty skeleton, or a skeleton belonging to another person) excluded and documented. Gates: typecheck 0, full suite 12,771 passed, build ok. Prior: family never-null + dead anti-preamble text (v0.247).',
  buildDate:  '2026-08-14',
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
