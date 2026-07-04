/*
 * AbuAI Final Production Acceptance — behavior-first, ≥150 adversarial cases
 * ═════════════════════════════════════════════════════════════════════════
 * Every case is a real/adversarial Leo-failure behavior with input, expected
 * behavior, forbidden answer, and responsible layer — driven through the ONE
 * ExecutiveCognitiveController. Per-layer thresholds. Designed to FAIL where a
 * layer is weak; passes only on real correct behavior.
 */
import {
  runCase, has, OK, FAIL_ONLINE, ACCEPTANCE_CASES,
  type AcceptanceCase, type CaseResult, type Layer,
} from './abuaiIntelligenceAcceptance'
import { loadAppointments, addAppointment } from '../screens/AbuCalendar/service'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

const brokenLLM = (bad: string): FullTurnTools => ({ llm: async () => bad, online: async () => ({ ok: true, answer: 'x' }) })

// ── Family: directional pairs across every listed person ──
// [a, b, expected, forbidden]
const FAM: Array<[string, string, RegExp, RegExp | undefined]> = [
  ['לאו', 'אופיר', /דוד/, /הבן שלך|אחיין/],
  ['אופיר', 'לאו', /אחיינית/, /דוד\b|הבן/],
  ['מור', 'לאו', /אח/, /דוד/],
  ['לאו', 'מור', /אח/, /דוד/],
  ['אופיר', 'אנאבל', /אבא|אמא|הורה/, /דוד|לא אנחש/],
  ['אנאבל', 'אופיר', /בן|בת/, /דוד/],
  ['רפי', 'לאו', /גיס/, /דוד|(?<![ה])אח\b/],
  ['לאו', 'רפי', /גיס/, /דוד/],
  ['ירדן', 'אנאבל', /דוד/, /לא אנחש/],
  ['ירדן', 'ארי', /דוד/, /לא אנחש/],
  ['עילי', 'אנאבל', /דוד/, /לא אנחש/],
  ['איילון', 'אנאבל', /דוד/, /לא אנחש/],
  ['נועם', 'לאו', /בן|בת/, /דוד|לא אנחש/],
  ['ארי', 'אנאבל', /אח/, /דוד|לא אנחש/],
  ['אנאבל', 'ארי', /אח/, /דוד|לא אנחש/],
  ['ארי', 'רפי', /נכד/, /לא אנחש/],
  ['רפי', 'ארי', /סב/, /לא אנחש/],
  ['איילון', 'נועם', /דוד/, undefined],   // cousin → "בן דוד"
  ['נועם', 'איילון', /דוד/, undefined],
  ['מרטיטה', 'אופיר', /סבתא/, /לא אנחש/],
  ['אופיר', 'מרטיטה', /נכד/, /לא אנחש/],
  ['רפי', 'מרטיטה', /חתן/, /לא אנחש/],
  ['עילי', 'ירדן', /בעל|אשת|אישה|בן הזוג|בת הזוג/, /לא אנחש/],
  ['נפוליאון', 'לאו', /לא אנחש|לא מכירה|לא בטוחה|לא יודעת/, undefined],
]
const famCases: AcceptanceCase[] = FAM.map(([a, b, exp, forb], i) => ({
  id: `fam2-${i}-${a}-${b}`, layer: 'family' as Layer,
  turns: [`מה ${a} עבור ${b}`],
  expect: (f: string) => exp.test(f),
  ...(forb ? { forbidden: forb } : {}),
}))

