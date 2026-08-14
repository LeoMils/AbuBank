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
  version:    '0.243.0-live-reminders',
  buildLabel: 'AbuBank 0.243.0 — REMINDERS on the live path (convergence v3, queue #2). In the trace Abu said she has no way to set a reminder or timer — because the realtime path had no reminder tool, though the full AbuCalendar reminders estate (parser, durable store, due-engine, sound, native delivery) already existed. Fix: registered ONE live tool set_reminder (one dispatch line in liveTools.ts) that parses relative and absolute Hebrew phrasing via the existing reminderParser and creates a durable reminder via createReminder. A local normalization handles the bare singular בעוד דקה (the exact trace phrase INC-07) which the estate parser did not. The permitted-speech line forbids ever saying she cannot set a reminder; a missing time asks rather than refuses. MEASURED on the real gpt-realtime instrument: בעוד דקה gave a real reminder at a concrete time; כל בוקר בשמונה gave a recurring reminder. Tests reminderLive (5: relative/absolute/recurring/needs-detail/registered) + mutant live-reminder-not-persisted KILLED. The popup, sound, fires-on-time and reload-survival are handled by the existing ReminderDueEngine + reminderSound + durable store — DEVICE-VERIFICATION items (audio/device stays out per rule E). Prior: care+memory refine (v0.242).',
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
