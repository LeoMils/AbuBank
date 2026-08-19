# ONLINE DEPTH (Item 3) — real headline counts, provider health, cinema verdict

**Evidence class: PREVIEW** — real keyed provider calls (`scripts/online-depth-probe.mjs`
→ `docs/eval/ONLINE_DEPTH_PROBE.json`). Secrets read from `.env`, never printed.

## Root cause (as briefed) — confirmed and fixed
Tavily returns a one-line `answer` AND a `results` array with real per-source
`content`. The old adapter mapped results to `{url,title}` only and capped
`max_results:6` — the per-source **content (the depth) was discarded**, and the
endpoint surfaced just the one-line answer. So "what is new" yielded a sentence.
**Fix:** `ProviderSource` now carries `content`; the Tavily adapter keeps each
result's `content` and raises `max_results` to 10; Brave carries its `description`
as `content` too. `briefing.ts` fans out and holds those snippets for follow-ups.

## Provider health — REAL keyed calls (the brief asked: which are live?)
| provider | key present | healthy | note |
|---|---|---|---|
| **Tavily** | yes | **NO** | **HTTP 401 — the key is dead/expired. Needs rotation.** |
| **Brave** | yes | **yes** | returned results |
| **Perplexity** | yes | **yes** | `sonar` responded |
| OpenAI | yes | (incumbent) | key present |

**Action for Leo:** rotate `TAVILY_API_KEY` (the bake-off winner is currently
unusable), OR set `ONLINE_PROVIDER=brave` — Brave is live and the briefing is
provider-agnostic, so it works today on Brave.

## Before → after — real distinct-headline counts (via Brave, the live provider)
| | headlines | with snippet (depth) | hosts | categories |
|---|---|---|---|---|
| **BEFORE** (one query, one-line answer) | 6 sources, 1 synthesized line | 0 held | — | 1 |
| **AFTER** (6-category fan-out, deduped) | **12 distinct** | **12/12** | **9** | **6/6** |

Real sources surfaced: N12, Haaretz, ynet, Israel Hayom, C14, Hidabroot,
MedicalNewsToday, Wikipedia. Sports and economics were excluded by construction +
a filter. `categoriesFailed: []` (all six categories returned results).

## Depth on demand
`detailFor(briefing, n)` answers a follow-up ("tell me more about #3") from the
**held snippet** — no new query — and is HONEST when it holds none (`no_detail_held`)
rather than fabricating. Abu offers `רוצה שאפרט על אחד מהם?`. The endpoint returns
the full `briefing` object (headlines + snippets) so the client holds the session
material. (Cross-turn caching of that object in the live session is the client
integration; the retrieval + hold contract is proven here.)

## Cinema — the honest verdict
A real probe for "לוח הקרנות קולנוע כפר סבא היום סרטים ותקצירים" returned 10 results
with showtime-like content, from the RIGHT sources: **cinema-city.co.il** (Cinema
City has a Kfar Saba branch), **seret.co.il** (Israeli showtimes aggregator),
edb.co.il, easy.co.il.
**Verdict — partially achievable, honestly bounded:** general web search finds the
correct sites but returns their landing/section pages, NOT reliably-parsed
per-cinema showtimes + plot summaries. Reliable structured listings would need a
**dedicated adapter** against `cinema-city.co.il` (Kfar Saba) or `seret.co.il`.
Until that exists, Abu should point her to Cinema City Kfar Saba / seret.co.il and
must NOT recite specific showtimes as fact (that would violate "no verified result,
no claim"). An honest "I can point you to the cinema, but I cannot promise exact
times without checking there" is the correct behavior — three vague results are not.

## Invariant preserved
No verified result, no claim. Zero headlines ⇒ the endpoint declines
(`ONLINE_NO_RESULTS`) exactly like the single-answer path. A headline exists only
if a real titled source backs it (mutant `briefing-headline-without-a-source`
proves the test kills a titleless "headline").
