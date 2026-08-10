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
  version:    '0.192.0-abuela-hub-ia-rc1',
  buildLabel: 'AbuBank 0.192.0 — ABUELA_HUB_IA_RC1 (Part 1 of the Abu-ela restructure): Home is now a HUB listing the Abu family of apps and nothing else. The nine Kfar-Saba services (מזרחי, דואר, MAX, מים, חשמל, ארנונה, HOT, פרטנר, yes) moved intact into a new Abu Bank app (Screen.AbuBank) with an always-visible BackButton to the hub — they are no longer the front door. The hub shows seven apps in order — Abu AI, Abu Bank, Abu יומן, Abu WhatsApp, Abu Games, Abu מזג אוויר, Abu News — each a consistent glass tile (Phosphor icon + accent) on the existing design tokens (starts Part 4). New Abu News app (Screen.AbuNews) is an HONEST shell — no fabricated stories — until Part 3 wires grounded retrieval. HARD CONSTRAINT KEPT: Abu AI opens the LIVE path (openLiveAbu → __abubankOpenLive), never the legacy AbuAI screen; routing is pure data in hub.ts, locked by hub.test.ts and the updated liveEntryPoint guard. Every app returns to the hub via BackButton. Evidence: CODE + AUTOMATED TEST (hub routing/cutover, Abu Bank services-moved; full suite green; typecheck 0; build 0). Parts 2–5 are staged — see report; wiring online into the live honesty guard is deferred as a reviewed change. On-device look/feel is PHYSICAL_DEVICE — NOT claimed.',
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
