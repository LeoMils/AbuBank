/*
 * AI Understanding Orchestrator
 * ═════════════════════════════
 * ONE front door for every user input. Replaces the scattered per-route checks
 * with a single pipeline that every message flows through:
 *
 *   input → normalize → semantic understanding → deterministic validation
 *         → action decision → memory → response shaping
 *
 * It does not re-implement the proven layers — it COMPOSES them (STT recovery,
 * meeting intelligence, the router, online intent, the companion brain, the
 * conversation memory, the personality guard) and returns ONE structured
 * decision. The caller (index.tsx) executes the decided action; nothing routes
 * without first passing through here. Pure + deterministic (the optional LLM
 * semantic pass is layered on top in the caller for creates).
 */
import {
  cleanTranscript, isCreateIntent, isDeleteIntent, isModifyIntent, isSearchIntent,
} from './calendarCreate'
import { recoverHebrewStt, type SttCorrection } from './sttSemanticRecovery'
import { routePersonalQuery, type RouteResult } from './router'
import { understandMeeting, type MeetingObject } from './meetingIntelligence'
import { isOnlineCurrentInfoQuery, getOnlineQueryKind, shouldBlockOnlineForPersonal, type OnlineQueryKind } from './onlineIntent'
import { planCompanionTurn, deriveStateFromMessages, type CompanionPlan } from './companionPlanner'
import { deriveConversationMemory, type ConversationMemory } from './conversationMemory'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { enforceCompanion } from './companionComposer'

export type OrchestratorIntent =
  | 'calendar_create' | 'calendar_read' | 'calendar_delete' | 'calendar_modify' | 'calendar_search'
  | 'family' | 'contact_action' | 'online' | 'recall' | 'emotional' | 'general'

export interface OrchestratorContext {
  messages: Array<{ role: string; content: string }>
}

export interface OrchestratorDecision {
  rawInput: string
  /** input after pronoun/follow-up resolution + STT recovery. */
  normalizedInput: string
  intent: OrchestratorIntent
  // ── understanding payloads (only the relevant one is populated) ──
  meeting?: MeetingObject              // calendar_create
  route?: RouteResult                  // calendar_read / family / contact_action
  online?: { kind: OnlineQueryKind | null }
  corrections: SttCorrection[]
  // ── validation ──
  needsClarification: boolean
  clarificationQuestion: string | null
  // ── memory + brain ──
  memory: ConversationMemory
  companionPlan: CompanionPlan
  /** Apply the personality guard to any outgoing text for this turn. */
  shape: (text: string) => string
}

const RECALL_RE = /מה אמרתי|על מי דיברנו|מה קבענו|למי אמרתי|מה דיברנו|what did I say|de qu[eé] hablamos/i
// Clear feeling words → an emotional/companionship turn (warmth, not a data dump).
const EMOTIONAL_RE = /עצוב[הא]?|קשה לי|לא טוב לי|בודד[הא]?|מתגעגע|געגוע|חסר לי|לבד|אף אחד לא|יום קשה|מדוכא|דואג[תה]?|פוחד[תה]?|בוכה/i

/** Stage 1 — normalize: resolve pronouns + cross-turn follow-ups, then repair STT. */
export function normalizeInput(rawInput: string, messages: OrchestratorContext['messages']): { normalized: string; corrections: SttCorrection[] } {
  const pron = resolvePronouns(rawInput, messages)
  const follow = resolveFollowUp(pron.resolved, messages as never)
  const resolved = follow.resolved
  const rec = recoverHebrewStt(cleanTranscript(resolved))
  return { normalized: rec.text, corrections: rec.corrections }
}

/** Stage 2 — classify the intent (single priority ladder; nothing bypasses it). */
function classify(text: string, route: RouteResult, plan: CompanionPlan, isDirectQuestion: boolean): OrchestratorIntent {
  // Online current-info wins only when it is NOT a personal/calendar/family ask.
  if (isOnlineCurrentInfoQuery(text) && !shouldBlockOnlineForPersonal(text)) return 'online'
  if (route.type === 'contact_action') return 'contact_action'
  if (RECALL_RE.test(text)) return 'recall'
  if (isCreateIntent(text)) return 'calendar_create'
  if (isDeleteIntent(text)) return 'calendar_delete'
  if (isModifyIntent(text)) return 'calendar_modify'
  if (isSearchIntent(text)) return 'calendar_search'
  if (route.type.startsWith('calendar_')) return 'calendar_read'
  if (route.type.startsWith('family_') || route.type === 'birthday_lookup' || route.type === 'memorial_lookup') return 'family'
  // An emotional/companionship turn that is not a direct factual question — either
  // the companion brain flagged suppression, OR a clear feeling word is present.
  if (!isDirectQuestion && (plan.suppressLookups || EMOTIONAL_RE.test(text))) return 'emotional'
  return 'general'
}

/**
 * Orchestrate one turn. Every input passes through here before any action.
 */
export function orchestrate(rawInput: string, ctx: OrchestratorContext): OrchestratorDecision {
  const messages = ctx.messages ?? []

  // 1. normalize
  const { normalized, corrections } = normalizeInput(rawInput, messages)

  // 2-3. understand + validate
  const route = routePersonalQuery(normalized)
  const companionPlan = planCompanionTurn(normalized, deriveStateFromMessages(messages))
  const isDirectQuestion = /^מי |^מתי |^איפה |^כמה |^מה זה |^מה זאת |[?؟]$/.test(normalized.trim())
  const intent = classify(normalized, route, companionPlan, isDirectQuestion)

  let meeting: MeetingObject | undefined
  let needsClarification = false
  let clarificationQuestion: string | null = null
  if (intent === 'calendar_create') {
    meeting = understandMeeting(normalized)
    needsClarification = meeting.needsClarification
    clarificationQuestion = meeting.clarificationQuestion
  }

  const online = intent === 'online' ? { kind: getOnlineQueryKind(normalized) } : undefined

  // 5. memory
  const memory = deriveConversationMemory(messages)

  // 6. response shaping (personality guard bound to this turn's plan)
  const shape = (text: string) => enforceCompanion(text, companionPlan)

  const includeRoute = intent === 'calendar_read' || intent === 'family' || intent === 'contact_action'
  return {
    rawInput,
    normalizedInput: normalized,
    intent,
    ...(meeting ? { meeting } : {}),
    ...(includeRoute ? { route } : {}),
    ...(online ? { online } : {}),
    corrections,
    needsClarification,
    clarificationQuestion,
    memory,
    companionPlan,
    shape,
  }
}
