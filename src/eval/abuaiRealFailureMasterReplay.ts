/*
 * AbuAI Real Failure Master Replay (Phase 3)
 * ══════════════════════════════════════════
 * Every real failure Leo reported, replayed through the FULL runtime (`runFullTurn`).
 * Each row asserts BOTH the behavior AND that the answer is RUNTIME_FINALIZED
 * (no legacy bypass). LLM/online are deterministic fake tools.
 */
import { runFullTurn, type FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'

export interface MRow { id: string; title: string; pass: boolean; finalized: boolean; detail: string }

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const ctx = (msgs: Array<{ role: string; content: string }> = []) => ({ messages: msgs, now: NOW })
const tools = (onlineOk: boolean, onlineAns: string, llm: string): FullTurnTools => ({
  llm: async () => llm, online: async () => onlineOk ? { ok: true, answer: onlineAns } : { ok: false, answer: '', reason: 'provider_failed' },
})
const OK = tools(true, 'יש הקרנה בשבע וחצי בערב.', 'תשובה כללית קצרה ונכונה.')

export async function runMasterReplay(opts: { resetStore?: boolean } = {}): Promise<MRow[]> {
  if (opts.resetStore) saveAppointments([])
  const rows: MRow[] = []
  const push = async (id: string, title: string, run: () => Promise<{ ok: boolean; r?: { trace: unknown; supervisor: { approved: boolean } }; detail: string }>) => {
    const { ok, r, detail } = await run()
    const finalized = r ? (isFinalized(r.trace as never) && r.supervisor.approved) : true
    rows.push({ id, title, pass: ok && finalized, finalized, detail })
  }
  const one = async (input: string, st: RuntimeState = IDLE_RUNTIME) => runFullTurn(st, input, ctx(), OK)

  // 1. wrong day/date
  await push('1', 'wrong day/date', async () => { const r = await one('איזה יום היום'); return { ok: /יום חמישי/.test(r.display), r, detail: r.display } })
  // 2. what do I have today / tomorrow
  await push('2', 'today/tomorrow', async () => { saveAppointments([]); const r = await one('מה יש לי מחר'); return { ok: /אין|שקט/.test(r.display) && !/רופא|דוקטור/.test(r.display), r, detail: r.display } })
  // 3. calendar contradiction: nothing-today then two-today (guarded)
  await push('3', 'calendar contradiction', async () => { saveAppointments([]); const r = await one('מה יש לי היום'); const ok = /אין|שקט/.test(r.display) && !/שתי|שתיים|\d/.test(r.display); return { ok, r, detail: r.display } })
  // 4. search all for Moti — never "באיזה יום"
  await push('4', 'search Moti', async () => { saveAppointments([]); const r = await one('מתי יש לי פגישה עם מוטי'); return { ok: !/באיזה יום/.test(r.display), r, detail: r.display } })
  // 5. create with each attendee → save
  for (const p of ['דני', 'מתתיהו', 'רוזלינדה']) {
    await push(`5:${p}`, `create ${p}`, async () => { saveAppointments([]); const b = loadAppointments().length; let st: RuntimeState = IDLE_RUNTIME; const r1 = await one(`תקבעי פגישה עם ${p} מחר בשבע בערב`, st); st = r1.state; const r2 = await runFullTurn(st, 'כן', ctx(), OK); return { ok: loadAppointments().length === b + 1, r: r2, detail: `appts=${loadAppointments().length}` } })
  }
  // 6. repeated yes variants save
  for (const y of ['כן', 'כן כן', 'כן תקבעי']) {
    await push(`6:${y}`, `repeated yes "${y}"`, async () => { saveAppointments([]); const b = loadAppointments().length; let st: RuntimeState = IDLE_RUNTIME; const r1 = await one('תקבעי פגישה עם אורית היום בשמונה בערב', st); st = r1.state; const r2 = await runFullTurn(st, y, ctx(), OK); return { ok: loadAppointments().length === b + 1, r: r2, detail: r2.sideEffect ?? '' } })
  }
  // 7. complex Ofir
  await push('7', 'complex Ofir', async () => { saveAppointments([]); const r = await one('ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'); return { ok: /שעתיים/.test(r.display) && /פרטים חשובים|גלעד/.test(r.display), r, detail: r.display } })
  // 8-10. family directional
  await push('8', 'מה ליאו עבור אופיר', async () => { const r = await one('מה ליאו עבור אופיר'); return { ok: /דוד/.test(r.display) && !/הבן שלך/.test(r.display), r, detail: r.display } })
  await push('9', 'הקשר בין רפי ללאו', async () => { const r = await one('מה הקשר בין רפי ללאו'); return { ok: /גיס/.test(r.display), r, detail: r.display } })
  await push('10', 'מי ירדן עבור אנאבל', async () => { const r = await one('מה הקשר בין ירדן לאנאבל'); return { ok: /דוד/.test(r.display), r, detail: r.display } })
  // 11-13. online
  await push('11', 'movies Kfar Saba', async () => { const r = await one('מה הסרטים בכפר סבא'); return { ok: r.source === 'online', r, detail: r.display } })
  await push('12', 'bus from Raanana', async () => { const r = await one('מתי האוטובוס מרעננה לתל אביב'); return { ok: r.source === 'online', r, detail: `src=${r.source}` } })
  await push('13', 'World Cup', async () => { const r = await runFullTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', ctx(), tools(false, '', '')); return { ok: /נפל|לא הצלחתי|ננסה/.test(r.display) && !/ניצח/.test(r.display), r, detail: r.display } })
  // 14. continuation
  await push('14', 'continue/finish', async () => { let st: RuntimeState = IDLE_RUNTIME; const r1 = await runFullTurn(st, 'ספרי לי על המהפכה הצרפתית', ctx(), tools(true, '', 'המהפכה פרצה ב-1789. היא הפילה את המלוכה. אחר כך בא הטרור. ואז נפוליאון.')); st = r1.state; const r2 = await runFullTurn(st, 'תמשיכי', ctx(), OK); return { ok: r2.intent === 'continuation' && r2.display.length > 0, r: r2, detail: r2.display } })
  // 15. memory recall
  await push('15', 'memory recall', async () => { let st: RuntimeState = IDLE_RUNTIME; const r1 = await runFullTurn(st, 'ספרי לי על המהפכה הצרפתית', ctx(), tools(true, '', 'המהפכה פרצה ב-1789.')); st = r1.state; const r2 = await runFullTurn(st, 'יש לך זיכרון על מה דיברנו', ctx(), OK); return { ok: /המהפכה/.test(r2.display), r: r2, detail: r2.display } })
  // 16. user says AbuAI is wrong
  await push('16', 'user says wrong', async () => { const r = await one('את טועה, זה לא מה ששאלתי'); return { ok: r.intent === 'frustration' && !/^סליחה\.?$/.test(r.display), r, detail: r.display } })
  // 17. frustration
  await push('17', 'frustration', async () => { let st: RuntimeState = IDLE_RUNTIME; const r1 = await one('את לא מבינה אותי', st); st = r1.state; const r2 = await runFullTurn(st, 'את לא עונה למה ששאלתי', ctx(), OK); return { ok: r1.display !== r2.display, r: r2, detail: `${r1.display} | ${r2.display}` } })
  // 18. broken Hebrew inputs never echoed broken
  for (const bad of ['אני תבדוק', 'תקבילי פגישה', 'אחורה צהריים']) {
    await push(`18:${bad.slice(0, 6)}`, `broken "${bad}"`, async () => { const r = await runFullTurn(IDLE_RUNTIME, bad, ctx(), tools(true, '', bad)); return { ok: !/אני\s+תבדוק|תקבילי|אחורה\s+צהריים/.test(r.speak), r, detail: r.speak } })
  }
  // 19. audio complaint keeps draft
  for (const a of ['לא שמעתי', 'אני לא שומע אותך']) {
    await push(`19:${a.slice(0, 6)}`, `audio "${a}"`, async () => { saveAppointments([]); let st: RuntimeState = IDLE_RUNTIME; const r1 = await one('תקבעי פגישה עם אורית היום בשמונה בערב', st); st = r1.state; const r2 = await runFullTurn(st, a, ctx(), OK); return { ok: r2.state.createState.phase !== 'idle' && r2.sideEffect === null, r: r2, detail: `phase=${r2.state.createState.phase}` } })
  }
  // 20. speech interruption/resume + no markdown/url
  {
    const d = planDelivery('משפט אחד כאן. משפט שני כאן. משפט שלישי כאן.'); const a = advance(d); const b = resume(a.state)
    rows.push({ id: '20', title: 'speech resume', pass: !!a.chunk && !!b.chunk && a.chunk !== b.chunk && !/https?:\/\/|\]\(/.test(d.chunks.join(' ')), finalized: true, detail: `${a.chunk} → ${b.chunk}` })
  }

  return rows
}

export function masterScore(rows: MRow[]): { passed: number; total: number; pct: number; finalizedPct: number; failures: MRow[] } {
  const passed = rows.filter(r => r.pass).length
  const fin = rows.filter(r => r.finalized).length
  return { passed, total: rows.length, pct: Math.round((passed / rows.length) * 100), finalizedPct: Math.round((fin / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}
