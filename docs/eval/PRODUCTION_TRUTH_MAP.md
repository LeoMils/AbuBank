# Production Truth Map (measured — EXECUTED vs NOT EXECUTED)

Rule: a module counts only if the PRODUCTION runtime executes it. "Tests pass" ≠ executed.
Production entry: ExecutiveCognitiveController.handleTurn → runFullTurn → runCognitiveTurn
→ finalize → assertNoBypass (RUNTIME_FINALIZED stamp). Classification is by measured
non-test importer reachability from that entry.

## EXECUTED IN PRODUCTION (reachable from the entry)
| Module | Imported by (production) | Stage |
|---|---|---|
| semanticIntelligenceEngine | cognitiveRuntime | semantic recovery |
| conversationEngineV2 | cognitiveRuntime | intent/pending/continuation |
| calendarEventBuilderV2 | cognitiveRuntime, AbuCalendar/service | calendar builder |
| hebrewNaturalConversationV2 | runtimeFinalizer | hebrew finalizer |
| cognitiveRuntime.classifyIntent | (in-path) | intent decision |
| runtimeFullTurn.callOnlineWithRetry | (in-path) | online |
| familyRelationEngine / familyPathReasoner | (in-path) | family |
| conversationDeliveryEngine.planDelivery | runtimeFinalizer | speech delivery |
| runtimeFinalizer + noBypassRuntimeGuard | (in-path) | finalizer / no-bypass |

## NOT EXECUTED IN PRODUCTION (closed cluster — imports only itself; 0 production importers)
| Module | Kind | Imported by |
|---|---|---|
| memoryEngineV2 | spec | memoryRuntimeAdapter, onlineRuntimeV2 (both not-in-production) |
| memoryRuntimeAdapter | ADAPTER / MIRROR | (nobody) |
| speechDeliveryRuntimeV2 | SPEC | (nobody, non-test) |
| onlineRuntimeV2 | SPEC | intentRouterV2 (not-in-production) |
| intentRouterV2 | AGREEMENT layer | (nobody, non-test) |

Measured verdict: this cluster is NOT EXECUTED IN PRODUCTION. Its acceptance suites prove
the SPECS agree with production behavior, but production does not call this code.

## FALSE-GREEN occurrences (tests/agreement green, production runs different code)
- memoryRuntimeCutover / memoryEngineV2Acceptance: memory tested via memoryEngineV2 +
  memoryRuntimeAdapter; production memory is RuntimeState fields (NOT this code).
- speechDeliveryRuntimeV2Acceptance: speech tested via SpeechPlanV2; production speech is
  conversationDeliveryEngine.planDelivery (NOT SpeechPlanV2).
- onlineRuntimeV2Acceptance: online tested via OnlineRuntimeV2.run; production online is
  runtimeFullTurn.callOnlineWithRetry (NOT OnlineRuntimeV2).
- intentRouterV2Acceptance: routing tested via routeTurn + a runtime-AGREEMENT check;
  production routing is cognitiveRuntime.classifyIntent (routeTurn is NOT the in-path caller).

## Remaining work to satisfy Sprint 11 success criteria (2–7)
Either INLINE these specs into production (large refactor, risks the ~7000 production tests)
or DELETE the closed cluster + its suites (destructive removal of Sprints 4–9 validation).
This is a destructive/irreversible product decision — recorded here, not taken unilaterally.
