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
  version:    '0.222.0-name-fuzzy-phonetic-match',
  buildLabel: 'AbuBank 0.222.0 — P8 (names): a misheard name now finds the right person before not_found. Names are the most important words in this product and the transcriber mishears them (סוזי as סוסי, a garbled friend). Added a SAFE fuzzy layer used ONLY after an exact match and a descriptive-phrase parse have both missed: a Hebrew phonetic normalisation that collapses the sounds the STT confuses (ז/שׁ/שׂ/צ all into ס, silent א/ע/ה dropped, ו/ב and כ/ק/ח and ט/ת merged, final forms and doubles normalised) plus a bounded edit distance. It returns a candidate ONLY when it is both close enough (similarity ≥ 0.72) AND unambiguously closer than the runner-up (margin ≥ 0.12), so a near-miss finds the intended person while an ambiguous or garbled input stays an honest not_found — never a wrong guess, which would be worse. Wired into whoIs and resolveContactTarget as a fallback, so exact behaviour is unchanged and the fuzzy layer only helps on a miss. Proven: אופירה resolves to Ofir and סוסי to Susi, while אבוקדו / בוריס / מזג האוויר stay not_found; the full suite (12,660) confirms no existing not_found regressed, so the thresholds are conservative. Note: the transcription bias already lists the friends within the 1024 cap; this fuzzy layer is the complementary catch when the bias still slips. Evidence: CODE + AUTOMATED TEST. typecheck + full suite + build. Prior: Companion Brain P0-P3 (v0.220), P5 behaviour+safety (v0.221). Next: P7 online depth, P9 companion suite, P6 actions polish.',
  buildDate:  '2026-08-13',
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
