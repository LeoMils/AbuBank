# AbuAI — General Knowledge / Online Routing Gauntlet

Proves AbuAI routes each question to the RIGHT source and does not hallucinate
current facts without an online route. [EVAL] `src/eval/evalEngine.ts` categories.

## Routing contract (verified deterministically)
| Question type | Correct route | Eval category | Result |
|---|---|---|---|
| Current info (weather/sports/news/scores/sunset) | ONLINE | online (145) | 100% — `isOnlineCurrentInfoQuery`=true |
| Stable world knowledge (capitals/math/facts) | GENERAL AI (NOT online) | general-knowledge (150) | 100% — `isOnlineCurrentInfoQuery`=false, domain=general |
| Family / relationships | INTERNAL (family graph) | family (275) | 100% — domain=family |
| Calendar / scheduling | INTERNAL (calendar) | calendar (1660) | 100% |
| Memory / "תמשיכי" / "למה" | INTERNAL (conversation OS) | memory (280) | 100% |
| Mixed he/es | routes without dead-end | mixed (100) | 100% |

## Anti-hallucination proof
- Stable-world questions ("מה בירת צרפת", "כמה זה שתיים ועוד שתיים") return
  `isOnlineCurrentInfoQuery=false` → answered from general knowledge, NOT routed to a
  live fetch (no fabricated "current" claim).
- Current-info questions ("מה מזג האוויר", "מי ניצח") return `true` → routed online;
  the sports name-collision (ירדן=Jordan vs Yarden family) is handled — routes online.
- On online FAILURE, the pipeline states the real recorded reason + offers retry
  (memory/why category 100%), never a fabricated result.

## Verdict
PASS — routing is correct across current-info / stable-knowledge / family / calendar /
memory / mixed, all 100% deterministic. **Honest limit:** the *content* of a live
online or general-AI answer is produced by the model at runtime and is not verified
here (NON-CODE / live).
