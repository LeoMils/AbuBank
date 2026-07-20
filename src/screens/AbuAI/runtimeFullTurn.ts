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
  type CognitiveDecision,
} from './cognitiveRuntime'
import { type SupervisorVerdict } from './cognitiveSupervisor'
import { type DeliveryState } from './conversationDeliveryEngine'
import { finalize } from './runtimeFinalizer'
import { type RuntimeStage, type RuntimeTrace } from './runtimeTrace'
import { metaReason, type MetaResult } from './metaReasoner'
import { checkCalendarContradiction } from './contradictionGuard'
import { assessConfidence } from './confidenceGuard'
import { getTodayEvents, getTomorrowEvents } from './tools'
import { createOnlineRuntime, type OnlineRuntimeV2 } from './onlineRuntimeV2'
import { interpretTask } from './aiTaskInterpreter'
import { authorityIntent, legacyDomainClassify } from './cognitiveRuntime'
import { interpretUtterance, groundIntent, groundingLine, type InterpretTransport } from './understandingIntake'
import { guardNoFabricatedCalendar } from './noFabricationGuard'
import { shouldReverifyOnline } from './correctionVerification'

function calendarCountForScope(scope: 'today' | 'tomorrow'): number {
  try { return scope === 'tomorrow' ? getTomorrowEvents().events.length : getTodayEvents().events.length }
  catch { return 0 }
}

export interface FullTurnTools {
  /** Grounded LLM answer for general knowledge / prose. */
  llm: (input: string, grounding: string | null, messages: Array<{ role: string; content: string }>) => Promise<string>
  /** Live web/current-info lookup. */
  online: (query: string) => Promise<{ ok: boolean; answer: string; reason?: string | null }>
  /** P1 understanding-first: interpret a turn the fast-path pattern cache MISSED
   *  into a structured intent. Optional — absent → pattern-only behavior (backward
   *  compatible). Injected so it is mockable in tests / a real provider in the app. */
  interpret?: InterpretTransport
  /** Optional latency sink for the understanding step (ms, operation) — diagnostics. */
  onUnderstandLatency?: (ms: number, operation: string) => void
}

export interface FullTurnResult {
  intent: RuntimeIntent
  display: string
  speak: string
  delivery: DeliveryState
  state: RuntimeState
  sideEffect: CognitiveDecision['sideEffect']
  supervisor: SupervisorVerdict & { repaired: boolean }
  /** Always true — structural proof that this answer came from the runtime. */
  routedThroughRuntime: true
  /** 'deterministic' | 'llm' | 'online' | 'fallback' — how the answer was produced. */
  source: 'deterministic' | 'llm' | 'online' | 'fallback'
  /** RUNTIME_FINALIZED trace — checked by noBypassRuntimeGuard. */
  trace: RuntimeTrace
  /** what the Meta Reasoner understood the user actually asked. */
  meta: MetaResult
  /** Online Runtime v2 provider trace (null for non-online turns) — for Copy Last 20. */
  onlineTrace: ReturnType<OnlineRuntimeV2['exportOnlineTrace']>
  /** AI Task Interpreter decision + whether it overrode the legacy runtime router. */
  aiTask: { taskType: string; confidence: number; reason: string; slots: unknown }
  runtimeExecutedTask: RuntimeIntent
  interpreterOverrodeRuntime: boolean
}

