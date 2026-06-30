# AbuAI EVAL_REPORT

Deterministic cases: **1095** · scored dims: 2013 · uncertain: 33 · avg latency: 0 ms
Judge candidates (separate rule judge, NOT AbuAI): **69** · avg score: **100** · pass(≥95): 69 · fail: 0 · uncertain: 0

**NORTH_STAR (deterministic) = 100%** · **JUDGE = 100/100**

## By capability
| Capability | Deterministic | Judged prose (avg, pass/n) |
|---|---|---|
| memory | 18/18 pass | 100 (9/9) |
| family | 162/165 pass · 3 uncertain | — |
| calendar | 996/996 pass | — |
| hebrew | 180/180 pass | — |
| spanish | 162/162 pass | — |
| emotional | 120/147 pass · 27 uncertain | 100 (36/36) |
| voice | 84/84 pass | 100 (9/9) |
| error-recovery | 96/96 pass | 100 (12/12) |
| online | 87/87 pass | — |
| continuity | 108/111 pass · 3 uncertain | 100 (3/3) |

## By dimension (deterministic)
| Dimension | Result |
|---|---|
| factual | 249/249 pass |
| memory | 117/117 pass |
| calendar | 498/498 pass |
| language | 450/450 pass |
| emotional | 57/63 pass · 6 uncertain |
| actionability | 66/66 pass |
| naturalness | 132/159 pass · 27 uncertain |
| safety | 444/444 pass |

## Coverage (deterministic cases per capability)
- memory: 18
- family: 165
- calendar: 996
- hebrew: 180
- spanish: 162
- emotional: 147
- voice: 84
- error-recovery: 96
- online: 87
- continuity: 111

## Honesty
Deterministic dims are asserted against the REAL pipeline (HIGH evidence). Prose
dims are scored by a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on the
DETERMINISTIC responses the pipeline produces (companion fallback / continuation /
repair / voice-shaped / failure copy). **LLM-generated answer prose (the natural
family/emotional answer) has no in-code candidate and is reported NON-CODE — it
needs a live model + the offline judge in judgePrompt.md.**
