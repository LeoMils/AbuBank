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
  version:    '0.166.0-qa-ownership-and-storage-diag-rc',
  buildLabel: 'AbuBank — QA_OWNERSHIP + STORAGE_DIAG (session 42). Claude Code now owns the persistence lifecycle QA that was being handed to Leo. A PERSISTENT-PROFILE lab (e2e/persistence-lifecycle.spec.ts) drives the REAL deployed Contact Management import, then TERMINATES (closes the browser profile) and REOPENS the SAME on-disk profile x5 on the stable origin — in BOTH Chromium AND WebKit. Result: phones SURVIVE every reopen, the Family Board Call button stays live, and NO JSON re-import is needed. So the app storage code does not lose data on reopen in either engine; the 100%-reproducible device loss (seed names+photos survive, phones gone) is consistent with an iOS standalone-PWA-vs-Safari-tab storage PARTITION or ITP eviction — not the reconcile logic. Per the mission rule, NO storage policy changed until the exact device transition is proven. To make that a ONE-capture confirmation, the boot trace now records a privacy-safe environment fingerprint (display-mode, iOS standalone flag, storage.persisted(), usage/quota) and a gesture-time navigator.storage.persist() request on every import/save (a durability hint, not a policy change). Gate 0 artifacts added: docs/engineering-os/qa/{mission,qa-ownership,evidence}.json classify every acceptance item CLAUDE_MUST_PROVE vs PHYSICAL_IPHONE_ONLY. Evidence: CODE + TEST + PREVIEW (2-engine persistent-profile lab). DEVICE: one enriched-trace capture will confirm the storage-partition hypothesis. Builds on 0.165.0.',
  buildDate:  '2026-08-03',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
