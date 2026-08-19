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
import { interpretTask } from './aiTaskInterpreter'
import { recordTurn } from './liveTurnDiagnostics'
import { APP_VERSION } from '../../version'
import { observeTurn } from '../../evolution/observer'
import { resolveConfig } from '../../evolution/config'
import type { InputModality, LanguageChainTrace } from '../../evolution/traceEnvelope'

/** Optional per-turn observation metadata from the calling surface (§7). Lets the
 *  voice paths record the REAL input modality + language chain instead of the old
 *  hard-coded 'text'. Absent → defaults to a typed turn (backward compatible). */
export interface TurnObservation {
  inputModality?: InputModality
  language?: LanguageChainTrace
}

// Evolution OS config, resolved once. Env can only ever make it SAFER (kill switch),
// never escalate past OBSERVE_ONLY — that is a code + human-approval change by design.
// HYGIENE: pass ONLY the specific kill-switch key, never the whole `import.meta.env`
// object. (NB: this narrowing alone does NOT stop a billable-key leak — Vite exposes ALL
// VITE_-prefixed vars to the client regardless. The real fix for the 0.286 VITE_AZURE_TTS_KEY
// leak is env-level: a server-only billable key must NOT carry the VITE_ prefix / be set in
// the build env. See docs/abuai/ENV_CONTRACT.md and bundleSecretScan.ts.)
const EVOLUTION_CFG = resolveConfig({
  VITE_EVOLUTION_KILL: import.meta.env.VITE_EVOLUTION_KILL as string | undefined,
})

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
  obs?: TurnObservation,
): Promise<ExecutiveDecision> {
  const result = await runFullTurn(state, input, ctx, tools)
  // The executive never emits an unstamped answer.
  assertNoBypass(result, `executive:${result.intent}`)
  // AI Task Interpreter — the inferred task for this turn (pre-turn context), traced.
  const task = interpretTask(input, { pendingReminder: !!state.pendingReminder, pendingCreate: state.createState.phase !== 'idle' })
  // Diagnostics: record the turn for the "Copy Last 20 AbuAI Turns" debug dump.
  try {
    recordTurn({
      aiTask: { taskType: task.taskType, reason: task.reason, slots: task.slots, forbiddenRoutes: task.forbiddenRoutes },
      ts: ctx.now.getTime(), version: APP_VERSION.version, input,
      normalized: result.meta.actualQuestion, intent: result.intent, source: result.source,
      entities: result.meta.entities, missingFields: result.meta.missingFields,
      draftFields: { pendingCreate: result.state.createState.phase, pendingReminder: !!result.state.pendingReminder },
      toolResult: result.sideEffect ?? null, finalAnswer: result.display,
      speechChunks: result.delivery.chunks, error: null,
      onlineTrace: result.onlineTrace, finalizerStages: result.trace.stages, finalizerStamp: result.trace.stamp,
    })
  } catch { /* diagnostics must never break a turn */ }
  // Evolution OS (OBSERVE_ONLY): capture a redacted, minimized trace of this turn
  // into the durable evidence queue and run signal detection. Fire-and-forget and
  // structurally incapable of changing the served answer (see src/evolution). Never
  // throws into a turn; a global/per-domain kill switch silences it instantly.
  try {
    observeTurn({
      ts: ctx.now.getTime(),
      turnId: `turn-${ctx.now.getTime()}-${result.intent}`,
      input,
      normalized: result.meta.actualQuestion,
      intent: result.intent,
      source: result.source,
      finalAnswer: result.display,
      ttsInput: result.speak,
      speechChunks: result.delivery.chunks,
      entities: result.meta.entities,
      missingFields: result.meta.missingFields,
      supervisorApproved: result.supervisor.approved,
      supervisorReasons: result.supervisor.reasons,
      appVersion: APP_VERSION.version,
      // Real input modality + language chain from the calling surface (§7); the
      // coarse text/voice modality is DERIVED from this, no longer hard-coded.
      inputModality: obs?.inputModality ?? 'typed',
      ...(obs?.language ? { language: obs.language } : {}),
      ...(result.sideEffect ? { committedStateChanges: [result.sideEffect] } : {}),
    }, EVOLUTION_CFG)
  } catch { /* OBSERVE_ONLY must never break a turn */ }
  return { ...result, controller: 'executive-cognitive-controller' }
}

export const ExecutiveCognitiveController = { handleTurn: executiveHandleTurn } as const
