/*
 * Full Thinking Runtime Replay (Phase 13)
 * ═══════════════════════════════════════
 * Replays Leo's real failures through the FULL async runtime entry (`runFullTurn`)
 * — the exact no-bypass path the flagged live cutover uses. Every row asserts the
 * answer was produced by the runtime (routedThroughRuntime), passed the Cognitive
 * Supervisor, answered the actual question, and (for speech) resumes correctly.
 * LLM/online are injected as deterministic fake tools so the replay is stable.
 */
import { runFullTurn, type FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'

export interface ReplayRow { id: string; kind: string; input: string; pass: boolean; detail: string }

const NOW_DEFAULT = new Date(2026, 6, 2, 9, 0, 0)

function tools(onlineOk: boolean, onlineAnswer: string, llmAnswer: string): FullTurnTools {
  return {
    llm: async () => llmAnswer,
    online: async () => onlineOk ? { ok: true, answer: onlineAnswer } : { ok: false, answer: '', reason: 'provider_failed' },
  }
}

export async function runFullThinkingReplay(opts: { now?: Date; resetStore?: boolean }): Promise<ReplayRow[]> {
  const now = opts.now ?? NOW_DEFAULT
  if (opts.resetStore) saveAppointments([])
  const rows: ReplayRow[] = []
  const ctx = { messages: [] as Array<{ role: string; content: string }>, now }
  const T = tools(true, 'יש הקרנה של סרט בשבע וחצי בערב.', 'תשובה כללית קצרה ונכונה.')

  const push = (id: string, kind: string, input: string, pass: boolean, detail: string) => rows.push({ id, kind, input, pass, detail })
  const supervised = (r: { routedThroughRuntime: boolean; supervisor: { approved: boolean } }) => r.routedThroughRuntime && r.supervisor.approved

  // date
  {
    const r = await runFullTurn(IDLE_RUNTIME, 'איזה יום היום', ctx, T)
    push('date', 'date', 'איזה יום היום', supervised(r) && /יום חמישי/.test(r.display), `say="${r.display}"`)
  }
  // calendar read empty (no contradiction, no invention)
  {
    saveAppointments([])
    const r = await runFullTurn(IDLE_RUNTIME, 'מה יש לי מחר', ctx, T)
    push('read', 'calendar_read', 'מה יש לי מחר', supervised(r) && /אין|שקט|ריק/.test(r.display) && !/דוקטור|רופא/.test(r.display), `say="${r.display}"`)
  }
  // search all calendar (never "באיזה יום")
  {
    saveAppointments([])
    const r = await runFullTurn(IDLE_RUNTIME, 'מתי יש לי פגישה עם מוטי', ctx, T)
    push('search', 'calendar_search', 'מתי יש לי פגישה עם מוטי', supervised(r) && !/באיזה יום/.test(r.display), `say="${r.display}"`)
  }
  // create + repeated yes → save (verified)
  {
    saveAppointments([])
    const before = loadAppointments().length
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'תקבעי פגישה עם רוזלינדה מחר בשבע בערב', ctx, T); st = r1.state
    const r2 = await runFullTurn(st, 'כן כן', ctx, T); st = r2.state
    const r3 = await runFullTurn(st, 'תקבעי את זה', ctx, T)
    const saved = loadAppointments().length >= before + 1
    push('create', 'calendar_create', 'create + repeated yes', supervised(r2) && saved, `r2.side=${r2.sideEffect} appts=${loadAppointments().length}`)
    push('yes_no_loop', 'confirmation', 'repeated yes never loops', supervised(r3) && !/לא הבנתי/.test(r3.display), `r3="${r3.display}"`)
  }
  // complex Ofir calendar request → confirmation surfaces duration + important details
  {
    saveAppointments([])
    const ofir = 'ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'
    const r = await runFullTurn(IDLE_RUNTIME, ofir, ctx, T)
    push('ofir', 'calendar_create', 'complex Ofir request', supervised(r) && /שעתיים/.test(r.display) && /פרטים חשובים|גלעד/.test(r.display), `say="${r.display}"`)
  }
  // family directional
  for (const [q, want] of [['מה הקשר בין לאו לאנאבל', 'דוד רבא'], ['מה הקשר בין אופיר ללאו', 'אחיינית']] as const) {
    const r = await runFullTurn(IDLE_RUNTIME, q, ctx, T)
    push(`fam:${q.slice(-6)}`, 'family', q, supervised(r) && r.display.includes(want), `want=${want} say="${r.display}"`)
  }
  // online cinema (ok) + world cup (fail honest)
  {
    const r = await runFullTurn(IDLE_RUNTIME, 'מה יש בקולנוע היום', ctx, T)
    push('cinema', 'online', 'movies Kfar Saba', supervised(r) && r.source === 'online', `src=${r.source} say="${r.display}"`)
    const rf = await runFullTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', ctx, tools(false, '', ''))
    push('worldcup', 'online_fail', 'World Cup fail honest', supervised(rf) && /נפל|לא הצלחתי|ננסה/.test(rf.display) && !/ניצח/.test(rf.display), `say="${rf.display}"`)
  }
  // general knowledge via LLM tool, finalized
  {
    const r = await runFullTurn(IDLE_RUNTIME, 'מה זה תורת הקוונטים', ctx, T)
    push('general', 'general', 'stable fact', supervised(r) && r.source === 'llm' && r.display.length > 0, `src=${r.source}`)
  }
  // broken-Hebrew LLM output never emitted raw
  {
    const r = await runFullTurn(IDLE_RUNTIME, 'ספרי לי משהו', ctx, tools(true, '', 'אני תבדוק את זה מיד'))
    push('brokenheb', 'hebrew_guard', 'broken LLM Hebrew caught', !/אני\s+תבדוק/.test(r.speak) && r.supervisor.approved, `say="${r.speak}"`)
  }
  // continuation + memory recall
  {
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'ספרי לי על המהפכה הצרפתית', ctx, tools(true, '', 'המהפכה הצרפתית פרצה ב-1789. היא הפילה את המלוכה. אחר כך בא שלטון הטרור. ואז עלה נפוליאון.')); st = r1.state
    const r2 = await runFullTurn(st, 'תמשיכי', ctx, T)
    push('continue', 'continuation', 'תמשיכי resumes', supervised(r2) && r2.intent === 'continuation' && r2.display.length > 0, `say="${r2.display}"`)
    const r3 = await runFullTurn(r1.state, 'על מה דיברנו', ctx, T)
    push('memory', 'memory', 'על מה דיברנו', supervised(r3) && /המהפכה הצרפתית/.test(r3.display), `say="${r3.display}"`)
  }
  // frustration specific, not template
  {
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'את לא מבינה אותי', ctx, T); st = r1.state
    const r2 = await runFullTurn(st, 'אבל כבר התחלת לענות', ctx, T)
    push('frustration', 'frustration', 'frustration ×2 distinct', supervised(r1) && supervised(r2) && r1.display !== r2.display, `d1="${r1.display}" d2="${r2.display}"`)
  }
  // audio complaint never cancels
  {
    saveAppointments([])
    let st: RuntimeState = IDLE_RUNTIME
    const r1 = await runFullTurn(st, 'תקבעי פגישה עם אורית היום בשמונה בערב', ctx, T); st = r1.state
    const r2 = await runFullTurn(st, 'אני לא שומע אותך', ctx, T)
    push('audio', 'audio_complaint', 'audio complaint keeps draft', supervised(r2) && r2.state.createState.phase !== 'idle' && r2.sideEffect === null, `phase=${r2.state.createState.phase}`)
  }
  // speech interruption + resume delivers the exact next chunk
  {
    const d0 = planDelivery('משפט ראשון כאן. משפט שני כאן. משפט שלישי כאן. משפט רביעי כאן.')
    const a = advance(d0)
    const b = resume(a.state)
    push('speech', 'speech_resume', 'תמשיכי resumes next chunk', !!a.chunk && !!b.chunk && a.chunk !== b.chunk, `c1="${a.chunk}" c2="${b.chunk}"`)
  }

  return rows
}

export function replayScore(rows: ReplayRow[]): { passed: number; total: number; pct: number; failures: ReplayRow[] } {
  const passed = rows.filter(r => r.pass).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}
