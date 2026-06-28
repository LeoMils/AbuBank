/*
 * Conversation Operating System
 * ═════════════════════════════
 * A dialogue brain ABOVE the orchestrator. The orchestrator classifies a single
 * input; the OS remembers the *conversation* — what was being answered, where
 * speech stopped, why an online lookup failed — so AbuAI can continue, explain,
 * and repair instead of forgetting and looping.
 *
 * Modules (all pure, state-in/state-out):
 *   1. ConversationStateMachine   — phase of the dialogue
 *   2. AnswerContinuationCache    — last substantial answer + spoken chunks
 *   3. OnlineSessionMemory        — last online query + real failure reason
 *   4. ConversationRepairEngine   — acknowledge + explain + recover on challenge
 *   5. SpokenAnswerPlanner        — chunk answers for natural speech
 *   6. Turn-taking / interruption — mark interrupted, resume at the right chunk
 *
 * The runtime calls `handleConversationTurn` FIRST; if it returns handled, speak
 * its text. Otherwise the normal flow runs and calls `recordAnswer`/`recordOnline`.
 */
import { toSpokenText } from './spokenPersona'

// ── 1. State machine ────────────────────────────────────────────────────────
export type ConvPhase =
  | 'idle'
  | 'answering'
  | 'answer_interrupted'
  | 'awaiting_confirmation'
  | 'awaiting_missing_calendar_field'
  | 'awaiting_online_followup'
  | 'awaiting_repair_explanation'
  | 'correcting_previous_answer'

// ── 2. Answer continuation cache ────────────────────────────────────────────
export interface CachedAnswer {
  question: string
  intent: string
  topic: string | null
  fullText: string
  chunks: string[]
  lastChunkIndex: number // index of the last chunk that was DELIVERED (-1 = none yet)
  interrupted: boolean
  sources: string[]
  ts: number
}

// ── 3. Online session memory ────────────────────────────────────────────────
export type OnlineFailReason =
  | 'provider_failed'
  | 'timeout'
  | 'interrupted'
  | 'incomplete_data'
  | 'realtime_unavailable'
  | 'fallback_used'
  // sports: the source returned a fixture/schedule but no final score yet
  | 'schedule_only'
  | 'no_result'

export interface OnlineSession {
  query: string
  topic: string | null
  source: string | null
  ok: boolean
  reason: OnlineFailReason | null
  summary: string | null
  ts: number
}

export interface ConvState {
  phase: ConvPhase
  answer: CachedAnswer | null
  online: OnlineSession | null
  repairCount: number
}

export const IDLE_CONV: ConvState = { phase: 'idle', answer: null, online: null, repairCount: 0 }

const STALE_MS = 10 * 60 * 1000 // a cached answer older than 10 min is stale

// ── 5. Spoken answer planner ────────────────────────────────────────────────
/**
 * Split any answer into natural spoken chunks: ≤2 short sentences each, no URLs /
 * markdown / sources. A long list is delivered a couple of items at a time so the
 * user can say "תמשיכי" for the rest instead of hearing a wall of speech.
 */
export function planSpokenChunks(text: string): string[] {
  if (!text || !text.trim()) return []
  // bullets / newlines → sentence boundaries
  let t = text.replace(/\r/g, '').replace(/^[\t ]*[-*•]\s*/gmu, '').replace(/\n+/g, '. ')
  t = t.replace(/\s*\.\s*\./g, '.')
  const sentences = (t.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [t]).map(s => s.trim()).filter(s => s.length > 1)
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = toSpokenText(sentences.slice(i, i + 2).join(' '))
    if (chunk) chunks.push(chunk)
  }
  if (chunks.length === 0) { const one = toSpokenText(text); return one ? [one] : [] }
  return chunks
}

export function recordAnswer(
  state: ConvState,
  a: { question: string; intent: string; topic?: string | null; fullText: string; sources?: string[] },
): ConvState {
  const chunks = planSpokenChunks(a.fullText)
  const answer: CachedAnswer = {
    question: a.question,
    intent: a.intent,
    topic: a.topic ?? null,
    fullText: a.fullText,
    chunks,
    lastChunkIndex: 0, // the first chunk is delivered with the answer
    interrupted: false,
    sources: a.sources ?? [],
    ts: nowTs(),
  }
  return { ...state, phase: 'answering', answer }
}

