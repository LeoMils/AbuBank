# AbuAI Cognitive Responsibility Map

**Build:** `0.17.0-behavioral-production-green`. "GREEN" = wired into the live `runFullTurn` path AND tested. Layers only tested but not live are marked.

| Layer | File | Responsibility | Must NOT | In/Out | Live integration point | Tests | Status |
|---|---|---|---|---|---|---|---|
| Meta Reasoner | `metaReasoner.ts` | what was actually asked (domain/subject/target/entities/missing) | answer; guess | text→MetaResult | `runFullTurn` (first, traced `meta`) | metaReasoner.test + gauntlet | **GREEN (live)** |
| Goal Manager | `goalManager.ts` | pending action / confirmation / frustration state | cancel on audio/frustration | text+state→GoalState | signals used by runtime confirm/audio paths | gauntlet | **GREEN (tested; runtime mirrors via RuntimeState)** |
| Dialogue Manager | `dialogueManager.ts` | break repeat/apology loops | invent | candidate+history→decision | `runtimeFinalizer` (guardDialogue) | gauntlet | **GREEN (live)** |
| Calendar Intelligence | `calendarIntelligence.ts` | semantic event build (who/when/where/duration/פרטים חשובים) | invent; call it "notes" | text→SmartMeeting | runtime `calendar_create` | smart test + gauntlet | **GREEN (live)** |
| Family Relation Engine | `familyRelationEngine.ts` | directional graph kinship | guess; identity-to-Martita | pair→relation | runtime `family` reasoner | engine test + gauntlet | **GREEN (live)** |
| Knowledge Router | `knowledgeRouter.ts` | online/system-clock/general routing | online for personal | text→route | classifyIntent kept in sync | gauntlet | **GREEN (live via classify + planner)** |
| Online Planner | `onlinePlanner.ts` | plan lookup + honest failure/retry | pretend to check | text→plan | composes router; runtime online branch | naturalizer test + gauntlet | **GREEN (tested; runtime mirrors)** |
| Confidence Guard | `confidenceGuard.ts` | block low-confidence-as-fact | assert unknown | meta→verdict | `runFullTurn` (family block) | gauntlet | **GREEN (live)** |
| Contradiction Guard | `contradictionGuard.ts` | block calendar contradiction/invention | ignore store | answer+count→verdict | `runFullTurn` (calendar_read) | gauntlet + master | **GREEN (live)** |
| Cognitive Supervisor | `cognitiveSupervisor.ts` | final approve/repair | pass unsafe | answer→verdict | `runtimeFinalizer` | supervisor test + gauntlet | **GREEN (live)** |
| Hebrew Naturalizer | `hebrewNaturalizer.ts` | repair fixable Hebrew slips | invent content | text→text | `runtimeFinalizer` (before supervise) | naturalizer test + gauntlet | **GREEN (live)** |
| Conversation Delivery | `conversationDeliveryEngine.ts` | speech chunks + resume + events | markdown/URL in speech | text→delivery | `runtimeFinalizer` | delivery test + gauntlet | **GREEN (live)** |
| Runtime Finalizer | `runtimeFinalizer.ts` | naturalize→dialogue→supervise→deliver→stamp | emit unstamped | answer→FinalizeResult | every `runFullTurn` | via all replays | **GREEN (live)** |
| No-Bypass Guard | `noBypassRuntimeGuard.ts` | require RUNTIME_FINALIZED stamp | allow legacy | result→bool | test invariant | noBypass test | **GREEN (test invariant)** |

**Duplication check:** `knowledgeRouter` (routing) vs `onlinePlanner` (planning) — planner delegates to router (no duplication). `goalManager`/`metaReasoner` state overlaps `RuntimeState`; the runtime uses `RuntimeState` at runtime and `goalManager` exposes the same rules as a tested API — flagged as mirrored, not duplicated.

**Honest gap:** `goalManager` and `onlinePlanner` are proven APIs whose *rules* the live runtime enforces through `RuntimeState`/`classifyIntent`+online branch, but the modules themselves are not the literal call site in `runFullTurn`. All other layers are the literal live call site.
