/*
 * Conversation Brain
 * ══════════════════
 * The decision layer that makes AbuAI a companion, not a router. It tracks the
 * GOAL of the turn and STATE of the conversation, then PLANS one action —
 * composing the pieces that are already wired into the runtime:
 *
 *   normalize/STT recovery → understanding (orchestrate) → Conversation OS
 *   (continuation/repair/online memory) → goal tracking → planner → [tools] →
 *   Companion Experience Enforcer → Spoken Persona → TTS.
 *
 * `planTurn` is pure: it returns the goal, the chosen action, the domain to route
 * to, and — when the brain can answer directly (continuation / failure
 * explanation) — the exact words to speak. The runtime executes the action.
 */
import { orchestrate, type OrchestratorContext } from './understandingOrchestrator'
import {
  handleConversationTurn, isContinuation, isWhyChallenge, isOnlineChallenge, isFrustration,
  type ConvState,
} from './conversationOS'

export type ConversationGoal =
  | 'create_calendar_event'
  | 'update_calendar_event'
  | 'answer_online_result'
  | 'answer_online_schedule'
  | 'continue_previous_answer'
  | 'explain_failure'
  | 'repair_misunderstanding'
  | 'emotional_support'
  | 'family_conversation'
  | 'general_companion_chat'
  | 'clarify_missing_info'

export type PlannerAction =
  | 'answer_now'
  | 'ask_clarification'
  | 'continue_previous_answer'
  | 'explain_recorded_failure'
  | 'save_calendar'
  | 'park_pending_calendar'
  | 'update_pending_calendar'
  | 'route_online'
  | 'route_family'
  | 'route_memory'
  | 'route_general'
  | 'emotional_presence'

export type BrainDomain = 'calendar' | 'online' | 'family' | 'memory' | 'emotional' | 'general'

export interface BrainContext extends OrchestratorContext {
  conv: ConvState
  hasPendingCalendar?: boolean
}

export interface BrainDecision {
  goal: ConversationGoal
  action: PlannerAction
  domain: BrainDomain
  /** Direct words to speak when the brain answers itself (continuation/repair). */
  speak: string | null
  /** For online turns: is the user asking for a RESULT or a SCHEDULE? */
  onlineKind: 'result' | 'schedule' | null
  conv: ConvState
}

// Sports "result" intent vs "schedule" intent.
const RESULT_RE = /מי\s+ניצח|מי\s+ניצחה|כמה\s+יצא|מה\s+התוצאה|מה\s+התוצאות|תוצאה\s+סופית|מה\s+היה\s+במשחק|נגמר/u
const SCHEDULE_RE = /איזה\s+משחקים|אילו\s+משחקים|מתי\s+משחק|לוח\s+משחקים|משחקים\s+(?:היום|מחר|הערב|השבוע)|מתי\s+המשחק/u

function onlineKindOf(text: string): 'result' | 'schedule' | null {
  if (SCHEDULE_RE.test(text)) return 'schedule'
  if (RESULT_RE.test(text)) return 'result'
  return null
}

/**
 * Plan one conversational turn. The runtime calls this, then executes `action`
 * (or speaks `speak` directly when present).
 */
export function planTurn(input: string, ctx: BrainContext): BrainDecision {
  const conv = ctx.conv
  const t = input.trim()

  // 1) Conversation OS owns continuation + repair when it has context.
  const turn = handleConversationTurn(conv, t)
  if (turn.handled) {
    const goal: ConversationGoal = turn.action === 'repair' ? 'repair_misunderstanding' : 'continue_previous_answer'
    const action: PlannerAction = turn.action === 'repair'
      ? (isWhyChallenge(t) || isOnlineChallenge(t) ? 'explain_recorded_failure' : 'answer_now')
      : 'continue_previous_answer'
    return { goal, action, domain: 'general', speak: turn.speak, onlineKind: null, conv: turn.state }
  }

  // 2) Understanding.
  const decision = orchestrate(t, { messages: ctx.messages })
  const intent = decision.intent

  // 3) Goal + planner per domain.
  switch (intent) {
    case 'calendar_create':
    case 'calendar_modify':
    case 'calendar_delete':
    case 'calendar_search':
    case 'calendar_read': {
      const action: PlannerAction = intent === 'calendar_create'
        ? (ctx.hasPendingCalendar ? 'update_pending_calendar' : 'save_calendar')
        : 'answer_now'
      const goal: ConversationGoal = ctx.hasPendingCalendar ? 'update_calendar_event' : 'create_calendar_event'
      return { goal, action, domain: 'calendar', speak: null, onlineKind: null, conv }
    }
    case 'online': {
      const kind = onlineKindOf(t)
      // A pending calendar must be parked before answering an unrelated online turn.
      const action: PlannerAction = ctx.hasPendingCalendar ? 'park_pending_calendar' : 'route_online'
      return {
        goal: kind === 'schedule' ? 'answer_online_schedule' : 'answer_online_result',
        action, domain: 'online', speak: null, onlineKind: kind ?? 'result', conv,
      }
    }
    case 'family':
      return { goal: 'family_conversation', action: 'route_family', domain: 'family', speak: null, onlineKind: null, conv }
    case 'recall':
      return { goal: 'general_companion_chat', action: 'route_memory', domain: 'memory', speak: null, onlineKind: null, conv }
    case 'emotional':
      return { goal: 'emotional_support', action: 'emotional_presence', domain: 'emotional', speak: null, onlineKind: null, conv }
    default:
      return { goal: 'general_companion_chat', action: 'answer_now', domain: 'general', speak: null, onlineKind: null, conv }
  }
}

// Re-exported so callers can probe the same signals the brain uses.
export { isContinuation, isWhyChallenge, isOnlineChallenge, isFrustration, onlineKindOf }