/** First chunk to speak right now for a freshly recorded answer. */
export function firstChunk(state: ConvState): string | null {
  return state.answer?.chunks[0] ?? null
}

// ── 6. Turn-taking / interruption ───────────────────────────────────────────
export function markInterrupted(state: ConvState, deliveredChunkIndex?: number): ConvState {
  if (!state.answer) return state
  const lastChunkIndex = deliveredChunkIndex ?? state.answer.lastChunkIndex
  return {
    ...state,
    phase: 'answer_interrupted',
    answer: { ...state.answer, interrupted: true, lastChunkIndex },
  }
}

const CONTINUE_RE =
  /(?:^|\s)(?:תמשיכי|תמשיך|ממשיכים?|המשיכי|המשכת|לא\s+סיימת|ספרי\s+(?:לי\s+)?(?:את\s+)?ה?המשך|תחזרי\s+לזה|חזרי\s+לזה|איפה\s+(?:את\s+)?הפסקת|הפסקת\s+ב|נעצרת|סיימי\s+את|מה\s+ה?המשך|מה\s+היה\s+(?:אחר\s+כך|אחרי|הלאה)|עוד|הלאה)/u

/** "תמשיכי", "איפה הפסקת", "ספרי את ההמשך", "הפסקת בבית א" … */
export function isContinuation(text: string): boolean {
  return CONTINUE_RE.test(text.trim())
}

export function hasMoreChunks(state: ConvState): boolean {
  const a = state.answer
  return !!a && !isStale(a) && a.lastChunkIndex < a.chunks.length - 1
}

/** Continue the cached answer from the next chunk. Null text → nothing to resume. */
export function continueAnswer(state: ConvState): { text: string | null; state: ConvState } {
  const a = state.answer
  if (!a || isStale(a)) return { text: null, state }
  const next = a.lastChunkIndex + 1
  if (next >= a.chunks.length) {
    // already finished — say so warmly, do not re-search
    return { text: 'זהו, סיימתי עם מה שהיה לי על זה.', state: { ...state, phase: 'idle' } }
  }
  const chunk = a.chunks[next]!
  return { text: chunk, state: { ...state, phase: 'answering', answer: { ...a, lastChunkIndex: next, interrupted: false } } }
}

export function recordOnline(state: ConvState, s: Omit<OnlineSession, 'ts'>): ConvState {
  return { ...state, online: { ...s, ts: nowTs() } }
}

// ── 4. Repair engine + failure explanation ──────────────────────────────────
const WHY_RE = /^למה(?![א-ת])|למה\s+(?:את\s+)?לא|למה\s+אין\s+לך|מה\s+אין\s+לך|למה\s+לא\s+(?:בדקת|הצלחת)|מה\s+הבעיה|מה\s+הסיבה|למה\?|מה\s+זאת\s+אומרת|למה\s+אצלך/u
const ONLINE_CLAIM_RE = /יש\s+לך\s+(?:יכולת\s+)?(?:אונליין|אינטרנט|חיבור|גישה\s+לרשת)|את\s+(?:יכולה|מחוברת)\s+(?:לבדוק|לאינטרנט)|אבל\s+יש\s+לך/u
const FRUSTRATION_RE = /אבל\s+(?:כבר\s+)?התחלת|את\s+לא\s+מבינה|כבר\s+התחלת\s+לענות|אבל\s+ענית|התחלת\s+ואז/u

export function isWhyChallenge(text: string): boolean { return WHY_RE.test(text.trim()) }
export function isOnlineChallenge(text: string): boolean { return ONLINE_CLAIM_RE.test(text.trim()) }
export function isFrustration(text: string): boolean { return FRUSTRATION_RE.test(text.trim()) }

