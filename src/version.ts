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
  version:    '0.241.0-live-memory',
  buildLabel: 'AbuBank 0.241.0 — PERSISTENT MEMORY on the live path (convergence v3, queue #1). In the trace Abu repeatedly told Martita she cannot update anything (a death, a new family member) — because the realtime path had NO memory tool, even though the durable saved-memory store already existed for the typed path. Fix: registered ONE live tool remember (one dispatch line in liveTools.ts) that durably saves a fact via the existing savedMemory store (IndexedDB + localStorage, privacy-enforced), and injects saved facts into every session so they are known next time. The permitted-speech line FORBIDS ever saying she cannot update. Sensitive facts (phone/medical/financial/street) are declined gently at the write boundary. MEASURED on the real gpt-realtime instrument: a death update now calls the remember tool and Abu says she will remember (no more I-cannot-update); a new-family-member update saves + confirms. Tests persistentMemoryLive (7, incl cross-session injection + sensitive-declined) + mutant live-memory-not-persisted KILLED. Prior: no-harm guard (v0.240).',
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
