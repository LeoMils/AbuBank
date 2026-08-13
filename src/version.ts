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
  version:    '0.235.0-heartbeat-alert',
  buildLabel: 'AbuBank 0.235.0 — O5 heartbeat alert sink CLOSED. Before: the nightly cron always emitted "🟢 הכל תקין" WITHOUT checking anything — a deployed outage or missing-env misconfig reported green (a silent failure). Now: new src/services/healthAlert.ts (probeHealth + pure evaluateHealth, 7/7) actually probes the deployment own /api/health; unreachable OR ok=false ⇒ a RED Hebrew line + Leo notification fires through the EXISTING sendNotification sink (email via Resend when RESEND_API_KEY + recipient are set, else the Leo-only status page). Wired into api/cron/nightly.ts (payload.ok now reflects real health). Residual (env/product decision, documented): email delivery needs RESEND_API_KEY + LEO_EMAIL; a client last-seen beacon (detect "Martita stopped opening it") needs a provisioned store. Evidence: 7/7 + full suite. Prior: adversary (v0.234).',
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