const FAIL_EXPLANATION: Record<OnlineFailReason, string> = {
  provider_failed: 'ניסיתי לבדוק אונליין וזה נפל לי.',
  timeout: 'לקח לזה יותר מדי זמן והבדיקה נקטעה.',
  interrupted: 'הבדיקה נקטעה באמצע.',
  incomplete_data: 'המקור החזיר לי מידע חלקי.',
  realtime_unavailable: 'החיבור הקולי הישיר לא זמין כרגע, אז אני עובדת במצב רגיל.',
  fallback_used: 'עברתי למצב גיבוי כי החיבור הראשי נפל.',
  schedule_only: 'מצאתי את המשחק, אבל לא קיבלתי תוצאה סופית מהמקור.',
  no_result: 'עוד אין תוצאה סופית מהמקור.',
}

/** The real reason the last online answer failed (not a generic refusal). */
export function explainFailure(state: ConvState): string {
  const o = state.online
  if (o && !o.ok && o.reason) return FAIL_EXPLANATION[o.reason]
  if (o && o.ok) return 'בדקתי וזה הצליח — אני אחזור על מה שמצאתי.'
  return 'לא הספקתי לבדוק את זה.'
}

// Varied acknowledgments so three challenges never hear the same sentence twice.
const ACK_VARIANTS = [
  'נכון, זה יצא מבולבל.',
  'את צודקת.',
  'כן, התחלתי ונקטעתי.',
  'אני איתך, בואי נסדר את זה.',
]
const OFFER_VARIANTS = [
  'אני יכולה לנסות שוב או להמשיך ממה שכבר הבאתי.',
  'ננסה שוב?',
  'אני ממשיכה מאיפה שעצרתי.',
  'רוצה שאנסה שוב?',
]

/**
 * Repair a challenged / frustrated turn: acknowledge the contradiction, explain
 * the real reason, and offer recovery — phrased differently each time so it can
 * never loop the same sentence.
 */
export function repair(state: ConvState, _text: string): { text: string; state: ConvState } {
  const n = state.repairCount
  const ack = ACK_VARIANTS[n % ACK_VARIANTS.length]!
  const parts: string[] = [ack]

  // If an interrupted answer is cached, the best repair is to actually continue.
  if (state.answer && hasMoreChunks(state)) {
    const cont = continueAnswer(state)
    const text = `${ack} אני ממשיכה מאיפה שעצרתי. ${cont.text ?? ''}`.trim()
    return { text: toSpokenText(text), state: { ...cont.state, repairCount: n + 1 } }
  }

  // Otherwise explain the real online failure (if any) + offer a concrete retry.
  if (state.online && !state.online.ok) parts.push(explainFailure(state))
  parts.push(OFFER_VARIANTS[n % OFFER_VARIANTS.length]!)
  const text = toSpokenText(parts.join(' '))
  return { text, state: { ...state, phase: 'awaiting_repair_explanation', repairCount: n + 1 } }
}

// ── Runtime entry point ─────────────────────────────────────────────────────
export interface ConvTurn {
  handled: boolean
  action: 'continue' | 'repair' | 'finished' | 'none'
  speak: string | null
  state: ConvState
}

/**
 * The runtime calls this FIRST with the user's text. If `handled`, speak `speak`
 * and skip normal routing. Only intercepts when there is relevant cached context
 * (an answer to continue, or an online failure to explain) — so calendar
 * confirmations and fresh questions fall straight through.
 */
export function handleConversationTurn(state: ConvState, text: string): ConvTurn {
  const t = text.trim()

  // Continue a cached answer.
  if (isContinuation(t) && state.answer && !isStale(state.answer)) {
    const { text: next, state: s2 } = continueAnswer(state)
    if (next) return { handled: true, action: hasMoreChunks(s2) || s2.phase === 'idle' ? 'continue' : 'finished', speak: next, state: s2 }
  }

  // Repair a challenge/frustration — only when we have context to explain.
  const challenged = isWhyChallenge(t) || isOnlineChallenge(t) || isFrustration(t)
  if (challenged && (state.online || state.answer)) {
    const { text: r, state: s2 } = repair(state, t)
    return { handled: true, action: 'repair', speak: r, state: s2 }
  }

  return { handled: false, action: 'none', speak: null, state }
}

// ── helpers ─────────────────────────────────────────────────────────────────
function nowTs(): number { try { return Date.now() } catch { return 0 } }
function isStale(a: CachedAnswer): boolean { const now = nowTs(); return now > 0 && a.ts > 0 && now - a.ts > STALE_MS }
