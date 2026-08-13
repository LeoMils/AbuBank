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
  version:    '0.217.0-no-announce-before-checking',
  buildLabel: 'AbuBank 0.217.0 — FIX 7: the announce-before-checking preamble ("אני אבדוק במקורות" and its Spanish twin) that survived five sessions. Mechanism confirmed before removing anything: the LIVE VOICE path emits no pre-tool speech in code (liveSession/liveTools inject none) — the preamble is the realtime MODEL generating filler under a rule that only forbade present-tense fillers, never the future-tense "אבדוק", the "sources" variant, or the Spanish "lo miro". The codebase seed of those exact phrases, src/screens/AbuAI/instantAcknowledgement.ts, turned out to be DEAD (no runtime caller — test-only), so it was not the live source but a latent seed. Fix: (1) the live "# Before a Tool Call" rule is rewritten to forbid announcing a check in ANY language or tense, naming the exact phrases, with "the FIRST words out of your mouth are already the answer". (2) the instantAcknowledgement seed is neutralised — every tool/lookup mode now returns an empty ack (stay silent) and only warm non-announcing conversational openers remain. (3) a BUILD-FAILING guard (announceBeforeChecking.guard.test.ts) asserts the strong live rule is present AND that no ack can announce a check, so the phrasing can never be re-seeded. Instructions stay under the 1024/10000 provider caps. Evidence: CODE + AUTOMATED TEST. Not device-proven that the model now never preambles — that is model behaviour under the strengthened instruction and needs a device listen. Prior in this branch: FIX 1+2 (v0.215) one retrieval path, FIX 4 (v0.216) the active-response crash. Still open: FIX 5 tool timeouts, FIX 3 history retrieval, FIX 6 news/cinema depth, FIX 8 audio.',
  buildDate:  '2026-08-13',
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
