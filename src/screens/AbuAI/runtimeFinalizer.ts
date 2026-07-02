/*
 * Runtime Finalizer
 * ═════════════════
 * The SINGLE tail every answer passes through before it can be shown or spoken:
 *   composed text → Cognitive Supervisor (gate + one repair, else honest limit)
 *   → Conversation Delivery Engine (speech chunks) → RUNTIME_FINALIZED trace.
 *
 * `runFullTurn` calls this for every input. If a piece of code produced a
 * FinalizeResult, that answer is — by construction — supervised, deliverable, and
 * stamped. `noBypassRuntimeGuard` rejects anything without the stamp.
 */
import { type RuntimeIntent } from './cognitiveRuntime'
import { supervise, repair, type SupervisorVerdict } from './cognitiveSupervisor'
import { planDelivery, type DeliveryState } from './conversationDeliveryEngine'
import { stampTrace, type RuntimeStage, type RuntimeTrace } from './runtimeTrace'

const HONEST_LIMIT = 'לא הצלחתי לנסח את זה כמו שצריך. תגידי לי שוב מה חשוב לך?'

export interface FinalizeInput {
  display: string
  speak: string
  intent: RuntimeIntent
  source: string
  /** stages already traversed before finalize (input/normalize/intent/domain/tool). */
  priorStages: RuntimeStage[]
  dataAvailable?: boolean
  forVoice?: boolean
}

export interface FinalizeResult {
  display: string
  speak: string
  delivery: DeliveryState
  supervisor: SupervisorVerdict & { repaired: boolean }
  trace: RuntimeTrace
}

export function finalize(input: FinalizeInput): FinalizeResult {
  let display = (input.display ?? '').trim()
  let speak = (input.speak ?? display).trim()
  const dataAvailable = input.dataAvailable ?? true
  const forVoice = input.forVoice ?? true

  let verdict = supervise(speak, { intent: input.intent, dataAvailable, forVoice })
  let repaired = false

  if (!verdict.approved) {
    const fixed = repair(speak, verdict)
    if (fixed && fixed !== speak) {
      speak = fixed
      if (verdict.reasons.includes('robotic') || verdict.reasons.includes('apology_loop')) display = repair(display, verdict)
      repaired = true
      verdict = supervise(speak, { intent: input.intent, dataAvailable, forVoice })
    }
  }
  // Still unsafe → never emit the flagged text; answer honestly with the limitation.
  if (!verdict.approved) {
    display = HONEST_LIMIT; speak = HONEST_LIMIT; repaired = true
    verdict = supervise(speak, { intent: input.intent, dataAvailable, forVoice })
  }

  const delivery = planDelivery(display || speak)
  const trace = stampTrace([...input.priorStages, 'finalize', 'supervise', 'deliver'], input.intent, input.source)
  return { display: display || speak, speak, delivery, supervisor: { ...verdict, repaired }, trace }
}
