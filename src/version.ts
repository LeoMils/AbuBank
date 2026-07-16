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
  version:    '0.112.0-ui-cutover',
  buildLabel: 'AbuBank — UI_CUTOVER (Intelligence, text-layer): index.tsx now routes calendar DELETE + UPDATE through the cognitive runtime (RUNTIME_OWNED += calendar_delete/calendar_update) and PERSISTS the conversation focus across turns (cogFocusRef, set after a save) — so referable reads ("איפה אני פוגשת אותו?") and pronoun mutations ("תבטלי אותה" / "תעבירי אותה ליום ראשון") now reach Martita in the app, with a human Hebrew date readback. The DUPLICATE delete/modify handlers in index.tsx are removed — one runtime path per capability. (Create/confirm keep their existing path; math/general/online are model/online by design.) Evidence (CODE + source-contract): calendarReferableMutation 7/7 (runtime behaviour + a cutover wiring contract); full suite 10986 pass/2 todo; typecheck + build clean. Live-app behaviour is PREVIEW-pending. Voice/Realtime untouched. Builds on 0.111.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
