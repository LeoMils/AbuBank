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
  version:    '0.164.0-durable-persistence-and-luxury-contact-rc',
  buildLabel: 'AbuBank — DURABLE_PERSISTENCE + LUXURY_CONTACT (session 40). ROOT-CAUSE fix for the reported "phone numbers vanish on reopen" loop: the DurableStore startup reconcile was BACKEND-authoritative — on init it overwrote the synchronously-written localStorage mirror with the async IndexedDB copy, which on iOS often had NOT flushed the freshly-imported contacts and still held the number-less seed, so every reopen clobbered the good phones with the stale seed. Now localStorage is the LIVE authority: a PRESENT, structurally-valid (JSON-parseable) mirror WINS and is synced FORWARD into cache+backend; the backend only RECOVERS an evicted (empty) OR corrupt key. Import → leave → reopen now keeps the numbers. Failing-first regressions added in durableStore.test.ts (present-LS-not-clobbered, evicted-key-recovered); corruption-repair contract preserved. Second change: the focused-contact scene (tap a bubble → Call/WhatsApp) is redesigned into a full-bleed hero-photo "premium caller card" — the contact photo IS the screen, with a legibility scrim, warm gold hairline vignette, and a bottom glass panel holding the large name, relationship, and two 92px action buttons (WhatsApp + Call) plus the voice-compose pill in the thumb zone. Bigger picture, calmer, luxury tone; every testid preserved. Evidence: CODE + TEST — durable + contacts suites 54/54; DEVICE NOT PROVEN (reopen persistence + audibility require physical iPhone). Builds on 0.163.0.',
  buildDate:  '2026-08-02',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
