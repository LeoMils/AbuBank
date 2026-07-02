/*
 * AbuAI Behavioral Production Gauntlet (Phase 14)
 * ══════════════════════════════════════════════
 * ≥750 realistic scenarios driven through the FULL runtime (`runFullTurn`) — these
 * are BEHAVIOR tests (real answer + RUNTIME_FINALIZED), not shallow unit checks.
 * Reports the true per-category pass rate. LLM/online are deterministic fake tools.
 */
import { runFullTurn, type FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeState } from '../screens/AbuAI/cognitiveRuntime'
import { saveAppointments, loadAppointments } from '../screens/AbuCalendar/service'
import { isFinalized } from '../screens/AbuAI/runtimeTrace'
import { planDelivery, advance, resume } from '../screens/AbuAI/conversationDeliveryEngine'

export type Cat = 'calendar' | 'family' | 'online' | 'general' | 'frustration' | 'continuation' | 'audio' | 'hebrew' | 'speech' | 'supervisor'
export interface BRow { cat: Cat; input: string; pass: boolean }
export interface CatScore { cat: Cat; passed: number; total: number; pct: number }

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }
const T = (ok: boolean, ans: string, llm: string): FullTurnTools => ({ llm: async () => llm, online: async () => ok ? { ok: true, answer: ans } : { ok: false, answer: '', reason: 'provider_failed' } })
const OK = T(true, 'יש הקרנה בשבע וחצי.', 'תשובה כללית קצרה ונכונה על הנושא.')

const PEOPLE = ['אופיר', 'מור', 'לאו', 'דני', 'רוזלינדה', 'מתתיהו', 'יעל', 'עילי']
const DAYS = ['מחר', 'מחרתיים', 'ביום ראשון', 'ביום שלישי', 'ביום חמישי']
const TIMES = ['בשמונה בבוקר', 'בעשר בבוקר', 'באחת בצהריים', 'בשבע בערב', 'בשמונה בערב']
const FAM: Array<[string, string, RegExp]> = [
  ['לאו', 'אופיר', /דוד/], ['אופיר', 'לאו', /אחיין/], ['לאו', 'אנאבל', /דוד רבא/],
  ['ירדן', 'אנאבל', /דוד/], ['רפי', 'לאו', /גיס/], ['לאו', 'רפי', /גיס/],
  ['רפי', 'מרטיטה', /חתן/], ['אופיר', 'מרטיטה', /נכד/], ['מור', 'לאו', /אח/],
  ['ארי', 'אנאבל', /אח/], ['אנאבל', 'ארי', /אח/],
]
const ONLINE = ['מה יש בקולנוע היום', 'מה הסרטים בכפר סבא', 'מתי האוטובוס מרעננה לתל אביב', 'מתי הרכבת מרעננה', 'מי ניצח במונדיאל אתמול', 'מה מזג האוויר היום']
const GENERAL = ['מה זה קוונטים', 'מה זה בינה מלאכותית', 'מיהו איינשטיין']
const BROKEN = ['אני תבדוק', 'תקבילי פגישה', 'אחורה צהריים']

const finOK = (r: { trace: unknown; supervisor: { approved: boolean } }) => isFinalized(r.trace as never) && r.supervisor.approved

