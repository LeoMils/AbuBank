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
  version:    '0.259.0-source-gaps',
  buildLabel: 'AbuBank 0.259.0 — TRACK D: closed the closable M2 source gaps. detectSourceNamed now catches (1) a dot-less spoken domain ("seret co il" — the transcriber drops the dots) via a space-separated TLD-pair pattern; (2) a named/transliterated source ("בוויקיפדיה", "בגוגל", ynet, wisebuy…); (3) "אתר של"/"ראיתי באתר" provenance. detectReadBack now strips punctuation so a comma-dropped echo is caught. Re-measured (adversarialCorpus, 369 cases): SOURCE_NAMED 108/108, READ_BACK 10/10 = 100% interception, still 0 false positives over the clean set (new plain-Hebrew guards added). ONE gap remains and is stated plainly: a read-back broken by an INSERTED word defeats a contiguous-run check — closing it needs fuzzy/token-overlap matching with real FP risk vs a genuine paraphrase, not done speculatively. Prior: M3 title fix (v0.258).',
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
