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
  version:    '0.252.0-monitor-adversarial',
  buildLabel: 'AbuBank 0.252.0 — M2 adversarial interception proof. The prior monitorProbe caught 0/5 real turns — five clean turns prove nothing about whether the detectors FIRE. adversarialCorpus.ts GENERATES 364 model-free cases (232 engineered violations + 132 clean/borderline built to fool each detector; no value taken verbatim from outputMonitor.ts — anti-circularity). MEASURED per detector: LANGUAGE_IMPURE 65/65, SOURCE_NAMED 105/105, TOO_LONG 25/25, READ_BACK 9/9, LITERAL_COUNT 28/28 = 100% interception, 0 false positives over 128 clean cases. Four regex-uncatchable defects reported honestly as GAPS (a dot-less spoken domain, a Hebrew-transliterated source, an "אתר של" with no domain, a punctuation-broken read-back) — documented not hidden, asserted so a future change that closes one is flagged. Proves the detectors are perfect-not-broken on the engineered corpus. Report: docs/eval/MONITOR_ADVERSARIAL_REPORT.md. Prior: prefetch warm store (v0.251).',
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
