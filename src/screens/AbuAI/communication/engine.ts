/*
 * Communication engine — ONE coherent owner for the CALL + WHATSAPP slice.
 * ══════════════════════════════════════════════════════════════════════════
 * This is the single place that (per the behavioral constitution):
 *   • owns the ACTIVE GOAL across follow-ups/corrections (Laws 1,3,4),
 *   • keeps the OUTER action separate from INNER payload (Law 2),
 *   • is transport-agnostic: text / Web Speech / Realtime feed the SAME
 *     reduceGoal (Law 5),
 *   • speaks ACTION TRUTH via one response policy + an anti-contradiction gate
 *     (Laws 6,7,9),
 *   • emits a typed DECISION RECEIPT every turn (Law 10).
 *
 * It adds NO new classifier: structured meaning comes from the existing
 * deterministic parser (understandWhatsAppCommand / detectWhatsAppTurn /
 * applyFollowUp / isFollowUpCorrection). It is a pure reducer + pure policy —
 * no React, no store, no LLM prose deciding truth. Fully unit-testable.
 */

import {
  detectWhatsAppTurn,
  applyFollowUp,
  isFollowUpCorrection,
  matchTargetName,
  type WhatsAppComposeCommand,
  type ComposeSource,
} from '../whatsappCompose'

// ─── Transport-agnostic turn (Law 5) ───────────────────────────────────────
export type TurnSource = ComposeSource | 'realtime'
export interface Turn { text: string; source: TurnSource }

// ─── Action truth status (section 7) ───────────────────────────────────────
export type ActionStatus =
  | 'REQUESTED'
  | 'NEEDS_CLARIFICATION'
  | 'RESOLVED'
  | 'PREPARED'
  | 'HANDOFF_AVAILABLE'
  | 'HANDOFF_INVOKED'
  | 'EXTERNAL_COMPLETION_NOT_OBSERVABLE'
  | 'FAILED'
  | 'CANCELLED'

export type CommMode = 'message' | 'call'
export type TurnKind =
  | 'ACTION_START' | 'ACTION_CONTINUE' | 'CORRECTION' | 'RECIPIENT_CHANGE'
  | 'CANCEL' | 'SWITCH' | 'QUESTION' | 'OTHER'
export type Capability = 'communication' | 'calendar' | 'none'

// ─── The active goal (single stateful owner; Law 1) ────────────────────────
export interface ActiveGoal {
  capability: 'communication'
  mode: CommMode
  /** Structured command for a message (recipient/intent/style/plan). null for a call. */
  command: WhatsAppComposeCommand | null
  recipientHebrew: string | null
  recipientToken: string | null
}

export interface GoalResult {
  turnKind: TurnKind
  /** The goal AFTER this turn (null = no active communication goal). */
  goal: ActiveGoal | null
  capability: Capability
  changed: 'payload' | 'recipient' | 'style' | 'correction' | 'none'
  decisionReason: string
}

