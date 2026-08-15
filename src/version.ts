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
  version:    '0.267.0-layer2-toolfuzz',
  buildLabel: 'AbuBank 0.267.0 — MERGE BLOCKER 1a: Layer-2 tool-arg wiring. toolArgFuzz.test feeds GENERATED malformed args (missing-required, out-of-enum, unknown fields, wrong types, empty, oversized, malformed JSON) to EVERY tool handler — never values verbatim from the schema. Contract proven for all 100 cases: handleFunctionCall never throws, ALWAYS replies (the model never hangs), the output is valid JSON, and no phone number ever leaks. FOUND + FIXED a real defect: oversized input (100k chars) hit a pathological slow path in the date/time/name parsers (a timeout); bounded every tool string arg to 4000 chars in str() so no parser sees oversized input. Cell coverage 56.4% -> 76.7% (tool_failure_path cells now executed). Remaining Layer-2: 19 realtime event invariants + 15 screens. Prior: preamble gap instrumentation (v0.266).',
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
