/*
 * Intent Router v2
 * ════════════════
 * The ONE canonical, deterministic intent decision for every AbuAI turn. It scores the
 * required intent categories, applies priority rules (pending confirmation wins; cancel
 * only the right pending; calendar-search ≠ create; a family NAME is not a calendar
 * booking; online-live ≠ static; help is answered; unknown → natural clarification),
 * decides clarification, and returns { intent, confidence, alternatives, reason, trace }.
 *
 * The runtime's own classifier (cognitiveRuntime.classifyIntent) is the Router's internal
 * scorer (derived-only) — acceptance proves the runtime's routing AGREES with routeTurn,
 * so there is one router and no legacy fallback can diverge. Pure + no module-global.
 */
import { classifyOnlineNeed } from './onlineRuntimeV2'

export type RouterIntent =
  | 'calendar_create' | 'calendar_read' | 'calendar_search' | 'calendar_update' | 'calendar_delete'
  | 'reminder' | 'recurring' | 'family_relation' | 'family_info' | 'online_live' | 'online_static'
  | 'knowledge_static' | 'conversation' | 'continuation' | 'replay' | 'correction' | 'frustration'
  | 'audio_complaint' | 'greeting' | 'help' | 'unknown'

export interface RouterContext { pendingConfirmation?: boolean; pendingAction?: boolean; hasLastAnswer?: boolean }
export interface RouterDecision {
  intent: RouterIntent
  confidence: number
  alternatives: Array<{ intent: RouterIntent; score: number }>
  reason: string
  needsClarification: boolean
  trace: { input: string; scores: Array<[RouterIntent, number]>; rule: string; context: RouterContext }
}

// ── priority rules (checked in order, before scoring) ──
const AFFIRM = /^(?:כן|נכון|בסדר|אישרתי|אוקיי|אוקי|יאללה|סבבה)(?:[,.!\s]|$)/u
const CANCEL = /(?:^|\s)(?:לא,?\s+(?:עזבי|בטלי|תבטלי)|בטלי|תבטלי|עזבי\s+את\s+זה|לא\s+צריך)/u
const CONTINUE = /(?:תמשיכי|תשלימי|ממשיכ|עוד\s+על\s+זה)/u
const REPLAY = /(?:לא\s+שמעתי|תחזרי|שוב\s+בבקשה|מה\s+אמרת)/u
const AUDIO = /(?:לא\s+שומעת|תדברי\s+חזק|חלש\s+מדי|רועש|לא\s+ברור\s+לי\s+קול)/u
const FRUSTR = /(?:את\s+לא\s+מבינה|נמאס|די\s+כבר|למה\s+לא\s+קבעת|זה\s+לא\s+עובד)/u

// ── category cues (scored) ──
const CUES: Array<[RouterIntent, RegExp, number]> = [
  ['help', /(?:איך\s+אני\s+.*הגדרות|איך\s+(?:מגבים|מגבה|לגבות)|איך\s+(?:אני\s+)?משתמש|איך\s+עובד\s+ה|מה\s+זה\s+הכפתור)/u, 5],
  ['greeting', /^(?:בוקר\s+טוב|ערב\s+טוב|שלום|היי|צהריים\s+טובים|לילה\s+טוב)(?:[,.!\s]|$)/u, 5],
  ['reminder', /(?:תזכירי\s+לי|תזכורת)/u, 4],
  ['recurring', /(?:כל\s+(?:יום|שבוע|חודש|בוקר)|מדי\s+(?:יום|שבוע))/u, 4],
  ['calendar_delete', /(?:תבטלי|בטלי|תמחקי|מחקי)\s+(?:את\s+)?(?:הפגישה|התור|האירוע)/u, 5],
  ['calendar_update', /(?:תעדכני|עדכני|תשני|שני)\s+(?:את\s+)?(?:הפגישה|התור|השעה)/u, 5],
  ['calendar_search', /(?:מתי\s+(?:יש\s+לי|הפגישה)|באיזה\s+יום\s+.*(?:פגישה|שלי)|שואל[ת]?\s+אותך\s+.*(?:פגישה|יום))/u, 5],
  ['calendar_create', /(?:תקבעי|קבעי\s+לי|קבע\s+לי|תזמני|רשמי\s+לי|יש\s+לי\s+פגישה|נקבע)/u, 4],
  ['calendar_read', /(?:מה\s+יש\s+לי\s+(?:היום|מחר|השבוע)|מה\s+ביומן|מה\s+התוכניות)/u, 4],
  ['family_relation', /(?:מה\s+\S+\s+עבור\s+\S+|מה\s+הקשר\s+בין|איך\s+\S+\s+קשור)/u, 5],
  ['family_info', /(?:מי\s+(?:זה|זאת|זו)\s+\S+|בת\s+כמה\s+\S+|מתי\s+נולד)/u, 4],
  ['knowledge_static', /(?:ספרי\s+לי\s+על|מה\s+זה\s+|מי\s+היה\s+|מה\s+ההיסטוריה)/u, 3],
  ['conversation', /(?:מה\s+שלומך|מה\s+נשמע|איך\s+את|תודה\s+רבה)/u, 2],
]

