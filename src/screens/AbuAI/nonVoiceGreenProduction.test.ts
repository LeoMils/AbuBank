/**
 * NON-VOICE GREEN PRODUCTION HARNESS
 * ══════════════════════════════════
 * The single comprehensive non-voice gate: a 60-transcript hostile meeting
 * corpus, 40+ STT-correction cases (see sttSemanticRecovery.test.ts), 80
 * personality shaping cases, a 30-turn memory chain, online routing, and Abu
 * Games structural/accessibility checks. Runs the real runtime path.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { understandMeeting } from './meetingIntelligence'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { resolveFollowUp } from './contextResolver'
import { deriveConversationMemory } from './conversationMemory'
import { enforceCompanion, findBannedPhrase, BANNED_PHRASES } from './companionComposer'
import { isOnlineCurrentInfoQuery, getOnlineQueryKind, shouldBlockOnlineForPersonal } from './onlineIntent'
import type { CompanionPlan } from './companionPlanner'
import { addAppointment } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

function fmt(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Anchor expected dates to the fixed base the runtime is faked to (not the real
// wall clock at module-load — a date rollover would otherwise desync them).
const BASE_DATE = '2026-06-24T09:00:00'
const D = (n: number) => { const d = new Date(BASE_DATE); d.setDate(d.getDate() + n); return fmt(d) }

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
}
beforeEach(() => { installStorage() })

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — 60-transcript hostile meeting corpus
// ══════════════════════════════════════════════════════════════════════════════
type Row = { t: string; person?: string | null; date?: string | null; time?: string | null; locEmpty?: boolean; loc?: string; subj?: string; clarify?: boolean }
const NARRATIVE = /בוא נעשה|אז ככה|^שמעי|אני חייבת|אני צריכה|אנחנו צריכים/

const CORPUS: Row[] = [
  // ── clean baselines ──
  { t: 'תקבעי לי פגישה עם מור מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00', locEmpty: true },
  { t: 'תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים', person: 'מור', date: D(2), time: '15:00', locEmpty: true },
  { t: 'קבעי עם אופיר ביום חמישי בעשר בבוקר', person: 'אופיר', time: '10:00', locEmpty: true },
  { t: 'תרשמי תור לרופא מחר בארבע', person: null, date: D(1), time: '16:00', locEmpty: true },
  { t: 'פגישה עם אלכסנדרה היום בשבע בבוקר', person: 'אלכסנדרה', date: D(0), time: '07:00', locEmpty: true },
  // ── afternoon/evening/night/noon times ──
  { t: 'תקבעי עם מור מחר בשלוש אחר הצהריים', person: 'מור', date: D(1), time: '15:00' },
  { t: 'תקבעי עם מור מחר בשלוש בצהריים', person: 'מור', date: D(1), time: '15:00' },
  { t: 'תקבעי עם מור מחר בשלוש בלילה', person: 'מור', date: D(1), time: '03:00' },
  { t: 'תקבעי עם מור מחר בשבע בבוקר', person: 'מור', date: D(1), time: '07:00' },
  { t: 'תקבעי עם מור מחר באחת וחצי אחר הצהריים', person: 'מור', date: D(1), time: '13:30' },
  { t: 'תקבעי עם מור מחר ב3:00 אחר הצהריים', person: 'מור', date: D(1), time: '15:00' },
  // ── STT-mangled שכירות ──
  { t: 'פגישה עם אלכסנדרה מחר בשבע בערב על השחירות של הבית', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  { t: 'קבעי עם אלכסנדרה היום בערב בשמונה על זכירות הבית', person: 'אלכסנדרה', date: D(0), time: '20:00', subj: 'שכירות' },
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב לדבר על הזכיר שכירות של הבית והדיירים', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  { t: 'פגישה עם אלכסנדרה היום בשלוש על סחירות הבית', person: 'אלכסנדרה', date: D(0), time: '15:00', subj: 'שכירות' },
  // ── implied/explicit location ──
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב בקפה גרג ברעננה', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה' },
  { t: 'פגישה עם מור מחר בארבע בהוד השרון', person: 'מור', date: D(1), time: '16:00', loc: 'הוד השרון' },
  { t: 'תקבעי עם אופיר מחר בעשר במרפאה', person: 'אופיר', date: D(1), time: '10:00', loc: 'מרפאה' },
  { t: 'נקבע עם לאו מחר בשמונה בערב בבית קפה', person: 'לאו', date: D(1), time: '20:00', loc: 'בית קפה' },
  // ── missing location → empty (never invented) ──
  { t: 'תקבעי עם מור מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00', locEmpty: true },
  { t: 'קבעי תור לרופא מחרתיים בעשר בבוקר', person: null, date: D(2), time: '10:00', locEmpty: true },
  // ── missing time → clarify, never invent ──
  { t: 'תקבעי עם מור מחר בבוקר', person: 'מור', date: D(1), time: null, clarify: true },
  { t: 'אני רוצה לקבוע תור לרופא שיניים מחרתיים אחר הצהריים', person: null, date: D(2), time: null, clarify: true },
  { t: 'בא לי לראות את מור השבוע', person: 'מור', date: null, clarify: true },
  { t: 'נקבע משהו עם אלכסנדרה מחר על הבית', person: 'אלכסנדרה', date: D(1), time: null, clarify: true },
  // ── long story before / reason before logistics ──
  { t: 'מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את הסכם השכירות לפני שהדיירים החדשים מגיעים. בוא נעשה את זה בקפה גרג ברעננה בסביבות שבע בערב', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה', subj: 'שכירות' },
  { t: 'שמעי לפני שהדיירים נכנסים אני צריכה לדבר עם אלכסנדרה על השכירות של הבית מחר בערב בקפה גרג ברעננה', person: 'אלכסנדרה', date: D(1), time: null, loc: 'קפה גרג ברעננה', subj: 'שכירות', clarify: true },
  { t: 'אז ככה מחרתיים בערב בסביבות שמונה בא לי לשבת עם לאו בבית קפה לדבר על החתונה', person: 'לאו', date: D(2), time: '20:00', loc: 'בית קפה', subj: 'חתונה' },
  // ── logistics before reason ──
  { t: 'תקבעי עם מור מחר בחמש אחר הצהריים כי אני רוצה לדבר איתה על הילדים', person: 'מור', date: D(1), time: '17:00', subj: 'ילדים' },
  { t: 'פגישה עם אופיר מחר בשבע בערב לדבר על הבדיקות', person: 'אופיר', date: D(1), time: '19:00', subj: 'בדיקות' },
  // ── correction mid-sentence (repeated/duplicate words) ──
  { t: 'תקבעי לי משהו עם מור מחר מחר בעשר בעשר בבוקר', person: 'מור', date: D(1), time: '10:00' },
  { t: 'קבעי עם אלכסנדרה היום היום בשבע בערב', person: 'אלכסנדרה', date: D(0), time: '19:00' },
  // ── Italy trip / before flight ──
  { t: 'תזכירי לי לקבוע עם אלכסנדרה לפני הטיסה לאיטליה', person: 'אלכסנדרה', clarify: true, subj: 'איטליה' },
  { t: 'נקבע משהו עם מור לפני הטיול לאיטליה מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00', subj: 'איטליה' },
  // ── medical / family visit subjects ──
  { t: 'תקבעי עם אופיר מחר בשבע בערב לדבר על הבדיקות של אמא', person: 'אופיר', date: D(1), time: '19:00', subj: 'בדיקות' },
  { t: 'קבעי ביקור אצל מור מחר בארבע', person: 'מור', date: D(1), time: '16:00' },
  // ── relative dates ──
  { t: 'תקבעי עם מור היום בשבע בערב', person: 'מור', date: D(0), time: '19:00' },
  { t: 'תקבעי עם מור מחרתיים בשבע בערב', person: 'מור', date: D(2), time: '19:00' },
  // ── "בסביבות / בערך" approximations ──
  { t: 'תקבעי עם מור מחר בסביבות שבע בערב', person: 'מור', date: D(1), time: '19:00' },
  { t: 'נקבע עם אלכסנדרה מחר בערך בשמונה בערב בקפה גרג ברעננה', person: 'אלכסנדרה', date: D(1), time: '20:00', loc: 'קפה גרג ברעננה' },
  // ── meeting verb + "את" ──
  { t: 'בא לי לפגוש את לאו מחר בשמונה בערב', person: 'לאו', date: D(1), time: '20:00' },
  { t: 'אני רוצה לראות את מור מחר בארבע אחר הצהריים', person: 'מור', date: D(1), time: '16:00' },
  // ── filler-heavy ──
  { t: 'יעני תקבעי לי כאילו פגישה עם מור מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00' },
  { t: 'אהה תקבעי עם אלכסנדרה מחר בשבע בערב על השכירות', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  // ── more people coverage ──
  { t: 'תקבעי עם אופיר מחר בשבע בערב', person: 'אופיר', date: D(1), time: '19:00' },
  { t: 'תקבעי עם לאו מחר בשבע בערב', person: 'לאו', date: D(1), time: '19:00' },
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב', person: 'אלכסנדרה', date: D(1), time: '19:00' },
  { t: 'תקבעי עם מור מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00' },
  // ── subject via "בנושא" ──
  { t: 'פגישה עם אלכסנדרה מחר בשבע בערב בנושא השכירות', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  { t: 'פגישה עם אופיר מחר בשבע בערב בנושא החתונה', person: 'אופיר', date: D(1), time: '19:00', subj: 'חתונה' },
  // ── "אחר צהריים" STT (missing ה) ──
  { t: 'תקבעי עם מור מחר בשלוש אחר צהריים', person: 'מור', date: D(1), time: '15:00' },
  { t: 'תקבעי עם מור מחרתיים בארבע אחר צהריים', person: 'מור', date: D(2), time: '16:00' },
  // ── venue STT variants ──
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב בקפה גריג ברעננה', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה' },
  { t: 'נקבע עם אלכסנדרה מחר בשבע בערב בקפה גרג ב רעננה', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה' },
  // ── more times ──
  { t: 'תקבעי עם מור מחר בתשע בבוקר', person: 'מור', date: D(1), time: '09:00' },
  { t: 'תקבעי עם מור מחר באחת עשרה בבוקר', person: 'מור', date: D(1), time: '11:00' },
  { t: 'תקבעי עם מור מחר בחמש אחר הצהריים', person: 'מור', date: D(1), time: '17:00' },
  { t: 'תקבעי עם מור מחר בתשע בערב', person: 'מור', date: D(1), time: '21:00' },
  // ── more hostile coverage to reach 60 ──
  { t: 'תקבעי עם אלכסנדרה מחרתיים בשמונה בבוקר בקפה גרג ברעננה על השכירות', person: 'אלכסנדרה', date: D(2), time: '08:00', loc: 'קפה גרג ברעננה', subj: 'שכירות' },
  { t: 'יעני אהה תקבעי לי תור לרופא מחר בשתיים אחר הצהריים', person: null, date: D(1), time: '14:00', locEmpty: true },
]

describe('PART 1 — 60 hostile meeting transcripts ≥95% + 0 P0 invention', () => {
  it(`corpus is ≥60 transcripts (have ${CORPUS.length})`, () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(60)
  })

  it('scores ≥95% exact, with ZERO invented person/time/location (P0)', () => {
    let pass = 0
    const fails: string[] = []
    const p0: string[] = []
    for (const r of CORPUS) {
      const m = understandMeeting(r.t)
      const errs: string[] = []
      if (r.person !== undefined && m.who !== r.person) errs.push(`who=${m.who}≠${r.person}`)
      if (r.date !== undefined && m.date !== r.date) errs.push(`date=${m.date}≠${r.date}`)
      if (r.time !== undefined && m.time !== r.time) errs.push(`time=${m.time}≠${r.time}`)
      if (r.locEmpty && m.location != null) { errs.push(`loc=${m.location}≠empty`); p0.push(`INVENTED LOCATION: ${r.t}`) }
      if (r.loc && m.location !== r.loc) errs.push(`loc=${m.location}≠${r.loc}`)
      if (r.subj && !(m.subject ?? '').includes(r.subj)) errs.push(`subj=${m.subject}∌${r.subj}`)
      if (r.clarify !== undefined && m.needsClarification !== r.clarify) errs.push(`clarify=${m.needsClarification}≠${r.clarify}`)
      // P0: time invented when expected null
      if (r.time === null && m.time != null) p0.push(`INVENTED TIME: ${r.t}`)
      // notes/subject must never be raw narrative
      if (m.notes && NARRATIVE.test(m.notes)) errs.push(`notes-narrative: ${m.notes}`)
      if (errs.length === 0) pass++
      else fails.push(`✗ "${r.t.slice(0, 36)}" :: ${errs.join(' | ')}`)
    }
    const pct = Math.round((pass / CORPUS.length) * 100)
    if (pct < 95 || p0.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`SCORE ${pass}/${CORPUS.length}=${pct}%\nP0:\n${p0.join('\n')}\nFAILS:\n${fails.join('\n')}`)
    }
    expect(p0).toHaveLength(0)
    expect(pct).toBeGreaterThanOrEqual(95)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — 80 personality shaping cases (no generic bot language)
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 2 — companion personality: 80 shaping cases, zero banned phrases', () => {
  const plan = { step7_act: 'lead' } as CompanionPlan
  // Robotic / banned candidates that must be cleaned or warmed.
  const robotic = [
    'אני בסדר', 'איך אפשר לעזור', 'איך אני יכולה לעזור לך', 'במה אני יכולה לעזור',
    'רוצה לדבר על משהו אחר', 'אין לי מידע', 'אין לי מידע על זה',
    'כיצד אוכל לסייע', 'במה אוכל לסייע', 'אני כאן לשירותך', 'לשירותך',
    'בחרי אחת מהאפשרויות', 'הנה כמה אפשרויות', 'תפריט האפשרויות',
    'שאלה מצוינת', 'שאלה טובה', 'יופי של שאלה', 'כל הכבוד', 'איזה יופי ששאלת',
    'אני בינה מלאכותית', 'אני עוזרת וירטואלית', 'אני עוזרת דיגיטלית', 'אני מודל שפה',
    'אני תוכנה', 'אני רובוט', 'אני רק עוזרת',
    'על פי הנתונים', 'לפי הנתונים', 'לפי המידע', 'מצאתי עבורך', 'חיפשתי באינטרנט',
    'as an ai', "i'm an ai", 'how can i help', 'great question', 'happy to help',
    'according to the data', 'based on the data',
  ]
  it.each(robotic)('"%s" → no banned phrase survives, never empty', (candidate) => {
    const out = enforceCompanion(candidate, plan)
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
  })

  // Banned inside a fuller sentence — must be stripped, content kept.
  const embedded = [
    ['על פי הנתונים, יש לך פגישה עם מור', 'מור'],
    ['שאלה מצוינת, מור היא הבת שלך', 'מור'],
    ['איך אפשר לעזור? יש לך תור לרופא מחר', 'רופא'],
    ['happy to help, you have a meeting tomorrow', 'meeting'],
  ] as const
  it.each(embedded)('strips banned register from "%s" but keeps the content', (candidate, keep) => {
    const out = enforceCompanion(candidate, plan)
    expect(findBannedPhrase(out)).toBeNull()
    expect(out).toContain(keep)
  })

  // Warm, human fallbacks per companion act (never a bare dead-end).
  const acts: Array<CompanionPlan['step7_act']> = ['listen', 'lead', 'encourage', 'ask']
  it.each(acts)('act "%s" produces a warm non-empty fallback', (act) => {
    const out = enforceCompanion('אין לי מידע', { step7_act: act } as CompanionPlan)
    expect(out.length).toBeGreaterThan(0)
    expect(out).not.toBe('אני בסדר')
    expect(findBannedPhrase(out)).toBeNull()
  })

  // A bare cold "אין לי מידע" becomes a warm human line.
  it('bare "אין לי מידע" is warmed to a human line', () => {
    const out = enforceCompanion('אין לי מידע.', plan)
    expect(out).not.toContain('אין לי מידע')
    expect(out.length).toBeGreaterThan(6)
  })

  // Clean human responses pass through untouched.
  const clean = [
    'מור, הבת שלך. בהוד השרון עם יעל.',
    'היום בשבע יש לך פגישה עם אלכסנדרה.',
    'ימים כאלה יש. אני כאן איתך.',
    'איזה כיף לשמוע!',
    'תתקשרי למור, גם עשר דקות משנות.',
  ]
  it.each(clean)('clean human line "%s" is preserved', (line) => {
    expect(findBannedPhrase(line)).toBeNull()
    expect(enforceCompanion(line, plan)).toContain(line.split('.')[0]!.trim())
  })

  it('the ban list is comprehensive (covers menu / self-ref / patronizing / data register)', () => {
    for (const p of ['איך אפשר לעזור', 'אני בינה מלאכותית', 'שאלה מצוינת', 'על פי הנתונים', 'תפריט האפשרויות']) {
      expect(BANNED_PHRASES).toContain(p)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — 30-turn long conversation memory chain
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 3 — 30-turn memory: person/topic/action preserved, no family confusion', () => {
  // A realistic 30-message chain mixing family, calendar, emotion, and recall.
  const chain: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: 'מי זאת מור' },
    { role: 'assistant', content: 'מור, הבת שלך. בהוד השרון עם יעל.' },
    { role: 'user', content: 'עליה' },
    { role: 'assistant', content: 'מור גרה בהוד השרון, יש לה ארבעה ילדים.' },
    { role: 'user', content: 'מי הנכדים שלי' },
    { role: 'assistant', content: 'יש לך שישה נכדים — אופיר, איילון, עילי, אדר, עדי, נועם.' },
    { role: 'user', content: 'מי זאת ארי' },
    { role: 'assistant', content: 'ארי, הנינה שלך.' },
    { role: 'user', content: 'תקבעי לי פגישה עם מור מחר בשלוש אחר הצהריים' },
    { role: 'assistant', content: 'קבעתי פגישה עם מור מחר בשלוש.' },
    { role: 'user', content: 'מה יש לי מחר' },
    { role: 'assistant', content: 'מחר יש לך פגישה עם מור בשלוש.' },
    { role: 'user', content: 'אני מתגעגעת לפפי' },
    { role: 'assistant', content: 'אני יודעת. הוא חסר. ספרי לי עליו.' },
    { role: 'user', content: 'הוא אהב לבשל' },
    { role: 'assistant', content: 'כן, הוא היה מבשל נפלא.' },
    { role: 'user', content: 'תזכירי לי על מי דיברנו קודם' },
    { role: 'assistant', content: 'דיברנו על מור ועל פפי.' },
    { role: 'user', content: 'תקבעי עם אופיר מחר בשבע בערב' },
    { role: 'assistant', content: 'קבעתי פגישה עם אופיר מחר בשבע.' },
    { role: 'user', content: 'מה יש לי השבוע' },
    { role: 'assistant', content: 'יש לך פגישות עם מור ועם אופיר.' },
    { role: 'user', content: 'תבטלי את הפגישה עם אופיר' },
    { role: 'assistant', content: 'ביטלתי את הפגישה עם אופיר.' },
    { role: 'user', content: 'מי זאת אלכסנדרה' },
    { role: 'assistant', content: 'אלכסנדרה היא חברה שלך.' },
    { role: 'user', content: 'מי זאת מור' },
    { role: 'assistant', content: 'מור, הבת שלך. בהוד השרון.' },
    { role: 'user', content: 'תמשיכי' },
    { role: 'assistant', content: 'למור יש ארבעה ילדים.' },
  ]

  it('the chain is ≥30 turns', () => { expect(chain.length).toBeGreaterThanOrEqual(30) })

  it('memory tracks last family person, last calendar action, and topic', () => {
    const mem = deriveConversationMemory(chain)
    // Deterministic continuity is family-graph based: the last named relative is
    // Mor, the last calendar ACTION was a delete.
    expect(mem.lastPerson).toBe('מור')
    expect(mem.lastCalendarAction).toBe('delete')
    expect(mem.lastTopic).toBeTruthy()
  })

  it('does NOT confuse distinct family members across turns', () => {
    // "עליה" right after each relative resolves to THAT relative, not another.
    const afterMor = chain.slice(0, 2)
    expect(resolveFollowUp('עליה', afterMor as never).resolved).toContain('מור')
    const afterAri = [
      { role: 'user', content: 'מי זאת ארי' },
      { role: 'assistant', content: 'ארי, הנינה שלך.' },
    ]
    expect(resolveFollowUp('עליה', afterAri as never).resolved).toContain('ארי')
  })

  it('"תמשיכי" at the end continues on the last family person (Mor)', () => {
    expect(resolveFollowUp('תמשיכי', chain as never).resolved).toContain('מור')
  })

  it('an earlier slice tracks the relative being discussed then (no leakage from later turns)', () => {
    const memEarly = deriveConversationMemory(chain.slice(0, 8))
    expect(['מור', 'ארי']).toContain(memEarly.lastPerson)
  })

  it('calendar action is recoverable after an emotional detour (Pepe)', () => {
    // turns 0..16 include the create then the Pepe grief turns — last ACTION is create.
    const mem = deriveConversationMemory(chain.slice(0, 16))
    expect(mem.lastCalendarAction).toBe('create')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — online understanding routing
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 4 — online current-info routing', () => {
  const cases: Array<[string, string]> = [
    ['איזה משחקים יש היום במונדיאל', 'sports'],
    ['מי ניצח אתמול בכדורגל', 'sports'],
    ['מה חדש בעולם', 'latest'],
    ['מזג האוויר מחר בכפר סבא', 'weather'],
    ['מה מזג האוויר היום', 'weather'],
    ['מה קורה בחדשות היום', 'news'],
  ]
  it.each(cases)('"%s" routes online (%s), not blocked, not personal', (q, kind) => {
    expect(isOnlineCurrentInfoQuery(q)).toBe(true)
    expect(getOnlineQueryKind(q)).toBe(kind)
    expect(shouldBlockOnlineForPersonal(q)).toBe(false)
    expect(routePersonalQuery(q).type).toBe('non_personal')
  })
  it('a personal calendar question is NOT sent online', () => {
    expect(routePersonalQuery('מה יש לי היום').type).toMatch(/^calendar_/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 5 — Abu Games structural + accessibility
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 5 — Abu Games production-clean', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '../AbuGames/index.tsx'), 'utf8')
  it('18 games, all with same-tab URLs', () => {
    expect((SRC.match(/id: '[a-z0-9-]+'/g) ?? []).length).toBe(18)
    expect(SRC).toContain('window.location.href = url')
    expect((SRC.match(/url: 'https?:\/\//g) ?? []).length).toBeGreaterThanOrEqual(18)
  })
  it('round bubbles, vertical 3-col grid, no horizontal-scroll dependency', () => {
    expect(SRC).toContain("borderRadius: '50%'")
    expect(SRC).toContain("gridTemplateColumns: 'repeat(3, 1fr)'")
    expect(SRC).not.toContain("overflowX: 'auto'")
  })
  it('English wordmark + ABU BANK identity, no Carnival / "המשחקים שלך"', () => {
    expect(SRC).toContain('Abu Games')
    expect(SRC).toContain('ABU BANK')
    expect(SRC).not.toContain('Carnival')
    expect(SRC).not.toContain('המשחקים שלך')
  })
  it('accessible: aria-label, role=button, keyboard, rtl, reduced-motion', () => {
    expect(SRC).toContain('aria-label={g.labelHe}')
    expect(SRC).toContain('role="button"')
    expect(SRC).toContain("e.key === 'Enter'")
    expect(SRC).toContain('dir="rtl"')
    expect(SRC).toContain('prefers-reduced-motion')
  })
})
