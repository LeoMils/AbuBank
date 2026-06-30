# AbuAI EVAL_REPORT

Cases: **588** · scored dimensions: 1314 · uncertain (judge-required): 27 · avg latency: 0 ms

**NORTH_STAR_SCORE = 100%** (deterministic dimensions passing). Uncertain
(LLM-prose) dimensions are scored separately by the offline judge — see judgePrompt.md.

## By capability
| Capability | Result |
|---|---|
| memory | 18/18 pass |
| family | 6/9 pass · 3 uncertain |
| calendar | 996/996 pass |
| hebrew | 12/12 pass |
| spanish | 162/162 pass |
| emotional | 42/63 pass · 21 uncertain |
| voice | 36/36 pass |
| error-recovery | 24/24 pass |
| online | 15/15 pass |
| continuity | 3/6 pass · 3 uncertain |

## By dimension
| Dimension | Result |
|---|---|
| factual | 21/21 pass |
| memory | 12/12 pass |
| calendar | 498/498 pass |
| language | 342/342 pass |
| emotional | 21/21 pass |
| actionability | 42/42 pass |
| naturalness | 24/51 pass · 27 uncertain |
| safety | 354/354 pass |

## Honesty
Deterministic dimensions (calendar/routing/language/safety/actionability/memory) are
asserted against the REAL pipeline — HIGH evidence. emotional-depth & naturalness of
LLM-generated prose are marked `uncertain` (not passed) and need the separate judge.
