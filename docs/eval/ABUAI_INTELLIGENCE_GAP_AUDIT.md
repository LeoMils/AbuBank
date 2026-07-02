# AbuAI Intelligence Gap Audit

**Build:** `0.16.0-intelligence-high-green` · **Date:** 2026-07-02

| # | Layer | Was | Missing behavior | Real failure example | Files | Fix | Tests | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Meta Reasoner | none (intent only) | structured "what was actually asked" (subject/target/entities/missing) | "מה ליאו עבור אופיר" answered as identity | `metaReasoner.ts` | compose classify + relation parser + smart calendar | `metaReasoner.test.ts` (10) + gauntlet (425) | **GREEN** |
| 2 | Goal Manager | implicit in RuntimeState | explicit pending/confirmation/frustration tracking | repeated "כן" could loop | `goalManager.ts` | resolvesPending + advanceGoal (audio/frustration never reset) | gauntlet (80) | **GREEN** |
| 3 | Dialogue Manager | none | loop/apology prevention + escalation | repeated "לא הבנתי" | `dialogueManager.ts` | guardDialogue + escalate | gauntlet (60) | **GREEN** |
| 4 | Family Relation Engine | directional but gaps | reverse ex-in-law (Leo↔Rafi), Ari/Anabel | "לאו עבור רפי" → unknown | `familyRelationEngine.ts` | ex-sibling-in-law via ex-spouse of B | `familyRelationEngine.test.ts` (13) + gauntlet (44) | **GREEN** |
| 5 | Calendar Intelligence | who/when/where | duration + פרטים חשובים + narrative | Ofir rambling request | `calendarIntelligence.ts` | extractDuration/importantDetails/evening | `calendarIntelligenceSmart.test.ts` (15) + gauntlet (384) | **GREEN** |
| 6 | Confidence / Contradiction | none | block invented/contradicting calendar | "אין כלום" then "שתי פגישות" | `confidenceGuard.ts`, `contradictionGuard.ts` | grounded count check + confidence floor | gauntlet (384) | **GREEN** |
| 7 | Online Planner / Knowledge Router | inline in classify | movies/bus/world-cup routing + system-clock | "מה הסרטים בכפר סבא" → general | `knowledgeRouter.ts` | routeKnowledge + planOnline (Hebrew-safe, no \b) | gauntlet (240) | **GREEN** |
| 8 | Speech / Delivery | basic | chunk index + resume + TTS events + md-strip | markdown into speech | `conversationDeliveryEngine.ts` | thorough strip + resume + events | `conversationDeliveryEngine.test.ts` (9) + gauntlet (40) | **GREEN** |

All 8 layers are code-testable and measured. The intelligence gauntlet (`intelligenceHighGreenGauntlet`) reports the true per-layer rate — see `ABUAI_INTELLIGENCE_HIGH_GREEN_REPORT.md`.

**Not code (Leo-gated):** physical iPhone microphone/speaker/TTS voice FEEL.
