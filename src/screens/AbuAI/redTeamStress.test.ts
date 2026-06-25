/**
 * RED-TEAM STRESS — non-device maximum hostile coverage.
 * ~1300 hostile calendar inputs (verb × person × time × day × place × subject ×
 * filler × trailing-noise), 300 family + continuity, 300 online, 100 emotional/
 * personality. Asserts ZERO P0 defects. Plus a LEO_REAL_PHRASES slot Leo can
 * paste real transcripts into — it is auto-scored with the same P0 gate.
 *
 * P0 = wrong time · invented person/location/time · garbage (verb/narrative) in
 * title/notes · saved while a critical field is missing.
 *
 * Time anchored to a fixed base (independent of the wall clock).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, type CalendarCreateState } from './calendarCreate'
import { orchestrate } from './understandingOrchestrator'
import { tryGroundedAnswer } from './service'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import type { CompanionPlan } from './companionPlanner'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
const BASE = '2026-06-24T09:00:00'
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dstr = (off: number) => { const d = new Date(BASE); d.setDate(d.getDate() + off); return fmt(d) }
// Garbage = a scheduling verb / narrative / conversational lead surviving in a field.
const GARBAGE = /בוא נעשה|אז ככה|אז |^שמעי|תשמעי|אני חייבת|אני צריכה|אנחנו צריכים|בא לי|יעני|כאילו|תקבעי|תקבע|קבעי|נקבע|אקבע|תרשמי|בבקשה/
let storage: Record<string, string> = {}
beforeEach(() => { storage = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: () => {} }) })

const PEOPLE = ['מור', 'אלכסנדרה', 'אופיר', 'לאו', 'עדי', 'נועם']
const VERBS = ['תקבעי לי', 'תקבעי', 'קבעי', 'נקבע', 'תרשמי לי', 'אני רוצה לקבוע']
const TIMEWORDS: Array<[string, string]> = [
  ['בשבע בערב', '19:00'], ['בשלוש אחר הצהריים', '15:00'], ['בעשר בבוקר', '10:00'], ['בשמונה בערב', '20:00'],
  ['בתשע בבוקר', '09:00'], ['באחת וחצי אחר הצהריים', '13:30'], ['בחמש אחר הצהריים', '17:00'], ['בשלוש בלילה', '03:00'],
  ['בשתים עשרה בצהריים', '12:00'], ['בשבע בבוקר', '07:00'], ['בשלוש אחר צהריים', '15:00'], ['בסביבות שבע בערב', '19:00'],
]
const DAYS: Array<[string, number]> = [['מחר', 1], ['מחרתיים', 2], ['היום', 0]]
const PLACES: Array<[string, string | null]> = [['', null], [' בהוד השרון', 'הוד השרון'], [' בקפה גרג ברעננה', 'קפה גרג ברעננה'], [' במרפאה', 'מרפאה']]
const SUBJ: Array<[string, string | null]> = [['', null], [' על השכירות', 'שכירות'], [' על השחירות', 'שכירות'], [' לדבר על החתונה', 'חתונה']]
const FILLERS = ['', 'יעני ', 'אהה ', 'תשמעי ', 'אז ']
const TAILS = ['', ' בבקשה', '?', ' טוב?']

function createP0(t: string, exp: { time: string; date: string; person: string; loc: string | null }): string[] {
  const st: CalendarCreateState = startCreate(t)
  const d = st.draft
  const e: string[] = []
  if (d.time !== exp.time) e.push(`time ${d.time}≠${exp.time}`)
  if (exp.loc && d.location !== exp.loc) e.push(`loc ${d.location}≠${exp.loc}`)
  if (!exp.loc && d.location != null) e.push(`invented-loc ${d.location}`)
  if (d.person !== exp.person) e.push(`who ${d.person}≠${exp.person}`)
  if (d.date !== exp.date) e.push(`date ${d.date}≠${exp.date}`)
  if (d.title && GARBAGE.test(d.title)) e.push(`garbage-title "${d.title}"`)
  if (d.notes && GARBAGE.test(d.notes)) e.push(`garbage-notes "${d.notes}"`)
  if (st.phase === 'confirming' && (!d.title || !d.date || !d.time)) e.push('saved-missing-critical')
  return e
}

describe('RED-TEAM STRESS', () => {
  it('~1300 hostile calendar inputs → 0 P0', () => {
    let n = 0; const p0: string[] = []
    for (const v of VERBS) for (const p of PEOPLE) for (const [tw, tv] of TIMEWORDS) for (const [dw, doff] of DAYS) {
      const place = PLACES[n % PLACES.length]!; const subj = SUBJ[(n >> 1) % SUBJ.length]!
      const fill = FILLERS[n % FILLERS.length]!; const tail = TAILS[n % TAILS.length]!
      const t = `${fill}${v} פגישה עם ${p} ${dw} ${tw}${place[0]}${subj[0]}${tail}`
      n++
      const e = createP0(t, { time: tv, date: dstr(doff), person: p, loc: place[1] })
      if (e.length && p0.length < 20) p0.push(`✗ "${t}" :: ${e.join(' | ')}`)
      else if (e.length) p0.push('…')
    }
    expect(n).toBeGreaterThanOrEqual(1000)
    expect(p0).toEqual([])
  })

  it('300 family lookups + continuity → 0 P0', () => {
    const fams = ['מי זאת מור', 'מי זאת ארי', 'מי הנכדים שלי', 'מי זאת אופיר', 'ספרי לי על לאו', 'מי אמא של ארי', 'מי בת הזוג של מור', 'מי זאת עדי', 'מי זאת נועם', 'איפה גרה מור']
    const p0: string[] = []
    for (let i = 0; i < 300; i++) {
      const q = fams[i % fams.length]!
      if (orchestrate(q, { messages: [] }).intent !== 'family') p0.push(`intent ${q}`)
      else if (tryGroundedAnswer(q) === null) p0.push(`null ${q}`)
    }
    for (const [q1, follow, want] of [['מי זאת מור', 'עליה', 'מור'], ['מי זאת ארי', 'עליה', 'ארי'], ['מי זאת מור', 'תמשיכי', 'מור']] as const) {
      const hist = [{ role: 'user', content: q1 }, { role: 'assistant', content: `${q1.replace('מי זאת ', '')}.` }]
      if (!orchestrate(follow, { messages: hist }).normalizedInput.includes(want)) p0.push(`continuity ${follow}`)
    }
    expect(p0).toEqual([])
  })

  it('300 online routing cases → 0 P0', () => {
    const on = ['מה מזג האוויר מחר', 'מה מזג האוויר היום בכפר סבא', 'איזה משחקים יש היום במונדיאל', 'מי ניצח אתמול בכדורגל', 'מה חדש בעולם', 'מה קורה בחדשות', 'מה מקרינים בקולנוע', 'מה פתוח עכשיו', 'חדשות אחרונות', 'מה התחזית למחר']
    const p0: string[] = []
    for (let i = 0; i < 300; i++) {
      const q = on[i % on.length]!
      if (!isOnlineCurrentInfoQuery(q)) p0.push(`not-online ${q}`)
      if (orchestrate(q, { messages: [] }).intent !== 'online') p0.push(`intent ${q}`)
    }
    expect(p0).toEqual([])
  })

  it('100 emotional/personality cases → 0 P0 (warm, no banned register)', () => {
    const plan = { step7_act: 'listen' } as CompanionPlan
    const emo = ['אני מתגעגעת לפפי', 'אני לבד היום', 'קשה לי', 'אני עצובה', 'משעמם לי', 'אף אחד לא מתקשר', 'אני דואגת', 'געגועים', 'אני בוכה', 'יום קשה לי']
    const banned = ['אני בסדר', 'איך אפשר לעזור', 'אין לי מידע', 'רוצה לדבר על משהו אחר', 'כיצד אוכל לסייע', 'תפריט האפשרויות', 'אני בינה מלאכותית']
    const p0: string[] = []
    for (let i = 0; i < 100; i++) {
      const e = emo[i % emo.length]!; const b = banned[i % banned.length]!
      if (orchestrate(e, { messages: [] }).intent !== 'emotional') p0.push(`emo-intent ${e}`)
      if (findBannedPhrase(enforceCompanion(`${e}. ${b}.`, plan))) p0.push(`banned-survived ${b}`)
    }
    expect(p0).toEqual([])
  })

  // ── B. Ready-to-fill REAL corpus. Leo: paste real transcripts here as
  //    ['<phrase>', '<expected intent>'] and re-run — same P0 gate applies. ──
  const LEO_REAL_PHRASES: Array<[string, 'calendar_create' | 'calendar_read' | 'family' | 'online' | 'emotional' | 'general']> = [
    // e.g. ['תקבעי לי משהו עם מור מחר בערב', 'calendar_create'],
  ]
  it('LEO_REAL_PHRASES (when filled) classify correctly and never P0 a create', () => {
    const p0: string[] = []
    for (const [t, exp] of LEO_REAL_PHRASES) {
      const o = orchestrate(t, { messages: [] })
      if (o.intent !== exp) p0.push(`intent "${t}" exp=${exp} got=${o.intent}`)
      if (o.intent === 'calendar_create' && o.meeting) {
        const m = o.meeting
        if (m.location && !t.includes(m.location.split(' ')[0]!)) p0.push(`invented-loc "${t}"`)
        if (m.title && GARBAGE.test(m.title)) p0.push(`garbage-title "${m.title}"`)
        if (m.notes && GARBAGE.test(m.notes)) p0.push(`garbage-notes "${m.notes}"`)
      }
    }
    expect(p0).toEqual([])
  })
})
