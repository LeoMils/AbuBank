/*
 * Runtime Full Turn (Phase 12 — the no-bypass entry point)
 * ════════════════════════════════════════════════════════
 * The single async entry the FULL cutover uses. For EVERY input it produces the
 * final display + speech text — nothing is emitted outside it. Deterministic
 * domains are answered by `runCognitiveTurn`; LLM/online are executed via INJECTED
 * tools and their output is forced back through `finalizeExternalAnswer` (verify +
 * compose) — so even an LLM/online answer is a runtime answer, never raw. The
 * Cognitive Supervisor gates the result (repair once), and the Conversation
 * Delivery Engine plans the speech chunks.
 *
 * Tools are injected → this is fully unit-testable and PROVES no raw tool text can
 * reach the UI. The React `handleSend`/voice call this behind
 * ABUAI_COGNITIVE_RUNTIME_V2_FULL and emit ONLY its result.
 */
import {
  runCognitiveTurn, finalizeExternalAnswer, type RuntimeState, type RuntimeContext, type RuntimeIntent,
} from './cognitiveRuntime'
import { supervise, repair, type SupervisorVerdict } from './cognitiveSupervisor'
import { planDelivery, type DeliveryState } from './conversationDeliveryEngine'

export interface FullTurnTools {
  /** Grounded LLM answer for general knowledge / prose. */
  llm: (input: string, grounding: string | null, messages: Array<{ role: string; content: string }>) => Promise<string>
  /** Live web/current-info lookup. */
  online: (query: string) => Promise<{ ok: boolean; answer: string; reason?: string | null }>
}

export interface FullTurnResult {
  intent: RuntimeIntent
  display: string
  speak: string
  delivery: DeliveryState
  state: RuntimeState
  sideEffect: 'saved_appointment' | 'save_failed' | null
  supervisor: SupervisorVerdict & { repaired: boolean }
  /** Always true — structural proof that this answer came from the runtime. */
  routedThroughRuntime: true
  /** 'deterministic' | 'llm' | 'online' | 'fallback' — how the answer was produced. */
  source: 'deterministic' | 'llm' | 'online' | 'fallback'
}

const ONLINE_FAIL: Record<string, string> = {
  provider_failed: 'ניסיתי לבדוק אונליין וזה נפל לי. שננסה שוב?',
  timeout: 'לקח לזה יותר מדי זמן ונקטע. שננסה שוב?',
  default: 'לא הצלחתי לבדוק את זה עכשיו. שננסה שוב?',
}

export async function runFullTurn(
  state: RuntimeState,
  input: string,
  ctx: RuntimeContext,
  tools: FullTurnTools,
): Promise<FullTurnResult> {
  const decision = runCognitiveTurn(state, input, ctx)

  let display = ''
  let speak = ''
  let st = decision.state
  let intent = decision.intent
  const sideEffect = decision.sideEffect
  let source: FullTurnResult['source'] = 'deterministic'

  if (decision.handled) {
    display = decision.display ?? ''
    speak = decision.speak ?? display
  } else if (decision.needsOnline && decision.online) {
    source = 'online'
    intent = 'online'
    const o = await tools.online(decision.online.query)
    const raw = o.ok ? o.answer : (ONLINE_FAIL[o.reason ?? 'default'] ?? ONLINE_FAIL.default!)
    const fin = finalizeExternalAnswer(decision.state, raw, {
      intent: 'online', topic: decision.online.query,
      online: { ok: o.ok, reason: o.reason ?? null, query: decision.online.query, summary: o.ok ? o.answer : null },
    })
    display = fin.display ?? ''; speak = fin.speak ?? display; st = fin.state
  } else if (decision.needsLLM) {
    source = 'llm'
    const raw = await tools.llm(input, decision.grounding, ctx.messages)
    // Derive the topic from the ask ("ספרי לי על המהפכה הצרפתית" → "המהפכה הצרפתית")
    // so "על מה דיברנו" / "תמשיכי" work next turn.
    const topic = input.replace(/^(?:ספרי\s+לי\s+על|תספרי\s+לי\s+על|ספר\s+לי\s+על|מה\s+זה|מה\s+זאת|מה\s+את\s+יודעת\s+על)\s+/u, '').trim() || null
    const fin = finalizeExternalAnswer(decision.state, raw, { intent: decision.intent, topic })
    display = fin.display ?? ''; speak = fin.speak ?? display; st = fin.state
  } else {
    // Never bypass: an unclassified turn still gets a runtime-composed honest reply.
    source = 'fallback'
    const fin = finalizeExternalAnswer(decision.state, 'לא הבנתי עד הסוף. תגידי לי שוב במילים אחרות ואני איתך.', { intent: decision.intent })
    display = fin.display ?? ''; speak = fin.speak ?? display; st = fin.state
  }

  // Cognitive Supervisor — gate + one repair, then re-check.
  let verdict = supervise(speak, { intent, dataAvailable: true, forVoice: true, question: input })
  let repaired = false
  if (!verdict.approved) {
    const fixed = repair(speak, verdict)
    if (fixed && fixed !== speak) {
      speak = fixed
      // keep display in sync when the repair shortened a voice-too-long answer
      if (verdict.reasons.includes('robotic') || verdict.reasons.includes('apology_loop')) display = repair(display, verdict)
      repaired = true
      verdict = supervise(speak, { intent, dataAvailable: true, forVoice: true, question: input })
    }
  }
  // If STILL unsafe (e.g. an LLM produced broken Hebrew the repair can't salvage),
  // NEVER emit the flagged text — answer honestly with the limitation (Phase 9).
  if (!verdict.approved) {
    const honest = 'לא הצלחתי לנסח את זה כמו שצריך. תגידי לי שוב מה חשוב לך?'
    const fin = finalizeExternalAnswer(st, honest, { intent })
    display = fin.display ?? honest; speak = fin.speak ?? honest; st = fin.state
    source = 'fallback'; repaired = true
    verdict = supervise(speak, { intent, dataAvailable: true, forVoice: true, question: input })
  }

  const delivery = planDelivery(display || speak)
  return {
    intent, display: display || speak, speak, delivery, state: st, sideEffect,
    supervisor: { ...verdict, repaired }, routedThroughRuntime: true, source,
  }
}
