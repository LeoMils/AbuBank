# IMPACT_SCOREBOARD

The user-facing impact of every cycle. BENCHMARK_SCORE = % of real user-moments
that behave correctly (`npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`).
A cycle is only "done" when this table has a new row.

| Version | BENCHMARK_SCORE | Δ | Moments | Change shipped | Evidence |
|---|---|---|---|---|---|
| 0.8.3 (baseline) | 100.0% | — | 38/38 | benchmark established (calendar 15, online 6, conv-os 4, companion 7, failure-copy 4, routing 2) | benchmark run |
| 0.8.5 | 100.0% | +12 moments | 50/50 | **Spanish calendar create** — was 0% (isCreateIntent=false on "agendá una reunión con Gabi mañana a las tres"); now full es create (intent/who/date/time/AM-PM/confirm). Added 12 `spanish` benchmark moments. | benchmark run + suite 5982 |
| 0.8.6 | 100.0% | +4 moments | 54/54 | **Spanish location** — was 0% ("en el café Morocco" → cancel/null); now extracted inline + merged into a pending event ("en casa"/"en la clínica"). | benchmark run + suite 5982 |
| 0.8.7 | NORTH_STAR 99.5→**100%** | 588 eval cases | — | **Eval Engine** built (10 capabilities × 8 dimensions, real pipeline, deterministic + judge-marked-uncertain, 4 reports, regression detection). It FOUND a real bug: "sí, agendalo" not confirmed → fixed (es confirm). | eval run docs/eval/ + suite 5984 |
| 0.8.8 | NORTH_STAR **100%** · JUDGE **100/100** | 1095 cases + 69 judged | — | **Judge pass + coverage**. Built a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on deterministic prose. It FOUND + fixed: Spanish emotional fallback replied in Hebrew (→ es companion lines); online gaps "מי שיחק"/"מתי שוקעת השמש". Coverage expanded to all minimums (family 165/emotional 147/continuity 111/hebrew 180/online 87…). | docs/eval/ + judge-results.json + suite 5984 |

## Cycle log
- **0.8.5 (ROI cycle 1)** — NORTH_STAR → benchmark 100% (38) → probed least-covered
  surface (Spanish, her 2nd language) → found Spanish calendar create 0% → implemented
  es intent + person ("con X") + dates (hoy/mañana/pasado mañana/el viernes/la semana
  que viene) + times (a las tres / y media / de la tarde·noche·mañana) → re-benchmark
  100% (50, spanish 12/12). Regression caught + fixed: noun "Agenda de mañana" (a READ)
  must not match the verb "agendá" (now requires a schedulable object).
  NEXT: Spanish reminder ("recordame…") and Spanish location merge ("en el café").

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
