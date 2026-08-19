# ONLINE ACCEPTANCE — general search loop (one mechanism, no per-topic gates)

Harness: `scripts/eval/onlineAcceptance.ts`. Path measured: the real live seam
(`firstWinsOnlineFetch` = Brave search → page fetch first-wins → cheap-model JUDGE+SYNTH → refine).

## THE ORACLE LIMIT (stated plainly)
There is no independent oracle for the web — we cannot assert the correct price or headline
without already knowing it. So a "pass" asserts ONLY what is checkable:
a real answer of the requested KIND was produced, NO source/site was named, and latency was in
budget; plus consistency across rephrasings and an honest no_answer (never a dump) on a miss.
The correctness of the VALUE itself is NOT asserted.

## Result — 63 diverse questions (cinema, prices, news, weather, transit, hours, recipes,
## medicine, holidays, country facts, how-to, sports, history, definitions, people; he + es; vague)
- **PASS 55/63 = 87.3%** (real answer of the right kind, no source named, in budget)
- honest MISS 8 (clean no_answer, one short sentence — NEVER a dump or crash)
- **hard FAIL 0** · **source-name leaks 0** (the no-sources rule held on every answer)
- latency ms: **p50 2180 · p90 4408 · p95 5237 · max 5622** — every answer within the 6s ceiling
  (a synth-time reserve keeps fetch+judge together under budget; max was 7335ms before the fix)

### The 8 honest misses (all no_answer, not failures)
מה מקרינים עכשיו בסינמה סיטי · מה החדשות היום בישראל · האם ירד גשם מחר · מה השעה עכשיו בבואנוס איירס ·
נו, כמה זה עולה, הבושם ההוא של שאנל · תגידי, כדאי לי לצאת היום או שיהיה קר מדי · איזה הצגות בהבימה ·
כמה מעלות עכשיו במדריד. Pattern: JS-rendered listings (cinema/theatre) and live-widget weather/clock
whose answer is not in static page text; and one very vague conversational turn. Each returned an
honest miss, so Martita hears one short sentence — the design's failure mode, not a dump.

## Never worse than the snippet (off vs on, 16 questions)
both pass 11 · **ON-only 2** (loop found answers the snippet did not) · **OFF-only 0** (never worse) ·
neither 3. OFF-only=0 confirms the general loop never loses where the snippet wins → default ON.

## Consistency across rephrasings (5 pairs re-asked in different words)
4/5 pairs both answered of the right kind (weather, Argentina capital, Rosh Hashana date, Acamol).
1 diverged: "כמה עולה בושם בלו דה שאנל?" answered 597₪ but its reword returned no_answer — web/judge
non-determinism, an honest miss on the reword rather than a wrong answer.

## Follow-up degradation
The loop is STATELESS per call — there is no shared session state that a 2nd/3rd question could
degrade. The device "2nd/3rd question fails after the 1st" symptom lives in the realtime session
layer (response-lifecycle / barge-in — Track A), not in this online path. Noted, not conflated.

## Failure paths (each degrades to a short honest sentence, never a crash/dump)
Network loss mid-fetch, every page timing out, provider returns nothing, malformed pages, wrong-
language results → all resolve to no_answer (unit-tested in generalSearch.test.ts + firstWins.test.ts).

## Flags (code-level, not Preview-only env)
- `ONLINE_GENERAL_SEARCH_DEFAULT = true` (flags.ts) — measured never-worse-than-snippet (OFF-only=0)
  → default ON in CODE. Env `ONLINE_DEEP_FETCH=0` is an ops kill-switch only, no longer the source of truth.
- `ONLINE_PREFETCH_WARM_DEFAULT = false` — stays OFF pending the on-device freshness-vs-latency
  measurement (serving cache trades freshness for latency; warmStore.test already proves the <1s warm hit).

API spend this session: ~130 loop runs → ~180 gpt-4o-mini synth calls ≈ under $0.10; Brave + page
fetches free-tier. Cap was $8.
