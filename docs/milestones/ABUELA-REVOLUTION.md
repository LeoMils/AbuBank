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
- [ ] Provider abstraction behind the existing endpoint shape (key server-side, honesty gate kept)
- [ ] 30-question Hebrew corpus (+ Spanish variants): news/sports/weather/cinema/prices/hours
- [ ] Scoring harness: citation rate · correctness (where verifiable) · Hebrew quality · latency · cost
- [ ] Adapters: OpenAI web_search (incumbent), Tavily, Brave, Perplexity Sonar (+ any better)
- [ ] Run incumbent FOR REAL; run others when keyed; report BLOCKED-per-provider honestly
- [ ] Full matrix + decision (possibly a composition) justified by numbers
- [ ] Report which API keys Leo must obtain and where they go

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
- (append decisions as they are made — safest option chosen + why)

## Status / evidence per milestone
- M1 … not started
- M2 … not started
- M3 … not started
- M4 … not started
- M5 … not started
- M6 … not started

## Keys Leo must obtain (running list)
- (filled by M1)

## Resume pointer
- **Next action:** M1 — build the bake-off framework + corpus + adapters, run the incumbent for real.