// ── Calendar: parametrized create+save (verified, saved once, never cancelled) ──
const PEOPLE = ['דני', 'רוזלינדה', 'מתתיהו', 'אורית', 'יעל', 'עדי']
const DAYS = ['מחר', 'מחרתיים', 'ביום ראשון', 'ביום שלישי']
const TIMES = ['בשמונה בבוקר', 'בעשר בבוקר', 'בשבע בערב', 'בשמונה בערב']
const calCreate: AcceptanceCase[] = []
let ci = 0
for (const p of PEOPLE) for (const d of DAYS.slice(0, 3)) {
  const t = TIMES[ci % TIMES.length]!
  calCreate.push({
    id: `cal-create-${ci}-${p}`, layer: 'calendar',
    turns: [`תקבעי פגישה עם ${p} ${d} ${t}`, 'כן'],
    expect: () => loadAppointments().length === 1,
    forbidden: /ביטלתי/,
  })
  ci++
}
// search-all (never "באיזה יום"), read grounded, repeated-yes-once, missing-field, complex
const calMisc: AcceptanceCase[] = [
  { id: 'cal-search-empty', layer: 'calendar', turns: ['מתי יש לי פגישה עם מוטי'], expect: () => true, forbidden: /באיזה יום/ },
  { id: 'cal-search-hit', layer: 'calendar', seed: () => addAppointment({ title: 'פגישה עם מוטי', date: '2026-08-01', time: '10:00', emoji: '📅' }), turns: ['מתי יש לי פגישה עם מוטי'], expect: f => has(f, 'מוטי'), forbidden: /באיזה יום/ },
  { id: 'cal-read-today-empty', layer: 'calendar', turns: ['מה יש לי היום'], expect: f => has(f, 'אין', 'שקט'), forbidden: /רופא|תור|\d{1,2}:\d{2}/ },
  { id: 'cal-read-tomorrow-empty', layer: 'calendar', turns: ['מה יש לי מחר'], expect: f => has(f, 'אין', 'שקט'), forbidden: /רופא|תור|\d{1,2}:\d{2}/ },
  { id: 'cal-repeated-yes-once', layer: 'calendar', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'כן כן כן תקבעי', 'כן'], expect: () => loadAppointments().length === 1 },
  { id: 'cal-missing-time', layer: 'calendar', turns: ['תקבעי פגישה עם דני מחר'], expect: f => has(f, 'שעה', 'מתי', 'באיזו שעה') },
  { id: 'cal-complex-ofir', layer: 'calendar', turns: ['ביום שלישי אופיר אמרה לי שהיא תחזור קצת יותר מאוחר כי היא צריכה לסיים את העבודה, אז אם אני יכול להגיע אליה בשעה שבע ולא שבע וחצי, כי גלעד לא יוכל להגיע, והיא רוצה שאני אהיה אצלה שעתיים.'], expect: f => has(f, 'שעתיים') && has(f, 'פרטים חשובים', 'גלעד') },
  { id: 'cal-delete', layer: 'calendar', seed: () => addAppointment({ title: 'פגישה עם דני', date: '2026-07-06', time: '08:00', emoji: '📅' }), turns: ['תמחקי את הפגישה עם דני'], expect: () => loadAppointments().length === 0, forbidden: /אין פגישה כזו/ },
  { id: 'cal-modify', layer: 'calendar', seed: () => addAppointment({ title: 'פגישה עם דני', date: '2026-07-06', time: '08:00', emoji: '📅' }), turns: ['תשני את הפגישה עם דני לשעה תשע'], expect: () => loadAppointments()[0]?.time === '09:00' },
  { id: 'cal-recurring', layer: 'calendar', turns: ['תקבעי יוגה כל יום שלישי בעשר בבוקר'], expect: () => loadAppointments().length === 4 },
]

