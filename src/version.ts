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
  version:    '0.187.0-live-action-cards-rc1',
  buildLabel: 'AbuBank 0.187.0 — LIVE_ACTION_CARDS_RC1 (Part B): every prepared action now produces a VISIBLE card in the live overlay — the card is the receipt, Abu never claims an action in speech alone. Generic senior-first ActionCard (title, body, one large button, dismiss; RTL, large type, high contrast). whatsapp_draft (renamed from prepare_whatsapp, now carries the FULL composed message) renders a card with recipient + message + a Send button opening https://wa.me/<number>?text=… ; phone_call (renamed from prepare_call) renders a card with name + number + a tel: Call button; both resolve the number OUTSIDE the model at the UI layer (reusing whatsappAdapter/phoneAdapter) so no number ever enters the model. Calendar drafts render a draft card (Confirm button → typed confirm into the session) and, after commit, a receipt card showing the fields AS PERSISTED (via new onCalendarSaved). Instructions describe the card and ask her to TAP; a new harness assertion (CLAIMED_UNCONFIRMED_ACTION) fails if Abu says she sent/called. liveSession change is ADDITIVE UI plumbing + a typed-confirm input only — no VAD/turn/audio change. Instruction size 9416→11974 chars (family still embedded — moves to a tool in the family milestone). Harness gpt-4o-mini 39/46 (whatsapp+phone card scenarios PASS; the rest are model clarify/save variance). Evidence: CODE + AUTOMATED TEST (83 card/tool/instruction tests green; typecheck 0; build 0). On-device tap→wa.me/tel and audibility are PHYSICAL_DEVICE — NOT claimed.',
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
