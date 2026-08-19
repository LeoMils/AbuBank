# Runtime Convergence — audit (measured facts only)

## The single production path (measured from imports)
Every turn enters `ExecutiveCognitiveController.handleTurn` → `runFullTurn`
(runtimeFullTurn.ts) → `runCognitiveTurn` (cognitiveRuntime.ts) → `finalize`
(runtimeFinalizer.ts) → `assertNoBypass` (noBypassRuntimeGuard.ts). Every emitted answer
carries a `RuntimeTrace` ending in the `RUNTIME_FINALIZED` stamp; `assertNoBypass` throws
on any answer lacking it. Required stages: input → intent → finalize → supervise → deliver.

## Runtime graph (owner · call site · in-path?)
| Stage | Owner | In production path? (measured non-test src importers) |
|---|---|---|
| Semantic recovery | semanticIntelligenceEngine.recoverTranscript | YES — imported by cognitiveRuntime (1) |
| Intent decision | cognitiveRuntime.classifyIntent (+ conversationEngineV2) | YES — conversationEngineV2 imported by cognitiveRuntime (1) |
| Calendar builder | calendarEventBuilderV2.buildEventV2 | YES — imported by AbuCalendar/service (1) |
| Family | familyRelationEngine / familyPathReasoner | YES — in-path |
| Online | runtimeFullTurn.callOnlineWithRetry | YES — in-path online call site |
| Hebrew finalizer | hebrewNaturalConversationV2.rewriteHebrewAnswer | YES — imported by runtimeFinalizer (1) |
| Speech delivery | conversationDeliveryEngine.planDelivery | YES — in-path (finalize) |
| Finalizer / no-bypass | runtimeFinalizer.finalize + noBypassRuntimeGuard | YES — the single tail |

## Parallel VALIDATION modules — proven-to-agree, NOT in the production path (measured)
These have 0 non-test in-path importers; they are spec/acceptance layers that assert the
production path's behavior, not code the production path calls:
- memoryEngineV2 / memoryRuntimeAdapter (memory cutover: accessor over RuntimeState)
- speechDeliveryRuntimeV2 (speech logic spec)
- onlineRuntimeV2 (online spec; also feeds intentRouterV2's classifyOnlineNeed)
- intentRouterV2 (routing spec; proven to agree with the in-path classifier)
These are KEPT as executable specifications (their acceptance suites are the proof
artifacts). Inlining them into the production path + deleting the in-path equivalents is
the remaining convergence work — recorded here as measured technical debt, NOT claimed done.

## Legacy DELETED this sprint (measured)
- `onlineEngineV2.ts` (65 LOC) + `onlineEngineV2.test.ts` (40 LOC) = 105 LOC.
  Reason: 0 non-test in-path importers; every export had 0 in-path uses; superseded by
  onlineRuntimeV2 (Sprint 7). Full suite re-run green after deletion (behavior-preserving).

## Legacy REMAINING (measured, honest)
- `cognitiveRuntime.classifyIntent` remains the in-path classifier (Intent Router v2 is a
  proven-agreeing spec, not yet the in-path caller). Classify: DERIVED (agreement-tested).
- The parallel validation modules above are not yet inlined. Classify: KEEP (spec) — debt.
- No second finalizer, no second no-bypass path, no duplicate source of truth for family
  (single graph) or calendar (single buildEventV2) was found.
