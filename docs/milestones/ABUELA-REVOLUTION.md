# THE ABU-ELA REVOLUTION — durable spec + running log

**This file is the resume point.** If context is cleared, read this top-to-bottom
and continue from the first unchecked box. One commit per milestone, pushed to the
RC branch. Never merge main. Never deploy production.

## Operating protocol
1. This spec is committed first and updated as work proceeds.
2. Never stop to ask which part is next. Ambiguous → safest option, log it, continue.
3. One commit per milestone, pushed.
4. Evidence discipline: `CODE < TEST < PREVIEW < DEVICE`. Never claim green on
   weaker evidence than the claim needs.
5. Use specialist agents where they genuinely help; record which and what they gave.
6. Every milestone ends green: typecheck · full suite · build · validators · gate.

## Evidence legend
`CODE` wiring exists · `TEST` automated assertion ran · `PREVIEW` real provider/
deploy · `DEVICE` proven on Leo's iPhone · `HUMAN` needs a human eye.

---

## Checklist

### M1 — Online provider bake-off  (do first; everything online depends on it)
- [x] Provider abstraction (`src/services/online/`: providerTypes, adapters, registry) — key server-side
- [x] 36-question Hebrew(+Spanish) corpus (`corpus.ts`): news/sports/weather/cinema/prices/hours/live
- [x] Scoring harness (`scripts/online-bakeoff.ts`): citation rate · answer rate · latency (avg/p95) · by-category
- [x] Adapters: OpenAI (incumbent, VERIFIED), Tavily, Brave, Perplexity Sonar (CODE — key-gated, unit-tested via mocks)
- [x] Ran incumbent FOR REAL; others recorded BLOCKED (no key) — never faked
- [x] Matrix written (`docs/eval/ONLINE_BAKEOFF.json`) — see decision D2
- [x] Key request reported (below) — Leo must obtain 3 keys to finish the tournament
- [ ] BLOCKED-on-keys: run Tavily/Brave/Perplexity, choose winner (likely a composition), wire behind the endpoint

### M2 — Full online, inside the conversation
- [ ] Abu answers current things invisibly; states source in speech, never a URL
- [ ] Follow-ups from the SAME retrieved results; personal/family/calendar never hit the web
- [ ] Failed retrieval = warm honest "couldn't check"; never stale-as-fresh
- [ ] Abu News: real stories, Israel-first, dynamic count, source+time, plain Hebrew; read aloud + discuss
- [ ] Harness scenarios for each, run for real against the chosen provider

### M3 — One people store, real Hebrew kinship
- [ ] Collapse family_data.json + family_graph.json + abu-family.md + contacts → ONE canonical store
- [ ] Store DIRECT facts + direct edges only; derive kinship at query time (correct Hebrew + gender)
- [ ] Named failures work: Leo=uncle of Mor's children · Gilad=brother-in-law of Ili · Yarden=daughter-in-law of Rafi
- [ ] ONE `people_lookup` tool; retire `resolve_contact` into it; numbers resolve at UI, never in model
- [ ] Family data leaves session instructions — report char count before/after
- [ ] Invariant tests (unknown-stays-unknown, alias→one person, spellings verbatim, death keeps genealogy,
      former_spouse/partner/cohabits distinct, temporal facts dated, gender only where known, add-by-data-only)
- [ ] Gate validator reporting errors in plain Hebrew; broken file never builds
- [ ] Harness: 20 kinship queries incl. every derived type + "תתקשרי לנכד שלי" → person → contact in one turn

### M4 — Brand + design revolution
- [ ] Logo family: real graphic "Abu" mark, per-app identity (AI/News/Bank/WhatsApp/Weather/Games/Calendar) as SVG components
- [ ] Design system extended: tokens + components + docs, applied to EVERY screen (hub + 7 apps)
- [ ] 2–3 genuinely different hub directions built + described; report before rolling the chosen one wider

### M5 — Abu's presence (Abu AI screen)
- [ ] Warm illustrated character (NOT photorealistic, NOT video), 2–3 directions proposed then built
- [ ] Mouth driven by real output-audio amplitude (AnalyserNode on the realtime stream)
- [ ] States: listening/thinking/speaking/waiting; idle life (breathing/blinking); graceful degrade
- [ ] Screen around her (action cards, transcript, trace button) in the new system, readable at 80
- [ ] Measure + report frame cost

### M6 — Device test script
- [ ] docs/DEVICE-TEST.md for the shipped build: numbered say-this / expect-that / trace-signature, riskiest first, non-programmer

---

## Decisions log
- **D0 (protocol):** Wrote this spec as the first commit; it is the resume point.
- **D1 (M1, safest):** Built the bake-off as a self-contained framework; did NOT refactor
  the shipped endpoint internals this milestone (would risk 30+ passing online tests for a
  swap that cannot be validated without a keyed winner). `registry.selectProvider(env)` is
  ready; the endpoint swaps via `ONLINE_PROVIDER` once a winner is chosen + proven.
- **D2 (M1, from real numbers):** Incumbent OpenAI web_search is INADEQUATE alone for a voice
  product — citation 58%, and worst exactly where it matters: sports 33% / weather 33% /
  cinema 33% (best: hours 100%, prices 75%), avg 4.5s / p95 8.2s (too slow for voice).
  Cannot pick a winner without the other providers' keys. Recommended target = a COMPOSITION
  (fast search API for grounding + a dedicated weather API + a sports source), to be decided
  from real numbers once keyed. Tournament framework is ready to run them.
- **Agents:** M1 is an empirical/measurement + architecture task — done directly, no subagent
  (a design/review agent adds nothing to a latency/citation measurement). Agents are planned
  for M4 (design directions) and M5 (character) where they genuinely help.

## Status / evidence per milestone
- **M1 … DONE (framework + incumbent baseline). Evidence: TEST (framework, 13 tests) +
  PREVIEW (real incumbent run, 36 queries: 58% citation / 4.5s avg). Winner selection
  BLOCKED on Leo's keys.**
- M2 … not started (depends on M1 winner; can proceed on the incumbent meanwhile)
- M3 … not started
- M4 … not started
- M5 … not started
- M6 … not started

## Keys Leo must obtain (running list)
To finish the M1 tournament and unlock a better online experience, obtain and place these
in `.env.local` (server-side; never the client bundle), then re-run `npx tsx scripts/online-bakeoff.ts`:
- **`TAVILY_API_KEY`** — Tavily Search API (search + synthesized answer + sources). tavily.com
- **`BRAVE_API_KEY`** — Brave Search API (note: perpetual free tier retired Feb 2026 — check current plan). brave.com/search/api
- **`PERPLEXITY_API_KEY`** — Perplexity Sonar (answer + citations). docs.perplexity.ai
(Weather may be better served by a dedicated API, e.g. the Israel Meteorological Service or
OpenWeather — flagged after the search tournament runs.)

## Resume pointer
- **Next action:** M2 — full online inside the conversation (proceed on the incumbent + honesty
  gate; add Abu-News harness scenarios run for real; swap provider when M1 winner is keyed).
