/*
 * AbuAI Intelligence Acceptance — behavior-first
 * ══════════════════════════════════════════════
 * Each case is a real Leo-failure behavior: input(s) → expected behavior, a
 * FORBIDDEN answer, and the responsible layer. Driven through the single
 * ExecutiveCognitiveController. Pass = expected holds AND forbidden absent AND the
 * answer is RUNTIME_FINALIZED. This is a discriminating quality gate — not replay
 * volume. It is designed to FAIL where intelligence is weak, so fixes are real.
 */
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { saveAppointments, loadAppointments, addAppointment } from '../screens/AbuCalendar/service'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

export type Layer =
  | 'meta' | 'goal' | 'dialogue' | 'family' | 'calendar' | 'online' | 'confidence' | 'speech' | 'hebrew'

export const NOW = new Date(2026, 6, 3, 9, 0, 0)
export const OK: FullTurnTools = { llm: async () => 'תשובה כללית קצרה ונכונה על הנושא.', online: async () => ({ ok: true, answer: 'יש הקרנה בשבע וחצי בערב.' }) }
export const FAIL_ONLINE: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: false, answer: '', reason: 'provider_failed' }) }

export interface AcceptanceCase {
  id: string
  layer: Layer
  turns: string[]
  tools?: FullTurnTools
  /** seed the calendar before the case. */
  seed?: () => void
  /** expected behavior over (final display, all displays, final result). */
  expect: (final: string, all: string[], r: TurnLite) => boolean
  forbidden?: RegExp
}
interface TurnLite { intent: string; source: string; sideEffect: string | null; pendingReminder: unknown; createPhase: string }

export interface CaseResult { id: string; layer: Layer; pass: boolean; detail: string }

export async function runCase(c: AcceptanceCase): Promise<CaseResult> {
  saveAppointments([])
  c.seed?.()
  const tools = c.tools ?? OK
  let state: RuntimeState = IDLE_RUNTIME
  const all: string[] = []
  let last = { intent: '', source: '', sideEffect: null as string | null, pendingReminder: null as unknown, createPhase: 'idle' }
  let finalized = true
  for (const input of c.turns) {
    const r = await ExecutiveCognitiveController.handleTurn(state, input, { messages: [], now: NOW }, tools)
    state = r.state
    all.push(r.display)
    last = { intent: r.intent, source: r.source, sideEffect: r.sideEffect ?? null, pendingReminder: r.state.pendingReminder, createPhase: r.state.createState.phase }
    if (!isFinalized(r.trace)) finalized = false
  }
  const final = all[all.length - 1] ?? ''
  const expectOk = c.expect(final, all, last)
  const forbiddenHit = c.forbidden ? c.forbidden.test(final) : false
  return { id: c.id, layer: c.layer, pass: expectOk && !forbiddenHit && finalized, detail: `intent=${last.intent} final="${final.slice(0, 48)}"${forbiddenHit ? ' [FORBIDDEN]' : ''}${finalized ? '' : ' [UNFINALIZED]'}` }
}

export const has = (s: string, ...w: string[]) => w.some(x => s.includes(x))

