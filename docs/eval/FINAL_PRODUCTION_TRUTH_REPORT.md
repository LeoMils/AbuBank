# Final Production Truth — measured report

## Production status of the three modules (EXECUTED, proven by finalProductionTruth.test.ts)
- onlineRuntimeV2 — EXECUTED IN PRODUCTION. runtimeFullTurn calls onlineRuntimeV2.runQuery
  (provider + retry + freshness + trace); its trace appears on every online turn
  (r.onlineTrace) and is surfaced in diagnostics. Old owner callOnlineWithRetry DELETED.
- speechDeliveryRuntimeV2 — EXECUTED IN PRODUCTION. runtimeFinalizer builds the delivery
  from createSpeechPlan(display); every answer's delivery.chunks equal the plan's chunks.
  The finalizer no longer calls planDelivery directly.
- memoryEngineV2 — EXECUTED IN PRODUCTION. liveTurnDiagnostics (called by the Executive
  Controller every turn) writes each turn into a MemoryEngineV2 instance; Copy-Last-20
  (dumpTurns) reads its canonical turns + last tool result.

## Old owners deleted / retired (measured)
- callOnlineWithRetry (function) — DELETED from runtimeFullTurn; the 2 tests migrated to
  onlineRuntimeV2.runQuery via a local shim.
- planDelivery — no longer called by runtimeFinalizer (SpeechPlanV2 is the delivery source).
  planDelivery remains a low-level chunker that SpeechPlanV2 wraps (ACTIVE_SUPPORT).

## Production V2 imports — before → after
- Before this sprint: 4 executed (semantic, conversation, calendar, hebrew).
- After: 7 executed (+ onlineRuntimeV2, speechDeliveryRuntimeV2, memoryEngineV2).
- NOT_EXECUTED V2 modules: 0 (productionTruthSuite asserts the list is empty).

## Honest residual notes (measured, not hidden)
- memoryEngineV2 owns the turn-history / last-tool / Copy-Last-20 layer. Live pending/goal
  still lives in RuntimeState (single owner, distinct concern) — NOT a duplicate memory owner.
- The LiveTurnRecord diagnostics buffer (rich per-turn fields) coexists with memoryEngineV2
  turns; both are surfaced in Copy-Last-20 by design (diagnostics layer vs memory layer).
- SpeechPlanV2 chunking drives every delivery; its cursor/continue/replay methods exist but
  production "תמשיכי" is handled upstream by intent — those methods are unused in prod (not
  a competing owner).

## Remaining device-only / provider-only (unchanged)
- DEVICE_ONLY: physical mic/STT quality, actual TTS voice feel, live audio interruption.
- PROVIDER_ONLY: real live provider content (scores/movies/buses/weather) — routing, retry,
  cache, freshness, trace, honest failure are proven; the data is provider-gated.

## Remaining code-side risks
- None reproducible: full suite 8575/8575, Golden Corpus, stress, path proof, truth suite green.
