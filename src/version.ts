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
  version:    '0.182.0-m2m3-live-rc1',
  buildLabel: 'AbuBank 0.182.0 — M2M3_LIVE_RC1: Abu live path gains KNOWLEDGE + CALENDAR + ACTIONS on the M1 voice path (unchanged conversation core). Instructions assembled AT BUILD TIME from THREE editable knowledge files — knowledge/abu-persona.md then abu-family.md then abu-knowledge.md verbatim (Vite ?raw), so editing any reaches Abu next deploy with no code change. New deterministic tools wired into the live session: resolve_contact (id | AMBIGUOUS | NOT_FOUND — a relationship phrase like "אח של מור" can never resolve to a person; no phone numbers ever enter the model); read/prepare/correct/confirm/cancel calendar reusing the typed draft kernel with exactly-once commit + durable read-after-write; prepare-only WhatsApp/Call (nothing sends or dials). Feminine Hebrew + Rioplatense Spanish. Evidence: CODE (liveContacts/liveTools/liveInstructions/liveSession tests; typecheck 0; build). PHYSICAL_DEVICE (Leo iPhone five-minute Hebrew call) NOT claimed.',
  buildDate:  '2026-08-09',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION
