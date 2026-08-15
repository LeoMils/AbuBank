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
  version:    '0.271.0-earonly',
  buildLabel: 'AbuBank 0.271.0 — LOUD-NOT-SILENT hardening (overnight). (1) DIAGNOSIS: the realtime transport is NOT broken — proven against the real account tonight: the ephemeral MINT returns 200 (free) so the session OPENS, then the first inference returns insufficient_quota/credit_balance_exhausted. Three prior sessions spent ~$0 because the OpenAI PROJECT HAS NO CREDIT, not a transport/auth/endpoint/version bug. Add credits at platform.openai.com to unblock Layer-3. (2) CODE FIX: the realtime error handler now recognises credit exhaustion explicitly — plain-Hebrew fallback to Martita (never raw English), a distinct REALTIME_CREDIT_EXHAUSTED flight stage + loud operator log, pipeline fallback with no retry loop (realtimeCreditExhaustion.test). (3) FLAG PROMOTION LEDGER: src/services/deviceGatedFlags.ts + a boot assertion in main.tsx HARD-FAIL if a device-gated flag (audio-tune/barge-in/prefetch) was ear-confirmed but still ships OFF — the ONLINE_DEEP_FETCH silent-drop hazard is now machine-caught, not a comment. Layer-3 real-model run stays BLOCKED on account credit. Do NOT merge (production serves Aug 5). Prior: EAR-ONLY (v0.270).',
  buildDate:  '2026-08-15',
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
