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
  version:    '0.169.0-canonical-ios-container-guard-rc',
  buildLabel: 'AbuBank — CANONICAL_IOS_CONTAINER_GUARD (session 46). Acts on the forensic result (no in-process phones>0->0 transition; the only device hypothesis is Safari-tab vs installed-PWA storage-jar isolation) by pinning ONE canonical iPhone entry: the installed Home-Screen PWA on abu-ela-rc.vercel.app. New iosContainer.ts detects the environment privacy-safely (host, display-mode, navigator.standalone, iOS, locally-generated container id, last-save container id, contact/phone counts, high-water) and classifies CANONICAL_PWA / SAFARI_BROWSER / WRONG_HOST / UNKNOWN_IOS_CONTAINER / POSSIBLE_EXTERNAL_STORAGE_LOSS / NON_IOS_OK. On an iOS Safari tab (wrong jar) normal import/save is BLOCKED with prominent Home-Screen-icon guidance (container-guard-banner) — never a silent import into a jar the PWA cannot read; desktop/operator automation is NOT gated. Every committed save stamps the container id, so a same-jar eviction (POSSIBLE_EXTERNAL_STORAGE_LOSS) is distinguished from a container mismatch. The Operator receipt shows the full container condition + recommended action; the Board focused-contact shows the honest container message, never "not configured" for a container/storage cause. Recovery stays export->import (no auto cross-jar copy, no cloud). Honest limit: a fresh isolated jar cannot see another jar, so a never-saved PWA is indistinguishable from a first run — not overclaimed. Evidence: CODE + TEST (iosContainer 14/14 incl. mutation cases; full suite 0 new regressions) + PREVIEW (two-container e2e). DEVICE: one confirmation only — open from the Home-Screen icon and copy the container receipt. Builds on 0.168.0.',
  buildDate:  '2026-08-03',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
