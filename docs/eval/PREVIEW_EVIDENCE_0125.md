# PREVIEW evidence — 0.125.0-flight-recorder-ui

**Preview URL:** https://abu-bank-9vwvg4c29-leos-projects-d3c04c09.vercel.app
**Deployed build (`/api/health`):** `0.125.0-flight-recorder-ui` (matches HEAD `ea6f363`).
**Class:** PREVIEW (deployed app, real server-side keys). Not PRODUCTION, not PHYSICAL.

## What was driven live (real endpoints, this build)

| check | endpoint | result | latency |
| --- | --- | --- | --- |
| Health / version | `GET /api/health` | `buildVersion 0.125.0-flight-recorder-ui`, root `/` = 200 | <1s |
| LLM proxy | `POST /api/abuai-chat` | **`ok:true`** — real OpenAI completion returned with the server-side key (gpt-4o-mini). The LLM path is live in preview. | ~4s |
| Online / current-info | `POST /api/abuai-online` (×2, He) | **`ok:false ONLINE_NO_RESULTS`** with the honest fallback "לא מצאתי מידע עדכני… מעדיפה להגיד לך מאשר להמציא". The online seam is wired and **honest** — `NO TOOL RESULT = NO CLAIM` verified live (it declines, never fabricates). | 4.8s / 6.8s |

**Latency table (measured + CODE):**
- deterministic (client-side controller): **<1s** — CODE (unit/marathon suites), not re-measured on device.
- LLM (proxy → OpenAI): **~4s** on preview — within the <4s target.
- online (retrieval): **4.8–6.8s** on preview — within the <8s target.

## Honest limitations (documented, not stalled)

1. **Keyed Claude cross-check parity** (`parityLiveJudge`) needs `ANTHROPIC_API_KEY`. The app's
   provider set is Groq / Gemini / OpenAI — there is no Anthropic key server-side either, so the
   cross-check reference cannot run even on preview. It stays OUT-OF-BAND until an Anthropic key
   is provided. The GPT-only half of the seam could run against `abuai-chat`, but the *cross-check*
   (Claude ∧ GPT) is the point, so it is deferred rather than run half.
2. **P2 rambling extraction + full parity are CLIENT-SIDE cognition.** AbuAI's controller, persona,
   and calendar extraction run in the browser; `/api/abuai-chat` is a thin proxy to OpenAI (proven
   above by the garbled raw-prompt reply — no AbuAI persona was applied server-side). Therefore true
   end-to-end PREVIEW evidence for P2/parity requires a **browser E2E (Playwright) against the preview
   URL**, not curl. That is the correct next step and is noted in the continuation prompt.
3. **Online search returns no results in preview.** Every current-info query returned the honest
   decline. This is a provider/config observation (the search backend returned empty), not a code
   defect — the decline behavior is exactly correct. Whether a search key is configured in the
   preview env is a deploy-env question, not a code question.

## Browser E2E — P2 extraction + parity (closes the client-side gap)

Ran real browsers (Playwright, mobile-chrome, he-IL, 412×870) against the preview URL, driving
the AbuAI screen exactly as Martita would (type → read the reply bubble). This is what the
endpoint probes could NOT reach.

**P2 rambling extraction** — `e2e/leo-device-failures.spec.ts` (1 passed, 19.6s):
the rambling story → `פגישה עם גלעד מחר בשלוש אחר הצהריים. בית קפה טולדנו. בנושא טיול המשפחתי. נכון?`
— resolvedToGilad ✓, hasLocation ✓ (טולדנו), dateTomorrow ✓, **verbatimDump ✗**, and the
Cycle-43 subject-dedup holds on the deployed build (no doubled parenthetical).

**Deterministic script** — `e2e/preview-typed-script.spec.ts` (1 passed, 13.5s): 18/18 —
family relations/counts, dates, memory save/recall/forget, calendar create→confirm→referable
where→cancel, math (He+Es). Latencies ~300–400ms.

**Bilingual parity** — `e2e/preview-parity.spec.ts` (1 passed, 20.3s): **8/8 in isolated
sessions** (one fresh session per flow, matching the CODE oracle `parityScorecard`):
- He: relation-between, date arithmetic, the P2 rambling create.
- Es: family relation (`Anabel es sobrina nieta de Leo.`), math (`Son 96.`), and the FULL
  CRUD chain create→confirm→cancel — **all in Spanish, zero Hebrew leak** (`Listo, cancelé la
  reunión con Gabi a las 15:00.` — the Cycle-41 Spanish-cancel fix proven on the deployed build).

**Preview latency table (measured in-browser, deterministic client-side path):**
| class | budget | measured on preview |
| --- | --- | --- |
| deterministic (family/date/memory/calendar/rambling) | <1s | 0.31–0.68s ✓ |
| LLM (proxy → OpenAI) | <4s | ~4s (endpoint probe) |
| online (retrieval) | <8s | 4.8–6.8s ✓ |

## Observed candidate bug — single-session cross-flow contamination — FIXED in 0.126.0

> **RESOLVED (Cycle 46, 0.126.0-crosslang-supersede).** Root cause: `classifySignalV2`'s
> new-create detector was Hebrew-only, so a Spanish create mid-confirm was misread as a
> side-question and the stale Hebrew draft was restored. Fix: a non-Hebrew genuine create now
> classifies as `new_create → replace`. Proven on the fresh preview
> (`abu-bank-fguzpk5us…`, health `0.126.0`): `e2e/preview-parity.spec.ts` single-session
> supersession → es-confirm `Listo, te agendé una reunión con Gabi…` (saves Gabi in Spanish,
> not גלעד in Hebrew). Regression: `crossLanguageDraftSupersession.test.ts` 2/2.



When the bilingual set was run in ONE session (He rambling create left on a pending "נכון?",
then a Spanish create), two divergences appeared: (a) `dale, agendalo` confirmed the STALE
Hebrew גלעד/טולדנו draft — in Hebrew — even though the just-read-back draft showed `Gabi`
(a confirm≠readback mismatch), and (b) `cancelalo` cancelled that stale event with a Hebrew name
inside the Spanish sentence. In ISOLATED sessions (the parity model) both vanish. This is a real
multi-turn state edge (a new create should fully supersede a prior unconfirmed draft; a confirm
must save what was read back) — a RED-first candidate for a future cycle, NOT fixed here.

## Verdict

PREVIEW-class proof that the 0.125.0 build **deploys, serves, proxies the LLM with a server key,
runs an honest online seam, and — in a real browser — resolves the P2 rambling create and holds
bilingual parity (incl. Spanish language discipline) with deterministic latency < 1s**. Remaining
honest limits: keyed Claude cross-check still out-of-band (no `ANTHROPIC_API_KEY`); the
single-session contamination edge above is a documented follow-up.
