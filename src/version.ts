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
  version:    '0.278.0-earonly',
  buildLabel: 'AbuBank 0.278.0 — GOLDEN-SESSION + ENFORCE (overnight): the repo now has its FIRST whole-conversation test. src/services/goldenSession.ts defines one scripted greeting-to-goodbye arc; the deterministic contract blocks the build, and scripts/golden/golden-session.mjs drives the REAL gpt-realtime through it. Top-line metric = does a full session complete with every turn correct and no dead ends. First real run 14/18 → after fixes 17/18. FOUND+FIXED (verified on the model): calendar stalled in "offer" mode (asked permission to prepare) → a concise instruction nudge makes prepare_calendar_event fire immediately (calendar create/confirm/readback all green now, under the 14000-char ratchet). FOUND+FIXED: the instrument tested a STALE 35k-char snapshot vs the real 13.9k instructions — sessionSnapshot.gen.test.ts now regenerates it every build (tested=deployed). ENFORCE (Part 4): the hard zero-FP output detectors (language purity, source-naming, literal-count) now REPAIR, not just observe. #2 message-routing explained (model does call people_lookup for unknown names, declines honestly). Open low-sev: online follow-up does not always re-ground (honest, not a dead end) — 17/18, NOT faked. Prior: TOOL-RESULT-HANG (v0.277). Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