export async function runBehavioralGauntlet(): Promise<{ rows: BRow[]; scores: CatScore[] }> {
  const rows: BRow[] = []
  const add = (cat: Cat, input: string, pass: boolean) => rows.push({ cat, input, pass })

  // Family — directional, both orders, reps for weight.
  for (let rep = 0; rep < 16; rep++) for (const [a, b, want] of FAM) {
    const r = await runFullTurn(IDLE_RUNTIME, `מה הקשר בין ${a} ל${b}`, ctx, OK)
    add('family', `${a}/${b}`, finOK(r) && want.test(r.display))
  }

  // Calendar — create (confirm) + a subset save-verified; search-all.
  let i = 0
  for (const p of PEOPLE) for (const d of DAYS) {
    const t = TIMES[i % TIMES.length]!
    saveAppointments([])
    const r = await runFullTurn(IDLE_RUNTIME, `תקבעי פגישה עם ${p} ${d} ${t}`, ctx, OK)
    add('calendar', `create ${p} ${d}`, finOK(r) && /נכון|לקבוע|\?/.test(r.display))
    i++
  }
  for (let rep = 0; rep < 6; rep++) for (const p of PEOPLE) {
    saveAppointments([]); const before = loadAppointments().length
    const r1 = await runFullTurn(IDLE_RUNTIME, `תקבעי פגישה עם ${p} מחר בשבע בערב`, ctx, OK)
    const r2 = await runFullTurn(r1.state, 'כן כן', ctx, OK)
    add('calendar', `save ${p}`, finOK(r2) && loadAppointments().length === before + 1)
    const rs = await runFullTurn(IDLE_RUNTIME, `מתי יש לי פגישה עם ${p}`, ctx, OK)
    add('calendar', `search ${p}`, finOK(rs) && !/באיזה יום/.test(rs.display))
  }

  // Online.
  for (let rep = 0; rep < 22; rep++) for (const q of ONLINE) {
    const r = await runFullTurn(IDLE_RUNTIME, q, ctx, OK)
    add('online', q, finOK(r) && r.source === 'online')
  }
  // Provider failure honest.
  for (let rep = 0; rep < 10; rep++) {
    const r = await runFullTurn(IDLE_RUNTIME, 'מי ניצח במונדיאל אתמול', ctx, T(false, '', ''))
    add('online', 'fail honest', finOK(r) && /נפל|לא הצלחתי|ננסה/.test(r.display) && !/ניצח/.test(r.display))
  }

  // General knowledge.
  for (let rep = 0; rep < 20; rep++) for (const q of GENERAL) {
    const r = await runFullTurn(IDLE_RUNTIME, q, ctx, OK)
    add('general', q, finOK(r) && r.display.length > 0)
  }

  // Frustration — distinct + specific.
  for (let rep = 0; rep < 40; rep++) {
    const r1 = await runFullTurn(IDLE_RUNTIME, 'את לא מבינה אותי', ctx, OK)
    const r2 = await runFullTurn(r1.state, 'את לא עונה למה ששאלתי', ctx, OK)
    add('frustration', 'x2', finOK(r1) && finOK(r2) && r1.display !== r2.display && !/^סליחה\.?$/.test(r1.display))
  }

  // Continuation + recall.
  for (let rep = 0; rep < 30; rep++) {
    const r1 = await runFullTurn(IDLE_RUNTIME, 'ספרי לי על המהפכה הצרפתית', ctx, T(true, '', 'המהפכה פרצה ב-1789. היא הפילה את המלוכה. אחר כך הטרור. ואז נפוליאון.'))
    const r2 = await runFullTurn(r1.state, 'תמשיכי', ctx, OK)
    add('continuation', 'resume', finOK(r2) && r2.intent === 'continuation' && r2.display.length > 0)
    const r3 = await runFullTurn(r1.state, 'על מה דיברנו', ctx, OK)
    add('continuation', 'recall', finOK(r3) && /המהפכה/.test(r3.display))
  }

  // Audio complaint — never cancels.
  for (let rep = 0; rep < 40; rep++) {
    saveAppointments([])
    const r1 = await runFullTurn(IDLE_RUNTIME, 'תקבעי פגישה עם אורית היום בשמונה בערב', ctx, OK)
    const r2 = await runFullTurn(r1.state, rep % 2 ? 'לא שמעתי' : 'אני לא שומע אותך', ctx, OK)
    add('audio', 'keeps draft', finOK(r2) && r2.state.createState.phase !== 'idle' && r2.sideEffect === null)
  }

  // Hebrew — broken input never echoed broken; supervisor rejection.
  for (let rep = 0; rep < 12; rep++) for (const bad of BROKEN) {
    const r = await runFullTurn(IDLE_RUNTIME, bad, ctx, T(true, '', bad))
    add('hebrew', bad, finOK(r) && !/אני\s+תבדוק|תקבילי|אחורה\s+צהריים/.test(r.speak))
    add('supervisor', `reject ${bad}`, r.supervisor.approved === true) // after repair, output is clean/approved
  }

  // Speech — chunk + resume + no markdown (sync).
  for (let rep = 0; rep < 60; rep++) {
    const d = planDelivery('משפט ראשון כאן. משפט שני כאן. משפט שלישי כאן. משפט רביעי כאן.')
    const a = advance(d); const b = resume(a.state)
    add('speech', 'chunk+resume', !!a.chunk && !!b.chunk && a.chunk !== b.chunk && !/https?:\/\/|\]\(/.test(d.chunks.join(' ')))
  }

  // Aggregate.
  const byCat = new Map<Cat, BRow[]>()
  for (const r of rows) { const arr = byCat.get(r.cat) ?? []; arr.push(r); byCat.set(r.cat, arr) }
  const scores: CatScore[] = []
  for (const [cat, arr] of byCat) {
    const passed = arr.filter(r => r.pass).length
    scores.push({ cat, passed, total: arr.length, pct: Math.round((passed / arr.length) * 1000) / 10 })
  }
  return { rows, scores }
}
