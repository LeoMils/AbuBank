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
  version:    '0.215.0-one-retrieval-path',
  buildLabel: 'AbuBank 0.215.0 — FIX 1+2: ONE retrieval path for all people (the "who is Susi → not_found while Elsi answered fully" smoking gun). Root cause: the extended family was role-only and never wired into the derived kinship graph — Martita had NO spouse edge to Papi, no parents, no siblings, and the entire Papi side was disconnected — so whoIs worked (via role) but relationshipBetween/relativesByKind returned empty for a whole tier. Fix (fix the graph, do not keep a second tier): the source of truth now carries the missing structural edges (Martita↔Papi spouse; Dora+Jacobo as her parents with Luis+Bobby as siblings; Jose as the father of Papi with Tavela + brothers as his siblings; children edges hanging Jorge/Fabi/Martin, Rosita/Lior/Yoav/Ron, the Vancouver sons of Tavela, the son of Bobby off the graph), so EVERY person now derives by name, alias, and relationship on one path. FIX 2: when no single kinship term exists (the husband of a niece, a grand-nephew), a bounded BFS DESCRIBES THE PATH in Hebrew ("גלעד בעל של אופיר, שהיא בת של מור, שהיא אחות של לאו") instead of saying "no relation". Added friendsOf for "my friends", and סוסי as an STT-variant alias of Susi. Proven by a new reachability harness that queries every one of the 68 people by name AND relationship: BEFORE 31 failing, AFTER 0 (215/215). Full suite 12,618 green (the graph change destabilised nothing). Evidence: CODE + AUTOMATED TEST. Still open (separate subsystems, not in this build): FIX 3 history retrieval, FIX 4 conversation_already_has_active_response crash, FIX 5 tool timeouts, FIX 6 news/cinema depth, FIX 7 the instantAcknowledgement preamble seed, FIX 8 audio.',
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