export const ACCEPTANCE_CASES: AcceptanceCase[] = [
  // ── Meta Reasoner ──
  { id: 'meta-relation-not-identity', layer: 'meta', turns: ['מה לאו עבור אופיר'], expect: f => has(f, 'דוד'), forbidden: /הבן שלך|הבת שלך/ },
  { id: 'meta-search-not-create', layer: 'meta', turns: ['מתי יש לי פגישה עם מוטי'], expect: (f, _a, r) => r.intent === 'calendar_search', forbidden: /באיזה יום/ },
  { id: 'meta-correction', layer: 'meta', turns: ['מי זה לאו', 'לא, התכוונתי מה לאו עבור אופיר'], expect: f => has(f, 'דוד'), forbidden: /הבן שלך/ },
  { id: 'meta-confirmation-not-command', layer: 'meta', seed: () => {}, turns: ['תקבעי פגישה עם דני מחר בשבע בערב', 'כן'], expect: (_f, _a, r) => r.sideEffect === 'saved_appointment' },

  // ── Goal Manager ──
  { id: 'goal-repeated-yes-saves-once', layer: 'goal', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'כן', 'כן'], expect: () => loadAppointments().length === 1 },
  { id: 'goal-frustration-keeps-pending', layer: 'goal', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'את לא מבינה אותי'], expect: (_f, _a, r) => r.createPhase !== 'idle' },
  { id: 'goal-audio-keeps-pending', layer: 'goal', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'לא שמעתי'], expect: (_f, _a, r) => r.createPhase !== 'idle' && r.sideEffect === null },
  { id: 'goal-reminder-repeated-yes', layer: 'goal', turns: ['תזכירי לי מחר בשמונה בבוקר לקחת תרופות', 'כן', 'כן'], expect: (_f, all) => all.some(x => has(x, 'רשמתי', 'אזכיר')) },

  // ── Dialogue Manager ──
  { id: 'dialogue-no-which-day-loop', layer: 'dialogue', turns: ['מתי יש לי פגישה עם מוטי'], expect: () => true, forbidden: /באיזה יום/ },
  { id: 'dialogue-frustration-distinct', layer: 'dialogue', turns: ['את לא מבינה אותי', 'את לא עונה למה ששאלתי'], expect: (_f, all) => all[0] !== all[1] },
  { id: 'dialogue-answers-question', layer: 'dialogue', turns: ['איזה יום היום'], expect: f => has(f, 'יום שישי') && !/יום שישי.*יום שישי/.test(f), forbidden: /לא הבנתי|תגידי מילה אחת/ },

  // ── Family Graph Reasoner (directional, all listed names) ──
  { id: 'fam-leo-ofir', layer: 'family', turns: ['מה לאו עבור אופיר'], expect: f => has(f, 'דוד'), forbidden: /לא אנחש|לא יודעת/ },
  { id: 'fam-ofir-leo', layer: 'family', turns: ['מה אופיר עבור לאו'], expect: f => has(f, 'אחיין'), forbidden: /לא אנחש/ },
  { id: 'fam-mor-leo', layer: 'family', turns: ['מה מור עבור לאו'], expect: f => has(f, 'אח'), forbidden: /לא אנחש/ },
  { id: 'fam-ofir-anabel', layer: 'family', turns: ['מה אופיר עבור אנאבל'], expect: f => has(f, 'אבא', 'אמא', 'הורה'), forbidden: /לא אנחש/ },
  { id: 'fam-rafi-leo', layer: 'family', turns: ['מה רפי עבור לאו'], expect: f => has(f, 'גיס'), forbidden: /לא אנחש/ },
  { id: 'fam-yarden-anabel', layer: 'family', turns: ['מה ירדן עבור אנאבל'], expect: f => has(f, 'דוד'), forbidden: /לא אנחש/ },
  { id: 'fam-ilay-anabel', layer: 'family', turns: ['מה עילי עבור אנאבל'], expect: f => has(f, 'דוד'), forbidden: /לא אנחש/ },
  { id: 'fam-ayalon-anabel', layer: 'family', turns: ['מה איילון עבור אנאבל'], expect: f => has(f, 'דוד'), forbidden: /לא אנחש/ },
  { id: 'fam-noam-leo', layer: 'family', turns: ['מה נועם עבור לאו'], expect: f => has(f, 'בן', 'בת', 'הבן', 'הבת'), forbidden: /לא אנחש/ },
  { id: 'fam-ari-anabel', layer: 'family', turns: ['מה ארי עבור אנאבל'], expect: f => has(f, 'אח'), forbidden: /לא אנחש/ },
  { id: 'fam-unknown-no-guess', layer: 'family', turns: ['מה נפוליאון עבור לאו'], expect: f => has(f, 'לא אנחש', 'לא בטוחה', 'לא יודעת', 'לא מכירה') },

  // ── Calendar Reasoner ──
  { id: 'cal-search-all', layer: 'calendar', seed: () => { addAppointment({ title: 'פגישה עם מוטי', date: '2026-07-20', time: '10:00', emoji: '📅' }) }, turns: ['מתי יש לי פגישה עם מוטי'], expect: f => has(f, 'מוטי'), forbidden: /באיזה יום/ },
  { id: 'cal-create-verify', layer: 'calendar', turns: ['תקבעי פגישה עם רוזלינדה מחר בשבע בערב אצלה בבית', 'כן כן'], expect: () => loadAppointments().length === 1 },
  { id: 'cal-empty-no-invent', layer: 'calendar', turns: ['מה יש לי מחר'], expect: f => has(f, 'אין', 'שקט'), forbidden: /רופא|תור|פגישה עם|\d{1,2}:\d{2}/ },
  { id: 'cal-no-contradiction', layer: 'calendar', turns: ['מה יש לי היום'], expect: f => has(f, 'אין', 'שקט'), forbidden: /שתי|שתיים/ },

  // ── Online Planner ──
  { id: 'online-movies', layer: 'online', turns: ['מה הסרטים בכפר סבא'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'online-bus', layer: 'online', turns: ['מתי האוטובוס מרעננה לתל אביב'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'online-sports', layer: 'online', turns: ['מי ניצח במונדיאל אתמול'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'online-provider-fail-honest', layer: 'online', tools: FAIL_ONLINE, turns: ['מי ניצח במונדיאל אתמול'], expect: f => has(f, 'נפל', 'לא הצלחתי', 'ננסה'), forbidden: /ניצח[הו]/ },
  { id: 'online-date-not-online', layer: 'online', turns: ['מה התאריך היום'], expect: (_f, _a, r) => r.source !== 'online' && r.intent === 'date_query' },

  // ── Confidence / Contradiction ──
  { id: 'conf-no-cant-check', layer: 'confidence', turns: ['מה יש לי היום'], expect: () => true, forbidden: /לא מצליחה לבדוק|אין לי גישה ליומן/ },
  { id: 'conf-weak-relation-blocked', layer: 'confidence', turns: ['מה זה בלבלבל עבור לאו'], expect: f => has(f, 'לא אנחש', 'לא בטוחה', 'לא יודעת', 'לא מכירה') },

  // ── Response + Speech Planner ──
  { id: 'speech-no-robotic', layer: 'speech', turns: ['מה יש לי מחר'], expect: () => true, forbidden: /אני כאן\?|אני תבדוק|תקבילי|אחורה צהריים/ },
]

export async function runIntelligenceAcceptance(extra: AcceptanceCase[] = []): Promise<CaseResult[]> {
  const rows: CaseResult[] = []
  for (const c of [...ACCEPTANCE_CASES, ...extra]) rows.push(await runCase(c))

  // Speech resume (delivery engine — display vs speech separation + exact resume).
  const d = planDelivery('משפט ראשון כאן. משפט שני כאן. משפט שלישי כאן.')
  const a = advance(d); const b = resume(a.state)
  rows.push({ id: 'speech-resume', layer: 'speech', pass: !!a.chunk && !!b.chunk && a.chunk !== b.chunk && d.fullText.length > (a.chunk?.length ?? 0), detail: `c1="${a.chunk}" c2="${b.chunk}"` })

  return rows
}

export function acceptanceScore(rows: CaseResult[]): { passed: number; total: number; pct: number; byLayer: Array<{ layer: Layer; passed: number; total: number }>; failures: CaseResult[] } {
  const passed = rows.filter(r => r.pass).length
  const byLayerMap = new Map<Layer, CaseResult[]>()
  for (const r of rows) { const a = byLayerMap.get(r.layer) ?? []; a.push(r); byLayerMap.set(r.layer, a) }
  const byLayer = [...byLayerMap.entries()].map(([layer, a]) => ({ layer, passed: a.filter(x => x.pass).length, total: a.length }))
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), byLayer, failures: rows.filter(r => !r.pass) }
}
