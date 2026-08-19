# Understanding-Shadow KPIs (obligations #2, #6, #7, #8)

Per-turn OLD (legacy pattern intake) vs NEW (understanding: interpret→ground→decide),
over an internal Hebrew corpus. **CODE evidence for the shadow pipeline + the
migration-safety gate.** The interpreter here is a deterministic MOCK encoding the
target behavior; the real-provider agreement/recovery/latency over LIVE traffic is
**PREVIEW-class and PENDING** (collected by `intakeShadowCollector` in the deployed app).

Corpus size: **12** turns.

## Understanding KPIs (rates, not test counts)

| KPI | Value |
|---|---|
| Agreement | 41.7% |
| Semantic recovery | 25.0% |
| Disagreement (people) — MUST be 0 | 0.0% |
| Regression — MUST be 0 | 0.0% |
| Clarification (ambiguity) | 16.7% |
| Clarify-while-legacy-acted (REVIEW — often the safer path) | 16.7% |
| Unresolved-intent | 16.7% |

## Latency (ms · p50 / p95 / worst)

| Stage | p50 / p95 / worst |
|---|---|
| interpret (MOCK — real=PREVIEW) | 0 / 0 / 0 |
| ground (deterministic) | 0 / 0 / 0 |
| decide (deterministic) | 0 / 0 / 0 |
| total | 0 / 0 / 0 |

## Buckets

- agree: 5
- recovered: 3
- regressed: 0
- disagree: 0
- clarify: 0
- false_clarify: 2
- unresolved: 2

## Findings surfaced by the shadow

- **Clarify-while-legacy-acted (2):** on under-specified turns
  (e.g. "תקבעי לזה משהו", "תזכירי לו על זה מחר") the LEGACY path starts an action while the
  understanding path asks ONE question. This is the understanding path being SAFER — a
  candidate to migrate once confirmed on live traffic, not a regression.
- **Regression / people-disagreement: 0 / 0** — the
  migration-safety gate holds (both must be 0).

**Leo's free-language device round decides readiness — nothing else does.**
