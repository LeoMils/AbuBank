# Single Turn Store cleanup

## Old owner
`liveTurnDiagnostics.ts` held a module-global `const BUFFER: LiveTurnRecord[]` ring (20),
in ADDITION to a MemoryEngineV2 instance — two parallel turn stores. Copy Last 20 dumped
both (`turns` from BUFFER + `memoryTurns` from the engine).

## New owner
MemoryEngineV2 is the SINGLE turn store. Each turn is stored via
`rememberTurn(user, answer, decision, diag)` where `diag` is the full `LiveTurnRecord`
(rich fields + provider/speech/finalizer/error traces). `exportDiagnostics()` returns those
records. `liveTurnDiagnostics` is now a thin facade: `recordTurn` writes to the engine,
`lastTurns`/`dumpTurns` read only from `memory.exportDiagnostics()`.

## Deleted duplicate storage
- `const BUFFER: LiveTurnRecord[]` — removed.
- `memoryTurns()` / `memoryLastTool()` exports — removed (folded into the single store).

## Files changed
- `memoryEngineV2.ts` — `TurnRecord.diag?`, `rememberTurn(..., diag?)`, `exportDiagnostics()`.
- `liveTurnDiagnostics.ts` — deleted BUFFER; single MemoryEngineV2; lastTurns/dumpTurns read only from it.
- `executiveCognitiveController.ts` — recordTurn now includes onlineTrace + finalizer stages/stamp.
- `finalProductionTruth.test.ts` — reads `dumpTurns().turns` (single store).

## Traces now stored in the single store (per turn)
provider (`onlineTrace`), speech (`speechChunks`), finalizer (`finalizerStages`/`finalizerStamp`),
error (`error`), tool result (`memory.getLastToolResult`).

## Compatibility for Copy Last 20
`dumpTurns()` keeps `{ count, turns, lastTool }`; `turns` is now sourced solely from
MemoryEngineV2. `lastTurns()`/`copyLastTurns()`/`__abuaiDumpTurns` signatures unchanged →
the Settings button + ErrorBoundary export work unchanged. No product behavior change.
