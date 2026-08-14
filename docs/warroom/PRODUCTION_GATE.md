# PRODUCTION GATE — ranked (last build)

## Gate result — GREEN (code side)
| gate | result |
|---|---|
| `tsc --noEmit` | ✅ 0 |
| full suite (`vitest run`) | ✅ **12717 passed**, 1 skip, 2 todo (485 files) |
| `vite build` | ✅ 0 (PWA precache generated) |
| `validate:knowledge` | ✅ ALL PASSED (68 people in sync) |
| `validate:family` | ✅ ALL PASSED |
| mutation harness | ✅ **18/18 (100%)**, control OK |

Every code-findable gate passes. What remains is not code.

## The one ranked list

### 🔴 Blocks shipping to Martita
| # | blocker | needs |
|---|---|---|
| 1 | **Physical-device voice acceptance** — does she HEAR Abu (full sentence, no cut-off), does STT understand real 80+ Argentine-accented Hebrew/Spanish, does the reply feel fast (not ~20s), does barge-in feel natural, does Abu SOUND warm. These are the Acceptance Board's standing RED rows. | **Leo's iPhone** (human ears; not code-findable) |
| 2 | **Deploy to Production + reach her device** — `vercel deploy --prod` is a human STOP condition; the SW update must actually land on her installed PWA (never mid-conversation). | **Leo's action + judgement** (Vercel auth, `--prod` approval) |
| 3 | **Design** — explicitly out of this run's scope; the brief names it as one of the two remaining ship gates. | **Leo's design judgement** |

### 🟡 Should be fixed — does NOT block her using the app
| # | item | needs |
|---|---|---|
| 4 | **Online depth needs a live provider in prod.** Tavily key is DEAD (HTTP 401). The briefing works today on Brave/Perplexity (both LIVE), but the DEPLOYED env must set `ONLINE_PROVIDER=brave` (or rotate `TAVILY_API_KEY`). Until then online current-info safely DECLINES ("I cannot check") — honest, not harmful. | **Leo's env config** (Vercel env var) |
| 5 | **Cost controls not live-wired.** The meter + 70% Leo alert + graceful-degrade (never disconnect) are built + tested; feeding real `response.done` usage in the WebRTC session and swapping the model on degrade is a bounded next step, deliberately not rushed into the device voice path. | code (1 wire-point) + **device verify** |
| 6 | **O-VOICE-ORPHANS** — ~7 now-unreferenced calendar voice modules (tree-shaken from the bundle) should be deleted with their unit tests in a separate safe PR. | code (cleanup PR) |
| 7 | **RESEND_API_KEY + LEO_EMAIL** for real email delivery of the heartbeat + budget alerts (else Leo-only status page). | **Leo's env config** |

### ⚪ Cosmetic / tracked
- Cinema: no reliable structured showtimes without a dedicated `cinema-city.co.il`/`seret.co.il` adapter — Abu honestly points her to the cinema instead. (judgement: is a cinema adapter worth building?)
- Free-tier Groq key scrapable from the bundle (D2) — non-billable, allowed by contract.

## Deployment path — confirmed (one final time)
**What must happen for Martita to have this** (from `PRODUCTION_PATH.md`, unchanged and re-confirmed):
1. `npm run build` — ✅ green this run.
2. `npx vercel deploy --yes` → immutable Preview URL. *(needs Vercel auth — human)*
3. `npx vercel alias set <preview-url> abu-ela-rc.vercel.app` → the CANONICAL stable origin, so her IndexedDB contacts/calendar/history persist across updates (same origin every time).
4. `curl https://abu-ela-rc.vercel.app/api/health` → assert `buildVersion == 0.238.0-online-depth`.
5. For PRODUCTION (not RC): `vercel deploy --prod` — an explicit human STOP condition, never autonomous.

**Version contract in sync** — `src/version.ts` ⇆ `api/health.ts` (`0.238.0-online-depth`), enforced by `version.test.ts` (22/22), so step 4's check is pre-validated at CODE class.

## Rollback — still proven
One action re-aliases the previous immutable deployment:
`npx vercel alias set <previous-deployment-url> abu-ela-rc.vercel.app`.
**Data-safe by construction:** Martita's data lives CLIENT-SIDE (IndexedDB via
`services/durableStore` + localStorage) on her device; a server re-alias swaps only
the served bundle and never touches her storage → rollback preserves her
calendar/contacts/history. (Caveat unchanged: a rollback that also reverted a
durableStore SCHEMA migration could mismatch; current stores are additive/versioned.
This run added NO durableStore schema change.) Live execution needs Vercel auth (human).
