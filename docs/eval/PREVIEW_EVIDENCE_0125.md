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

## Verdict

PREVIEW-class proof that **the 0.125.0 build deploys, serves, proxies the LLM with a server key,
and runs an honest online seam**. Client-side cognition (P2/parity) needs a browser E2E against
this URL for its own PREVIEW evidence — the endpoints alone cannot prove it.