// Online retry/failover now lives in Online Runtime v2 (onlineRuntimeV2.runQuery), the
// single production online owner. This module only maps a failure reason to Martita's line.
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
  // Meta Reasoner FIRST — understand what was actually asked (traced every turn).
  const meta = metaReason(input, state)
  let decision = runCognitiveTurn(state, input, ctx)

  // P7 correction-verification: a factual correction of a prior ONLINE answer must
  // RE-SEARCH that topic, never just agree. Only overrides when the runtime would
  // otherwise merely chat / fall back (not a deterministic domain, not already online).
  if (!decision.handled && !decision.needsOnline) {
    const rv = shouldReverifyOnline(input, state.focus)
    if (rv.reverify) decision = { ...decision, handled: false, needsLLM: false, needsOnline: true, online: { query: rv.topic } }
  }

  let display = ''
  let speak = ''
  let st = decision.state
  let intent = decision.intent
  const sideEffect = decision.sideEffect
  let source: FullTurnResult['source'] = 'deterministic'
  let onlineTrace: ReturnType<OnlineRuntimeV2['exportOnlineTrace']> = null

  if (decision.handled) {
    display = decision.display ?? ''
    speak = decision.speak ?? display
    // Contradiction Guard (live): a calendar read must agree with the real store.
    if (intent === 'calendar_read') {
      const scope = /מחר/u.test(input) ? 'tomorrow' : 'today'
      const real = calendarCountForScope(scope)
      const c = checkCalendarContradiction(display, real)
      if (c.contradiction) { display = real === 0 ? (scope === 'tomorrow' ? 'מחר אין כלום. יום שקט.' : 'היום אין כלום ביומן.') : `יש לך ${real} דברים ביומן.`; speak = display }
    }
    // Confidence Guard (live): a family turn with no resolved directional pair must
    // not assert a relation as fact.
    if (meta.domain === 'family' && !decision.familyGrounded && assessConfidence(meta).block && !/לא אנחש|לא בטוחה|לא יודעת/u.test(display)) {
      display = 'אני לא בטוחה בקשר הזה, אז לא אנחש. תגידי לי מי מי ואני אזכור.'; speak = display
    }
  } else if (decision.needsOnline && decision.online) {
    source = 'online'
    intent = 'online'
    // Online Runtime v2 is the production online owner: provider + retry + freshness +
    // trace + honest failure. The trace is recorded for diagnostics (Copy Last 20).
    const onlineRuntime = createOnlineRuntime()
    const o = await onlineRuntime.runQuery(decision.online.query, tools.online)
    onlineTrace = onlineRuntime.exportOnlineTrace()
    const raw = o.ok ? o.answer : (ONLINE_FAIL[o.reason ?? 'default'] ?? ONLINE_FAIL.default!)
    const fin = finalizeExternalAnswer(decision.state, raw, {
      intent: 'online', topic: decision.online.query,
      online: { ok: o.ok, reason: o.reason ?? null, query: decision.online.query, summary: o.ok ? o.answer : null },
    })
    display = fin.display ?? ''; speak = fin.speak ?? display; st = fin.state
  } else if (decision.needsLLM) {
    source = 'llm'
    // P1 understanding-first: the pattern fast-path MISSED (it fell to the LLM). Try
    // the understanding layer to recover a structured intent and ground it through
    // the deterministic engines, then feed the VERIFIED facts (graph-resolved people,
    // engine-parsed date/time) to the LLM so it cannot hallucinate them. Understanding
    // never decides a family relation on its own and can never invent a person; it
    // only enriches grounding. Bounded + fire-and-forget-safe: it never breaks a turn.
    let grounding = decision.grounding
    if (tools.interpret) {
      try {
        const started = Date.now()
        const grounded = groundIntent(await interpretUtterance(input, tools.interpret))
        const ms = Date.now() - started
        tools.onUnderstandLatency?.(ms, grounded.operation)
        const line = groundingLine(grounded)
        if (line) grounding = grounding ? `${line}\n${grounding}` : line
      } catch { /* understanding must never break a turn — fall through to raw LLM */ }
    }
    const raw = await tools.llm(input, grounding, ctx.messages)
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

  // P6 no-fabrication hard law: an LLM/fallback answer may NEVER assert a specific
  // appointment (the "1 באוקטובר" class) — calendar is deterministic. Neutralize to an
  // honest deferral before finalize. Deterministic/online answers are trusted.
  { const g = guardNoFabricatedCalendar(display, source); if (g.scrubbed) { display = g.text; speak = g.text } }

  // Single finalizer tail: Cognitive Supervisor (gate + repair + honest limit) →
  // Conversation Delivery Engine → RUNTIME_FINALIZED trace.
  const priorStages: RuntimeStage[] = ['input', 'normalize', 'meta', 'intent', source === 'deterministic' ? 'domain' : 'tool']
  const recentAssistant = ctx.messages.filter(m => m.role === 'assistant').map(m => m.content).slice(-4)
  const fin = finalize({ display, speak, intent, source, priorStages, dataAvailable: true, forVoice: true, recentAssistant })
  // AI Task Interpreter authority trace: the inferred task + whether it overrode the
  // legacy router (i.e. its confident decision drove the executed route, differing from
  // what the legacy cues alone would have picked).
  const task = interpretTask(input, { pendingReminder: !!state.pendingReminder, pendingCreate: state.createState.phase !== 'idle' })
  const auth = authorityIntent(input, state)
  const interpreterOverrodeRuntime = auth !== null && auth === intent && auth !== legacyDomainClassify(input.trim())
  return {
    intent, display: fin.display, speak: fin.speak, delivery: fin.delivery, state: st, sideEffect,
    supervisor: fin.supervisor, routedThroughRuntime: true, source, trace: fin.trace, meta, onlineTrace,
    aiTask: { taskType: task.taskType, confidence: task.confidence, reason: task.reason, slots: task.slots },
    runtimeExecutedTask: intent, interpreterOverrodeRuntime,
  }
}
