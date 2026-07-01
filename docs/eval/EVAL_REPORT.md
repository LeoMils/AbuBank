# AbuAI EVAL_REPORT

Deterministic cases: **2530** · scored dims: 4060 · uncertain: 55 · avg latency: 0 ms
Judge candidates (separate rule judge, NOT AbuAI): **115** · avg score: **100** · pass(≥95): 115 · fail: 0 · uncertain: 0

**NORTH_STAR (deterministic) = 100%** · **JUDGE = 100/100**

## By capability
| Capability | Deterministic | Judged prose (avg, pass/n) |
|---|---|---|
| memory | 280/280 pass | 100 (15/15) |
| family | 270/275 pass · 5 uncertain | — |
| calendar | 1660/1660 pass | — |
| hebrew | 300/300 pass | — |
| spanish | 270/270 pass | — |
| emotional | 200/245 pass · 45 uncertain | 100 (60/60) |
| voice | 140/140 pass | 100 (15/15) |
| error-recovery | 160/160 pass | 100 (20/20) |
| online | 145/145 pass | — |
| continuity | 180/185 pass · 5 uncertain | 100 (5/5) |
| mixed | 100/100 pass | — |
| reminders | 100/100 pass | — |
| general-knowledge | 150/150 pass | — |
| safety-privacy | 100/100 pass | — |
| mobile | 5/5 pass | — |

## By dimension (deterministic)
| Dimension | Result |
|---|---|
| factual | 565/565 pass |
| memory | 445/445 pass |
| calendar | 930/930 pass |
| language | 850/850 pass |
| emotional | 95/105 pass · 10 uncertain |
| actionability | 115/115 pass |
| naturalness | 220/265 pass · 45 uncertain |
| safety | 840/840 pass |

## Coverage (deterministic cases per capability)
- memory: 280
- family: 275
- calendar: 1660
- hebrew: 300
- spanish: 270
- emotional: 245
- voice: 140
- error-recovery: 160
- online: 145
- continuity: 185
- mixed: 100
- reminders: 100
- general-knowledge: 150
- safety-privacy: 100
- mobile: 5

## Honesty
Deterministic dims are asserted against the REAL pipeline (HIGH evidence). Prose
dims are scored by a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on the
DETERMINISTIC responses the pipeline produces (companion fallback / continuation /
repair / voice-shaped / failure copy). **LLM-generated answer prose (the natural
family/emotional answer) has no in-code candidate and is reported NON-CODE — it
needs a live model + the offline judge in judgePrompt.md.**