export function scoreIntents(input: string, ctx: RouterContext = {}): Array<[RouterIntent, number]> {
  const t = input.trim()
  const scores = new Map<RouterIntent, number>()
  for (const [intent, re, w] of CUES) if (re.test(t)) scores.set(intent, Math.max(scores.get(intent) ?? 0, w))
  // online: live vs static (never let static/LLM answer a live query)
  const need = classifyOnlineNeed(t)
  if (need.isLive) scores.set('online_live', 6)
  else if (need.category === 'time' || need.category === 'date') scores.set('online_static', 6)
  // a family NAME inside a calendar sentence must NOT flip to family (rule 5)
  if ((scores.get('calendar_create') || scores.get('calendar_search') || scores.get('calendar_read')) && scores.has('family_info')) scores.delete('family_info')
  return [...scores.entries()].sort((a, b) => b[1] - a[1])
}

export function applyPriorityRules(scores: Array<[RouterIntent, number]>, input: string, ctx: RouterContext): { intent: RouterIntent; rule: string } {
  const t = input.trim()
  if (ctx.pendingConfirmation && AFFIRM.test(t)) return { intent: 'correction', rule: 'pending_confirm_yes' } // resolved as confirmation downstream; router marks the pending win
  if (ctx.pendingAction && CANCEL.test(t)) return { intent: 'correction', rule: 'explicit_cancel' }
  if (REPLAY.test(t)) return { intent: 'replay', rule: 'replay' }
  if (CONTINUE.test(t)) return { intent: 'continuation', rule: 'continuation' }
  if (AUDIO.test(t)) return { intent: 'audio_complaint', rule: 'audio' }
  if (FRUSTR.test(t)) return { intent: 'frustration', rule: 'frustration' }
  if (scores.length) return { intent: scores[0]![0], rule: 'top_score' }
  return { intent: 'unknown', rule: 'no_match' }
}

/** Confirmation is the true category when a pending confirmation is answered "כן". */
export function routeTurn(input: string, ctx: RouterContext = {}): RouterDecision {
  const scores = scoreIntents(input, ctx)
  const pr = applyPriorityRules(scores, input, ctx)
  let intent = pr.intent
  let reason = pr.rule
  if (pr.rule === 'pending_confirm_yes') { intent = 'correction'; reason = 'pending confirmation wins on כן' }
  const total = scores.reduce((s, [, v]) => s + v, 0) || 1
  const top = scores[0]?.[1] ?? (pr.rule === 'no_match' ? 0 : 4)
  const confidence = pr.rule === 'top_score' ? Math.min(1, top / total) : pr.rule === 'no_match' ? 0.2 : 0.95
  const needsClarification = intent === 'unknown'
  const alternatives = scores.slice(1, 4).map(([i, s]) => ({ intent: i, score: s }))
  return { intent, confidence, alternatives, reason, needsClarification, trace: { input, scores, rule: pr.rule, context: ctx } }
}

export function buildRouterContext(memory?: { getPendingAction(): { phase: string } | null }, _semantic?: unknown, _runtime?: unknown): RouterContext {
  const pending = memory?.getPendingAction?.() ?? null
  return { pendingConfirmation: pending?.phase === 'confirming', pendingAction: !!pending, hasLastAnswer: false }
}

export function decideClarification(scores: Array<[RouterIntent, number]>, _ctx: RouterContext): boolean { return scores.length === 0 }
export function explainDecision(d: RouterDecision): string { return `${d.intent} (${d.confidence.toFixed(2)}) — ${d.reason}` }
export function exportRouterTrace(d: RouterDecision): RouterDecision['trace'] { return d.trace }
