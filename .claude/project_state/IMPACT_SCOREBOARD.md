# IMPACT_SCOREBOARD

The user-facing impact of every cycle. BENCHMARK_SCORE = % of real user-moments
that behave correctly (`npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`).
A cycle is only "done" when this table has a new row.

| Version | BENCHMARK_SCORE | Δ | Moments | Change shipped | Evidence |
|---|---|---|---|---|---|
| 0.8.3 (baseline) | 100.0% | — | 38/38 | benchmark established (calendar 15, online 6, conv-os 4, companion 7, failure-copy 4, routing 2) | benchmark run |

## How to use
1. Before a change: run the benchmark, note the score + failing moments.
2. Pick the change that fixes the most user-impactful failing moment (or removes a
   P0 / unblocks Production) for the least risk.
3. After the change: re-run the benchmark + `npm run check`. Add a row here with
   the before→after delta and what moved.
4. If the score went UP, raise the FLOOR constant in `benchmarkConversations.test.ts`
   so it can never regress.

## Notes
- Score is at the 100% ceiling because prior war-room cycles already fixed these
  moments. To keep raising ROI, ADD new failing moments to `SCENARIOS` that
  represent real gaps (then fix them) — the benchmark grows with the product.
- Adding a scenario that currently FAILS is the honest way to expose the next
  highest-ROI work: it drops the score, names the moment, and the fix raises it back.
