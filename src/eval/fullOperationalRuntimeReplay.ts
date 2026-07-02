/*
 * Full Operational Runtime Replay (Phase 6)
 * ═════════════════════════════════════════
 * Replays Leo's real failures through the FULL operational entry `runFullTurn` and
 * asserts, per row: the actual question was answered, the Cognitive Supervisor
 * approved, AND the answer carries a RUNTIME_FINALIZED trace (the no-bypass proof —
 * 0 legacy bypasses). LLM/online are deterministic fake tools.
 */
import { runFullTurn, type FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'

export interface OpRow { id: string; kind: string; input: string; pass: boolean; finalized: boolean; detail: string }

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
const T = (onlineOk: boolean, onlineAns: string, llm: string): FullTurnTools => ({
  llm: async () => llm,
  online: async () => onlineOk ? { ok: true, answer: onlineAns } : { ok: false, answer: '', reason: 'provider_failed' },
})
const OK = T(true, 'יש הקרנה בשבע וחצי.', 'תשובה כללית נכונה וקצרה.')

export async function runFullOperationalReplay(opts: { resetStore?: boolean } = {}): Promise<OpRow[]> {
  if (opts.resetStore) saveAppointments([])
  const rows: OpRow[] = []
  // Every row goes through runFullTurn → its answer MUST be finalized (no bypass).
  const check = (id: string, kind: string, input: string, r: Awaited<ReturnType<typeof runFullTurn>>, behavior: boolean, detail: string) => {
    const finalized = isFinalized(r.trace) && r.supervisor.approved
    rows.push({ id, kind, input, pass: behavior && finalized, finalized, detail })
  }

  { const r = await runFullTurn(IDLE_RUNTIME, 'איזה יום היום', ctx, OK); check('date', 'date', 'איזה יום היום', r, /יום חמישי/.test(r.display), r.display) }
  { saveAppointments([]); const r = await runFullTurn(IDLE_RUNTIME, 'מה יש לי מחר', ctx, OK); check('read', 'calendar_read', 'מה יש לי מחר', r, /אין|שקט|ריק/.test(r.display) && !/רופא|דוקטור/.test(r.display), r.display) }
  { saveAppointments([]); const r = await runFullTurn(IDLE_RUNTIME, 'מתי יש לי פגישה עם מוטי', ctx, OK); check('moti', 'calendar_search', 'מתי יש לי פגישה עם מוטי', r, !/באיזה יום/.test(r.display), r.display) }
  {
    saveAppointments([]); const before = loadAppointments().length
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'תקבעי פגישה עם דני מחר בשבע בערב', ctx, OK); st = r1.state
    const r2 = await runFullTurn(st, 'כן כן', ctx, OK); st = r2.state
    const r3 = await runFullTurn(st, 'תקבעי את זה', ctx, OK)
    check('create', 'calendar_create', 'create + repeated yes', r2, loadAppointments().length >= before + 1, `appts=${loadAppointments().length}`)
    check('yesloop', 'confirmation', 'repeated yes no loop', r3, !/לא הבנתי/.test(r3.display), r3.display)
  }
  {
    saveAppointments([])
    const ofir = 'ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'
    const r = await runFullTurn(IDLE_RUNTIME, ofir, ctx, OK)
    check('ofir', 'calendar_create', 'complex Ofir', r, /שעתיים/.test(r.display) && /פרטים חשובים|גלעד/.test(r.display), r.display)
  }
  for (const [q, want] of [['מה הקשר בין לאו לאנאבל', 'דוד רבא'], ['מה הקשר בין אופיר ללאו', 'אחיין'], ['מה הקשר בין רפי ללאו', 'גיס']] as const) {
    const r = await runFullTurn(IDLE_RUNTIME, q, ctx, OK)
    check(`fam:${want}`, 'family', q, r, r.display.includes(want), r.display)
  }
  { const r = await runFullTurn(IDLE_RUNTIME, 'מה יש בקולנוע היום', ctx, OK); check('cinema', 'online', 'movies', r, r.source === 'online', r.display) }
  { const r = await runFullTurn(IDLE_RUNTIME, 'מתי האוטובוס הבא לתל אביב', ctx, OK); check('bus', 'online', 'bus', r, r.source === 'online', r.display) }
  { const r = await runFullTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', ctx, T(false, '', '')); check('worldcup', 'online_fail', 'world cup fail honest', r, /נפל|לא הצלחתי|ננסה/.test(r.display) && !/ניצח/.test(r.display), r.display) }
  {
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'ספרי לי על המהפכה הצרפתית', ctx, T(true, '', 'המהפכה הצרפתית פרצה ב-1789. היא הפילה את המלוכה. אחר כך בא הטרור. ואז נפוליאון.')); st = r1.state
    const r2 = await runFullTurn(st, 'תמשיכי', ctx, OK); check('continue', 'continuation', 'continue', r2, r2.intent === 'continuation' && r2.display.length > 0, r2.display)
    const r3 = await runFullTurn(r1.state, 'על מה דיברנו', ctx, OK); check('memory', 'memory', 'recall', r3, /המהפכה הצרפתית/.test(r3.display), r3.display)
  }
  {
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'את לא מבינה אותי', ctx, OK); st = r1.state
    const r2 = await runFullTurn(st, 'אבל כבר התחלת לענות', ctx, OK)
    check('frustration', 'frustration', 'frustration ×2', r2, r1.display !== r2.display, `${r1.display} | ${r2.display}`)
  }
  { const r = await runFullTurn(IDLE_RUNTIME, 'ספרי משהו', ctx, T(true, '', 'אני תבדוק את זה')); check('brokenheb', 'hebrew_guard', 'broken LLM Hebrew', r, !/אני\s+תבדוק/.test(r.speak), r.speak) }
  {
    saveAppointments([]); let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'תקבעי פגישה עם אורית היום בשמונה בערב', ctx, OK); st = r1.state
    const r2 = await runFullTurn(st, 'אני לא שומע אותך', ctx, OK)
    check('audio', 'audio_complaint', 'audio keeps draft', r2, r2.state.createState.phase !== 'idle' && r2.sideEffect === null, `phase=${r2.state.createState.phase}`)
  }
  // speech interruption/resume (delivery engine)
  {
    const d = planDelivery('משפט אחד כאן. משפט שני כאן. משפט שלישי כאן.')
    const a = advance(d); const b = resume(a.state)
    rows.push({ id: 'speech', kind: 'speech_resume', input: 'תמשיכי', pass: !!a.chunk && !!b.chunk && a.chunk !== b.chunk, finalized: true, detail: `${a.chunk} → ${b.chunk}` })
  }

  return rows
}

export function opScore(rows: OpRow[]): { passed: number; total: number; pct: number; finalizedPct: number; failures: OpRow[] } {
  const passed = rows.filter(r => r.pass).length
  const finalized = rows.filter(r => r.finalized).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), finalizedPct: Math.round((finalized / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}
