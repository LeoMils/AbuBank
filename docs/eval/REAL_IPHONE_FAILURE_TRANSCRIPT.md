# Real iPhone Failure Transcript — AbuAI (Leo's device test)

The exact failure clusters from Leo's iPhone AbuAI session, encoded as the master
regression `src/eval/realIphoneTranscriptGauntlet.ts` (+ `.test.ts`). Each cluster
runs the REAL pipeline functions and must stay at 100%.

## Failure clusters (as observed)
1. **Online answer + continuation.** France vs Sweden asked; AbuAI answered; user said
   "continue" → AbuAI replied "I cannot check now" / broke into fragments (`com]( cbsnews.`)
   and LOST the topic.
2. **Topic memory.** "why no memory?" → AbuAI could not recover the France/Sweden topic.
3. **Calendar read hallucination.** With an empty calendar, AbuAI invented doctor
   appointments instead of saying it was empty.
4. **Calendar create.** "תקבעי לי פגישה עם אורית היום בשמונה בערב אצלי בבית" — location
   ("אצלי בבית") was DROPPED; on "כן כן" / "כן אני רוצה מאוד בבקשה תקבעי את זה" AbuAI
   sometimes cancelled instead of SAVING.
5. **Audio complaint mid-create.** "למה את לא מדברת אני לא שומע אותך" → treated as a
   calendar answer (clarify/cancel) instead of an audio-help reply.
6. **Family-graph reasoning.** "מי הדוד של ארי" etc. → wrong/guessed single answers
   (Hebrew relation-chain queries fell through to the LLM and hallucinated).
7. **General knowledge.** date questions answered with huge unrelated text.
8. **Robotic fallback.** cold "בסדר, ביטלתי" / "מה היה הנושא?" even when context existed.

## Gauntlet clusters (deterministic, code-testable) — 18 checks, 100%
| id | cluster | assertion |
|---|---|---|
| C4a | calendar create | who=אורית · date=today · time=20:00 · location includes בבית |
| C4-save ×4 | confirm variants | "כן כן", "כן אני רוצה מאוד…תקבעי את זה", "תעשי את זה", "קדימה תקבעי" → SAVE |
| C5 ×3 | audio complaint | "…אני לא שומע אותך", "אני לא שומע אותך", "הקול נעלם" → audio_help (never cancel) |
| C5b ×2 | emotional mid-create | "אני מתגעגעת לפאפי", "estoy sola" → park (warm), never cancel |
| C3 | calendar read grounding | empty store → 0 appointments (read cannot invent) |
| C6a | family | grandmother of Ari includes Martita |
| C6b | family | uncles of Ari list all (עילי + others), no single guess |
| C6c | family | Mor children include Ofir (≥3) |
| C6d | family | Mor partner = Yael (single) |
| C6e | family | unknown relation → not-known (no guess) |
| C1 | online continuation | "continue" retains France/Sweden topic, no "cannot check", no `com]( cbsnews` |
| C8 | no robotic fallback | "continue" with context is handled, not "מה היה הנושא?" |

Live LLM prose (clusters 2, 7 wording) is judged separately by the production simulator;
this gauntlet locks the deterministic behaviour that the LLM builds on.