// ── Online / knowledge routing ──
const onlineCases: AcceptanceCase[] = [
  { id: 'on-movies', layer: 'online', turns: ['מה הסרטים בכפר סבא'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-cinema', layer: 'online', turns: ['מה יש בקולנוע היום'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-bus', layer: 'online', turns: ['מתי האוטובוס מרעננה להוד השרון'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-train', layer: 'online', turns: ['מתי הרכבת מרעננה'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-sports', layer: 'online', turns: ['מי ניצח במונדיאל אתמול'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-weather', layer: 'online', turns: ['מה מזג האוויר היום'], expect: (_f, _a, r) => r.source === 'online' },
  { id: 'on-time', layer: 'online', turns: ['מה השעה'], expect: (_f, _a, r) => r.source !== 'online' },
  { id: 'on-date', layer: 'online', turns: ['מה התאריך היום'], expect: (_f, _a, r) => r.intent === 'date_query' && r.source !== 'online' },
  { id: 'on-fail-honest', layer: 'online', tools: FAIL_ONLINE, turns: ['מי ניצח במונדיאל אתמול'], expect: f => has(f, 'נפל', 'לא הצלחתי', 'ננסה'), forbidden: /ניצח[הו]/ },
  { id: 'on-general-frev', layer: 'online', turns: ['ספרי לי על המהפכה הצרפתית'], expect: (_f, _a, r) => r.source === 'llm' },
  { id: 'on-general-spain', layer: 'online', turns: ['מה זה מלחמת האזרחים בספרד'], expect: (_f, _a, r) => r.source === 'llm' || r.source === 'online' },
]

// ── Hebrew quality: a broken LLM answer must never be echoed ──
const hebrewCases: AcceptanceCase[] = [
  'אני תבדוק את היומן', 'תקבילי פגישה', 'אחורה צהריים', 'לך היום?', 'אני כאן?',
].map((bad, i) => ({
  id: `heb-${i}`, layer: 'hebrew' as Layer, tools: brokenLLM(bad),
  turns: ['ספרי לי משהו כללי'],
  expect: (_f: string, all: string[]) => !/אני\s+תבדוק|תקבילי|אחורה\s+צהריים/.test(all[all.length - 1] ?? ''),
  forbidden: /אני\s+תבדוק|תקבילי|אחורה\s+צהריים/,
}))

// ── Meta / Goal / Dialogue adversarial (multi-turn) ──
const adversarial: AcceptanceCase[] = [
  { id: 'adv-correction', layer: 'meta', turns: ['מי זה לאו', 'לא התכוונתי לזה, מה לאו עבור אופיר'], expect: f => has(f, 'דוד'), forbidden: /הבן שלך/ },
  { id: 'adv-yes-yes-tkva', layer: 'meta', turns: ['תקבעי פגישה עם דני מחר בשבע בערב', 'כן כן כן תקבעי'], expect: () => loadAppointments().length === 1, forbidden: /ביטלתי/ },
  { id: 'adv-not-answering', layer: 'dialogue', turns: ['מה יש לי היום', 'את לא עונה למה ששאלתי'], expect: (_f, _a, r) => r.intent === 'frustration' },
  { id: 'adv-audio-continue', layer: 'meta', turns: ['ספרי לי על המהפכה הצרפתית', 'לא שמעתי תמשיכי'], expect: (_f, _a, r) => r.intent === 'continuation', forbidden: /רגע, אני פה/ },
  { id: 'adv-frustration-keeps-goal', layer: 'goal', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'את לא מבינה אותי', 'כן'], expect: () => loadAppointments().length === 1 },
  { id: 'adv-audio-keeps-goal', layer: 'goal', turns: ['תקבעי פגישה עם אורית היום בשמונה בערב', 'לא שמעתי', 'כן'], expect: () => loadAppointments().length === 1 },
  { id: 'adv-two-frustration-distinct', layer: 'dialogue', turns: ['את לא מבינה אותי', 'אבל כבר התחלת לענות'], expect: (_f, all) => all[0] !== all[1] },
  { id: 'adv-why-refers-prev', layer: 'goal', turns: ['מי ניצח במונדיאל אתמול', 'למה?'], tools: FAIL_ONLINE, expect: (_f, _a, r) => r.intent === 'frustration' || r.intent === 'continuation' || has(_f, 'נפל', 'לא הצלחתי') },
]

// ── Family, alternate phrasing "מה הקשר בין A ל B" (same expected relation) ──
const famRel2: AcceptanceCase[] = FAM.filter(([a]) => a !== 'נפוליאון').map(([a, b, exp, forb], i) => ({
  id: `famrel-${i}-${a}-${b}`, layer: 'family' as Layer,
  turns: [`מה הקשר בין ${a} ל${b}`],
  expect: (f: string) => exp.test(f),
  ...(forb ? { forbidden: forb } : {}),
}))

// ── Calendar: search-all per person (empty → honest, never "באיזה יום") ──
const calSearchPer: AcceptanceCase[] = PEOPLE.map((p, i) => ({
  id: `cal-search-per-${i}-${p}`, layer: 'calendar' as Layer,
  turns: [`מתי יש לי פגישה עם ${p}`],
  expect: (f: string) => has(f, 'אין', p), forbidden: /באיזה יום/,
}))
// ── Calendar: grounded reads (empty store → never invents) ──
const calReadPer: AcceptanceCase[] = ['מה יש לי היום', 'מה יש לי מחר', 'מה יש לי היום ומה מחר', 'מה התוכניות שלי היום'].map((q, i) => ({
  id: `cal-read-per-${i}`, layer: 'calendar' as Layer, turns: [q],
  expect: (f: string) => has(f, 'אין', 'שקט', 'ריק'), forbidden: /רופא|תור|\d{1,2}:\d{2}/,
}))

// ── Confidence / Contradiction ──
const confidenceCases: AcceptanceCase[] = [
  { id: 'conf-no-cant-check-2', layer: 'confidence', turns: ['מה יש לי מחר'], expect: () => true, forbidden: /לא מצליחה לבדוק|אין לי גישה ליומן/ },
  { id: 'conf-unknown-rel', layer: 'confidence', turns: ['מה זה בלבלבל עבור לאו'], expect: f => has(f, 'לא אנחש', 'לא בטוחה', 'לא יודעת', 'לא מכירה') },
  { id: 'conf-unknown-rel-2', layer: 'confidence', turns: ['מה משהו עבור מישהו'], expect: f => has(f, 'לא אנחש', 'לא בטוחה', 'לא יודעת', 'לא מכירה') },
  { id: 'conf-no-invent-today', layer: 'confidence', turns: ['מה יש לי היום'], expect: f => has(f, 'אין', 'שקט'), forbidden: /פגישה עם|רופא|תור/ },
  { id: 'conf-date-not-online', layer: 'confidence', turns: ['איזה יום היום'], expect: (_f, _a, r) => r.source !== 'online' && r.intent === 'date_query' },
]

// ── Hebrew: valid answers are NOT flagged (repair only when broken) ──
const hebrewValid: AcceptanceCase[] = [
  { id: 'heb-valid-date', layer: 'hebrew', turns: ['איזה יום היום'], expect: f => has(f, 'יום שישי'), forbidden: /אני כאן\?|אני תבדוק/ },
  { id: 'heb-valid-read', layer: 'hebrew', turns: ['מה יש לי מחר'], expect: () => true, forbidden: /אני כאן\?|אני תבדוק|תקבילי|אחורה צהריים/ },
  { id: 'heb-valid-family', layer: 'hebrew', turns: ['מה לאו עבור אופיר'], expect: f => has(f, 'דוד'), forbidden: /אני כאן\?/ },
  { id: 'heb-valid-frustration', layer: 'hebrew', turns: ['את לא מבינה אותי'], expect: f => f.length > 5, forbidden: /אני תבדוק|תקבילי|אחורה צהריים/ },
]

export const FINAL_CASES: AcceptanceCase[] = [
  ...ACCEPTANCE_CASES, ...famCases, ...famRel2, ...calCreate, ...calMisc, ...calSearchPer, ...calReadPer,
  ...onlineCases, ...hebrewCases, ...hebrewValid, ...confidenceCases, ...adversarial,
]

const THRESHOLD: Record<Layer, number> = {
  meta: 97, goal: 97, dialogue: 97, family: 98, calendar: 97, online: 97, confidence: 97, speech: 97,
  hebrew: 97,
}

export async function runFinalAcceptance(): Promise<{ rows: CaseResult[]; byLayer: Array<{ layer: Layer; passed: number; total: number; pct: number; threshold: number; ok: boolean }>; total: number; pct: number; failures: CaseResult[] }> {
  const rows: CaseResult[] = []
  for (const c of FINAL_CASES) rows.push(await runCase(c))

  const map = new Map<Layer, CaseResult[]>()
  for (const r of rows) { const a = map.get(r.layer) ?? []; a.push(r); map.set(r.layer, a) }
  const byLayer = [...map.entries()].map(([layer, a]) => {
    const passed = a.filter(x => x.pass).length
    const pct = Math.round((passed / a.length) * 1000) / 10
    return { layer, passed, total: a.length, pct, threshold: THRESHOLD[layer], ok: pct >= THRESHOLD[layer] }
  }).sort((x, y) => y.total - x.total)
  const passed = rows.filter(r => r.pass).length
  return { rows, byLayer, total: rows.length, pct: Math.round((passed / rows.length) * 100), failures: rows.filter(r => !r.pass) }
}

export { THRESHOLD }
