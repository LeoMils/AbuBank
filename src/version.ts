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
  version:    '0.209.0-device-trace-defects',
  buildLabel: 'AbuBank 0.209.0 — device-trace defects 1-6 + online diagnostic. (1) No preambles / no repeated openers: stripped the seeded filler menu from abu-persona.md, added a tool-agnostic guard (every owned tool speaks in the same turn) + harness assertions REPEATED_OPENING_PHRASE / ANNOUNCED_CHECK. (2) Audio truncation: turn_detection.interrupt_response=false so a self-hearing echo can never trigger a server-side cut of Abu after one word (create_response stays true). (3) people_lookup never guesses: a descriptive phrase resolves against its NAMED anchor ("הבת של רפי" -> Rafi child) or not_found, never a fuzzy substitute. (4) Mouth on iOS: a dead-analyser fallback animates the mouth from the speaking state (iOS reads the remote stream as a defined 0), plus a muted media-element sink to unblock the analyser. (5) Calendar: multiple named participants + any spoken name accepted even when not a contact (relationship phrases still refused). (6) Reaching the deceased (פפי) is a gentle decline, never a call card or a wrong relationship answer; still knowable via who/remember. Also: /api/abuai-online returns a non-secret diag (provider/keyPresent/reached/sourceCount/outcome) and the Tavily topic=news pin was removed. Evidence: CODE + AUTOMATED TEST across the suite. On-device audio/mouth remain PHYSICAL_DEVICE / HUMAN-EYE - not claimed.',
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
