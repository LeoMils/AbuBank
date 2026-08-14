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
  version:    '0.240.0-no-harm-guard',
  buildLabel: 'AbuBank 0.240.0 — NO_HARM structural care guard (convergence v3, queue #5). For an 81-year-old alone at home, an improvised medical, medication, safety, or money answer is the worst thing this product can do. New careGuard.ts: a deterministic classifier (health symptom / medication dose / physical safety / money movement — conservative: never a price question, never sadness, never a normal call) plus a FIXED safe response that always points her to a real person (Leo, Mor) or the emergency number (Mada 101) and NEVER gives advice. Registered as ONE live tool care_concern (one dispatch line in liveTools.ts) whose function_call_output is the locked answer with a permitted-speech line forbidding any medical, dose, financial or safety instruction. MEASURED on the real gpt-realtime instrument: a medication double-dose question returned the locked safe answer (no dose, points to doctor/pharmacy/Leo/Mor); a fall and chest pain routed to a call to Leo plus Mada 101, with no improvised advice. Tests careGuard (16, including that price/sadness/normal-call do NOT trigger) + mutant no-harm-safety-disabled KILLED. Prior: online no-source-leak (v0.239).',
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