// Explicit cancellation / abandonment of the communication goal (Law 1).
const CANCEL_RE = /(?:^|\s)(?:עזב[יו]?|תעזב[יי]?|עזוב|לא\s+משנה|תשכח[יי]?|שכח[יי]?|בטל[יי]?|תבטל[יי]?|נשכח\s+מזה|forget\s+it|cancel|never\s*mind|olvid\w*|deja\w*)(?:\s|[,.!]|$)/i
// A calendar query the user switches TO (only consulted on an explicit cancel).
const CALENDAR_QUERY_RE = /(?:מה\s+(?:יש\s+לי|יש)|מה\s+ב?יומן|מה\s+קורה|מה\s+התוכנית|איזה\s+פגישות|what'?s\s+on)/i
// A meta-question about the action (answered truthfully; goal is retained).
// Anchored: LEADS with a question word OR ends with "?" — so "...לא מסוגלת?"
// is a question, while "לא פגישה" / "לא, למור" remain corrections.
const QUESTION_RE = /^\s*(?:מה|למה|איך|מתי|האם|כמה|why|what|how|when)\b|[?？]\s*$/i
// A "לא <calendar-word>" retraction: correct a calendar mishearing WITHOUT
// injecting the word into the message payload (Law 3).
const NOT_CALENDAR_RE = /^\s*לא[,\s]+(?:פגיש[הות]+|תור|יומן|אירוע|זה)(?:\s|$|[,.!?])/u

/**
 * THE single active-goal arbiter. Pure. Given the current goal and a turn,
 * decide the next goal + what changed. Corrections/cancellation are handled
 * BEFORE any fresh classification (Law 3); an in-flight goal owns ordinary
 * follow-ups (Law 1); a keyword in the payload never steals it (Law 2).
 */
export function reduceGoal(active: ActiveGoal | null, turn: Turn): GoalResult {
  const t = (turn.text ?? '').trim()
  if (!t) return { turnKind: 'OTHER', goal: active, capability: active ? 'communication' : 'none', changed: 'none', decisionReason: 'empty' }

  // (1) Explicit cancel / switch — only meaningful while a goal is active. This
  // is the ONLY way a keyword releases ownership (Law 1).
  if (active && CANCEL_RE.test(t)) {
    if (CALENDAR_QUERY_RE.test(t)) {
      return { turnKind: 'SWITCH', goal: null, capability: 'calendar', changed: 'none', decisionReason: 'explicit cancel + calendar query → switch' }
    }
    return { turnKind: 'CANCEL', goal: null, capability: 'none', changed: 'none', decisionReason: 'explicit cancel' }
  }

  // (2) Active goal owns the turn.
  if (active) {
    // (2a) A brand-new explicit command (leads with a verb + names someone) is a
    // legitimate new action — e.g. switching recipient explicitly. It updates
    // the goal; it does not create a second owner.
    const fresh = detectWhatsAppTurn(t, { source: srcForParser(turn.source) })
    if (fresh && (fresh.targetHebrew || fresh.targetName)) {
      return startFrom(fresh, 'new explicit command while active')
    }

    // (2b) A meta-question about the action — answer truthfully, keep the goal.
    // Checked BEFORE correction so "למה... לא מסוגלת?" is not mis-read as a
    // correction just because it contains "לא".
    if (QUESTION_RE.test(t)) {
      return { turnKind: 'QUESTION', goal: active, capability: 'communication', changed: 'none', decisionReason: 'meta-question; goal retained' }
    }

    // (2c) Correction (Law 3): "לא פגישה" / "לא, למור" / time / style.
    if (isFollowUpCorrection(t)) {
      // A "לא <calendar-word>" retraction corrects a mishearing WITHOUT changing
      // the payload — never inject the calendar word into the message.
      if (NOT_CALENDAR_RE.test(t)) {
        return { turnKind: 'CORRECTION', goal: active, capability: 'communication', changed: 'correction', decisionReason: 'not-calendar retraction (payload unchanged)' }
      }
      if (active.mode === 'call') {
        const nt = matchTargetName(t)
        if (nt) return { turnKind: 'RECIPIENT_CHANGE', goal: { ...active, recipientHebrew: nt.hebrew, recipientToken: nt.token }, capability: 'communication', changed: 'recipient', decisionReason: 'call recipient change' }
        return { turnKind: 'CORRECTION', goal: active, capability: 'communication', changed: 'correction', decisionReason: 'call correction (goal retained)' }
      }
      const prev = active.command!
      const next = applyFollowUp(prev, t)
      const changed: GoalResult['changed'] =
        prev.targetHebrew !== next.targetHebrew ? 'recipient'
        : prev.style !== next.style ? 'style'
        : prev.intent !== next.intent ? 'payload' : 'correction'
      return {
        turnKind: changed === 'recipient' ? 'RECIPIENT_CHANGE' : 'CORRECTION',
        goal: { ...active, command: next, recipientHebrew: next.targetHebrew ?? active.recipientHebrew, recipientToken: next.targetName ?? active.recipientToken },
        capability: 'communication', changed, decisionReason: 'correction before classification',
      }
    }

    // (2d) Ordinary follow-up content ("עם יין", "היום בערב") folds into payload.
    if (active.mode === 'message' && active.command) {
      const next = applyFollowUp(active.command, t)
      const changed = next.intent !== active.command.intent ? 'payload' : 'none'
      return { turnKind: 'ACTION_CONTINUE', goal: { ...active, command: next }, capability: 'communication', changed, decisionReason: 'ordinary follow-up folded into payload' }
    }
    // Call goal: a non-command reassertion keeps the call goal + recipient.
    return { turnKind: 'ACTION_CONTINUE', goal: active, capability: 'communication', changed: 'none', decisionReason: 'call goal retained' }
  }

  // (3) No active goal — start one only if this turn IS a communication command.
  const start = detectWhatsAppTurn(t, { source: srcForParser(turn.source) })
  if (start) return startFrom(start, 'action start')
  return { turnKind: 'OTHER', goal: null, capability: 'none', changed: 'none', decisionReason: 'not a communication turn' }
}

function startFrom(turn: NonNullable<ReturnType<typeof detectWhatsAppTurn>>, reason: string): GoalResult {
  const goal: ActiveGoal = {
    capability: 'communication',
    mode: turn.kind === 'call' ? 'call' : 'message',
    command: turn.command,
    recipientHebrew: turn.targetHebrew,
    recipientToken: turn.targetName,
  }
  return { turnKind: 'ACTION_START', goal, capability: 'communication', changed: 'none', decisionReason: reason }
}

/** Realtime shares the text decision path; the parser only knows voice/text. */
function srcForParser(s: TurnSource): ComposeSource { return s === 'realtime' ? 'voice' : s }

// ─── Response truth (Laws 6,7,9; section 7) ────────────────────────────────
export type ResponseClass =
  | 'call_available' | 'call_invoked' | 'message_available'
  | 'needs_recipient' | 'no_number' | 'cancelled' | 'switched' | 'meta_explain'

export interface ResponseInput {
  mode: CommMode
  status: ActionStatus
  recipientName: string | null
  hasHandoff: boolean
}
export interface RenderedResponse { text: string; responseClass: ResponseClass; allowedClaims: string[]; forbiddenClaims: string[] }

const FORBIDDEN_ALWAYS = ['התקשרתי', 'שלחתי', 'ההודעה נשלחה', 'השיחה בוצעה', 'אני לא יכולה להתקשר', 'אני לא יכולה לשלוח']

/** ONE deterministic action-language policy. Truth is fixed here BEFORE any
 *  stylistic generation. Every string agrees with the action status. */
export function renderResponse(input: ResponseInput): RenderedResponse {
  const who = input.recipientName ? ` ל${input.recipientName}` : ''
  const withCall = input.recipientName ? ` עם ${input.recipientName}` : ''
  const base = { forbiddenClaims: FORBIDDEN_ALWAYS }
  switch (input.status) {
    case 'NEEDS_CLARIFICATION':
      return { text: input.mode === 'call' ? 'למי להתקשר?' : 'למי לשלוח הודעה?', responseClass: 'needs_recipient', allowedClaims: ['asks recipient'], ...base }
    case 'FAILED':
      return { text: `אין מספר שמור${who}. אפשר להוסיף מספר בהגדרות ← ניהול אנשי קשר.`, responseClass: 'no_number', allowedClaims: ['reports missing number', 'preserves draft'], ...base }
    case 'CANCELLED':
      return { text: 'ביטלתי.', responseClass: 'cancelled', allowedClaims: ['confirms cancel'], ...base }
    case 'HANDOFF_INVOKED':
      return { text: `החייגן${who} נפתח. האייפון יבקש ממך לאשר את השיחה.`, responseClass: 'call_invoked', allowedClaims: ['dialer opened', 'iOS confirms'], ...base }
    case 'HANDOFF_AVAILABLE':
    case 'PREPARED':
    case 'RESOLVED':
    default:
      if (input.mode === 'call') {
        return { text: `מכינה שיחה${withCall}. לחצי על "התקשרי" כדי לפתוח את החייגן.`, responseClass: 'call_available', allowedClaims: ['preparing call', 'button opens dialer'], ...base }
      }
      return { text: `ההודעה${who} מוכנה. לחצי כדי לפתוח אותה ב־WhatsApp. היא לא תישלח עד שתלחצי Send.`, responseClass: 'message_available', allowedClaims: ['message ready', 'opens WhatsApp', 'not sent until Send'], ...base }
  }
}

// ─── Anti-contradiction gate (section 7) ───────────────────────────────────
export interface Contradiction { ok: boolean; violations: string[] }

/**
 * Reject any response that claims more than the status proves, denies a live
 * handoff, mentions a different capability, or implies auto-send/dial. Run
 * BEFORE rendering; an invalid text is replaced by the truthful renderResponse.
 */
export function validateResponse(text: string, input: ResponseInput): Contradiction {
  const v: string[] = []
  const s = text ?? ''
  if (/התקשרתי|השיחה\s+בוצעה/.test(s)) v.push('claims a completed call without evidence')
  if (/שלחתי|ההודעה\s+נשלחה|נשלח[ה]?\b/.test(s)) v.push('claims a sent message (no auto-send)')
  if (input.hasHandoff && /לא\s+יכול[הת]?\s+(?:להתקשר|לשלוח|לפתוח)/.test(s)) v.push('denies a handoff that exists')
  if (/\bפגיש[הות]|ביומן|ביומ[ןנ]|תור\b|קבעתי/.test(s)) v.push('mentions calendar during a communication action')
  if (input.mode === 'message' && /שולחת\s+עכשיו|נשלחת\s+כעת/.test(s)) v.push('implies auto-send')
  if (input.mode === 'call' && /מחייגת\s+עכשיו|החיוג\s+בוצע/.test(s)) v.push('implies auto-dial')
  return { ok: v.length === 0, violations: v }
}

// ─── Decision receipt (Law 10; section 13) — privacy-safe ──────────────────
export interface DecisionReceipt {
  buildId: string
  source: TurnSource
  turnKind: TurnKind
  outerAction: 'communication.compose' | 'communication.call' | 'calendar' | 'none'
  activeGoal: Capability
  capability: Capability
  recipientId: string | null      // token/id or 'redacted' — never a number
  recipientConfidence: number | null
  actionStatus: ActionStatus
  handoff: 'whatsapp' | 'phone' | 'none'
  responseClass: ResponseClass | 'n/a'
  decisionReason: string
  fallbackUsed: string | null
  errorClass: string | null
  allowedClaims: string[]
  forbiddenClaims: string[]
}

export interface DecideContext {
  buildId: string
  /** true when the resolved recipient has a usable number for the mode. */
  recipientCanHandoff: boolean
  recipientConfidence?: number | null
  fallbackUsed?: string | null
}

export interface Decision {
  result: GoalResult
  status: ActionStatus
  response: RenderedResponse
  receipt: DecisionReceipt
}

/**
 * The single turn entry point: parse+arbitrate (reduceGoal) → action status →
 * response truth (validated) → receipt. One owner, one response, one receipt.
 */
export function decideCommunicationTurn(active: ActiveGoal | null, turn: Turn, ctx: DecideContext): Decision {
  const result = reduceGoal(active, turn)
  const goal = result.goal
  const mode: CommMode = goal?.mode ?? (active?.mode ?? 'message')
  const recipientName = goal?.recipientHebrew ?? goal?.recipientToken ?? null

  let status: ActionStatus
  if (result.turnKind === 'CANCEL') status = 'CANCELLED'
  else if (result.turnKind === 'SWITCH' || result.capability !== 'communication') status = 'CANCELLED'
  else if (!recipientName) status = 'NEEDS_CLARIFICATION'
  else if (!ctx.recipientCanHandoff) status = 'FAILED'
  else status = 'HANDOFF_AVAILABLE'

  const hasHandoff: boolean = status === 'HANDOFF_AVAILABLE'
  const response = renderResponse({ mode, status, recipientName, hasHandoff })
  // Self-check: our own policy must never contradict itself.
  const gate = validateResponse(response.text, { mode, status, recipientName, hasHandoff })
  const safeResponse = gate.ok ? response : renderResponse({ mode, status, recipientName, hasHandoff })

  const receipt: DecisionReceipt = {
    buildId: ctx.buildId,
    source: turn.source,
    turnKind: result.turnKind,
    outerAction: result.capability === 'communication' ? (mode === 'call' ? 'communication.call' : 'communication.compose') : (result.capability === 'calendar' ? 'calendar' : 'none'),
    activeGoal: goal ? 'communication' : result.capability,
    capability: result.capability,
    recipientId: goal?.recipientToken ?? (recipientName ? 'redacted' : null),
    recipientConfidence: ctx.recipientConfidence ?? null,
    actionStatus: status,
    handoff: status === 'FAILED' || status === 'CANCELLED' || status === 'NEEDS_CLARIFICATION' ? 'none' : (mode === 'call' ? 'phone' : 'whatsapp'),
    responseClass: result.capability === 'communication' ? safeResponse.responseClass : 'n/a',
    decisionReason: result.decisionReason,
    fallbackUsed: ctx.fallbackUsed ?? null,
    errorClass: null,
    allowedClaims: safeResponse.allowedClaims,
    forbiddenClaims: safeResponse.forbiddenClaims,
  }
  return { result, status, response: safeResponse, receipt }
}
