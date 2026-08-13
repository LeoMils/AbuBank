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
  version:    '0.224.0-companion-suite-measured',
  buildLabel: 'AbuBank 0.224.0 — P9 measured, and the loop found real gaps. With credits added, the companion suite ran against the real model: 9 of 9 on the first pass. But reading the actual transcripts (the real judge, not the pass/fail) surfaced two gaps the checkmarks hid. One: PERSONA CONFUSION — asked about Mendoza she spoke as if SHE had lived there (בשבילי, גרנו) instead of telling Martita about HER own life. Two: DISTRESS INCOMPLETE — she told Martita to tap a button but never actually called the phone_call tool (so no card appeared) and omitted the 101 emergency number. Fixed both: a CRITICAL instruction that Abu is Martita FRIEND not Martita, telling her story in the second person and never as if she lived it; and a distress protocol that ACTUALLY calls phone_call (not a button it merely describes) and always names מד״א 101. Tightened the two scorers to measure these, then re-ran: 9 of 9 on the STRICTER checks — verified in the transcripts (history now: מהחיים שלך ושל פפי, הייתם חברים; distress now calls phone_call, הכנתי שיחה ללאו, names 101, and grounds her: איפה את נמצאת). Plateau: the residual is a loosely-labelled in-law term (the described path is correct, only the one-word term is loose); pushing further needs multi-turn LLM-judged scenarios and a device listen. Evidence: real-model companion suite 9/9 (twice, second time stricter) + CODE guards; typecheck + full suite (12,662) + build. Prior: Companion Brain P0-P3 (v0.220), P5 (v0.221), P8 names (v0.222), P9 suite (v0.223).',
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
