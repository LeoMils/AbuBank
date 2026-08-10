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
  version:    '0.188.0-live-flight-recorder-rc1',
  buildLabel: 'AbuBank 0.188.0 — LIVE_FLIGHT_RECORDER_RC1 (Part C): observability + turn-health on the live path, a calendar-window read, and a family-source reconciliation guard. (C.1) read_calendar now takes an optional from..to date RANGE — "this week"/"this month" return EVERY event in the window (string YYYY-MM-DD compare, no timezone math), not just one day. (C.2/C.3) New PURE FlightRecorder (liveTrace.ts): records MY speech, HER speech, and every tool call with args+result; flags SILENT TURNS (a turn ending after a tool call with no spoken continuation) and records TRUNCATION EVIDENCE (mic opens while Abu is still speaking — the VAD-interrupt/self-hearing cause of "only the first word heard"). Observation only — no VAD/turn/audio behaviour changed; an operator-facing "תיעוד ⤓" button downloads the whole-session trace. (C.4) familyReconciliation guard: proves canonical spellings (אדר/איילון canonical; הדר/אילון only as aliases), every family_data.json person RESOLVES, Abu is instructed never to GUESS a relationship, and reports drift between family_data.json and abu-family.md — report only, never rewrites data. New aliases in family_data.json (הדר→אדר, אנבל→Anabel, איליי→Eili, מרתה→Martita) with grounded-answer coverage. RECOVERY: a machine shutdown had interrupted generate:knowledge, blanking 16/21 per-person YAMLs; regenerated from the intact family_data.json — validate:knowledge + validate:family green. Evidence: CODE + AUTOMATED TEST (Part C tests green; typecheck 0; build 0). On-device trace/audibility are PHYSICAL_DEVICE — NOT claimed.',
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
