/*
 * Executive Cognitive Controller
 * ══════════════════════════════
 * The SINGLE executive that owns every AbuAI turn. AbuAI is no longer a bag of
 * components the UI calls in sequence — the UI (text + voice) calls ONLY this
 * controller, which drives the fixed cognitive pipeline and then ENFORCES the
 * no-bypass invariant on its own output before returning:
 *
 *   input → Meta Reasoner → Cognitive Runtime (intent/domain/tool) → guards
 *         → Runtime Finalizer (naturalize → dialogue → supervise → deliver)
 *         → RUNTIME_FINALIZED stamp   [assertNoBypass]
 *
 * `runFullTurn` is the orchestration engine; this controller is the authority: it
 * is the only thing allowed to hand an answer to the UI/TTS, and it throws if an
 * answer ever reached it without the finalized stamp. One brain, one gate.
 */
import { runFullTurn, type FullTurnTools, type FullTurnResult } from './runtimeFullTurn'
import { type RuntimeState, type RuntimeContext } from './cognitiveRuntime'
import { assertNoBypass } from './noBypassRuntimeGuard'
import { recordTurn } from './liveTurnDiagnostics'
import { APP_VERSION } from '../../version'

export interface ExecutiveDecision extends FullTurnResult {
  controller: 'executive-cognitive-controller'
}

/**
 * The one entry point for a user turn (text or voice). Returns the final,
 * supervised, delivery-planned, RUNTIME_FINALIZED answer — or throws if the
 * pipeline ever produced something unstamped (which would be a bypass).
 */
export async function executiveHandleTurn(
  state: RuntimeState,
  input: string,
  ctx: RuntimeContext,
  tools: FullTurnTools,
): Promise<ExecutiveDecision> {
  const result = await runFullTurn(state, input, ctx, tools)
  // The executive never emits an unstamped answer.
  assertNoBypass(result, `executive:${result.intent}`)
  // Diagnostics: record the turn for the "Copy Last 20 AbuAI Turns" debug dump.
  try {
    recordTurn({
      ts: ctx.now.getTime(), version: APP_VERSION.version, input,
      normalized: result.meta.actualQuestion, intent: result.intent, source: result.source,
      entities: result.meta.entities, missingFields: result.meta.missingFields,
      draftFields: { pendingCreate: result.state.createState.phase, pendingReminder: !!result.state.pendingReminder },
      toolResult: result.sideEffect ?? null, finalAnswer: result.display,
      speechChunks: result.delivery.chunks, error: null,
      onlineTrace: result.onlineTrace, finalizerStages: result.trace.stages, finalizerStamp: result.trace.stamp,
    })
  } catch { /* diagnostics must never break a turn */ }
  return { ...result, controller: 'executive-cognitive-controller' }
}

export const ExecutiveCognitiveController = { handleTurn: executiveHandleTurn } as const
