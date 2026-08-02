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
  version:    '0.165.0-persistence-trace-rc',
  buildLabel: 'AbuBank — PERSISTENCE_TRACE (session 41). The 0.164.0 durable fix did NOT hold on the physical iPhone: after import → full close → reopen, names + photos remained but ALL phone numbers were gone again (the number-less default seed shape). Rather than guess another storage-policy change, this build adds a PRIVACY-SAFE startup trace (counts only — never a name or number) that records at each boot stage: boot-start localStorage contact/phone count; reconcile localStorage-vs-IndexedDB counts + which copy WON; store phone count post-init; store phone count post-seed/migrate; and the phone count when Abu WhatsApp actually reads the contacts. The trace persists across the failed reopen (localStorage + best-effort IndexedDB mirror, keyed outside the durable reconcile set) and is rendered as a copyable, read-only textbox in Operator Settings → Contact Management (testid persistence-trace) with Copy/Refresh/Clear. durableStore exposes a one-way reconcile observer (no import cycle). NO reconciliation policy was changed in this build — it is instrumentation to locate the true first divergence. Evidence: CODE + TEST. DEVICE: awaiting the operator-captured trace after a reopen. Builds on 0.164.0.',
  buildDate:  '2026-08-03',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
