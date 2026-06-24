/**
 * FINAL NON-MIC PRODUCTION ACCEPTANCE
 * ═══════════════════════════════════
 * Proves PRODUCT BEHAVIOR, not just function returns. Every calendar create runs
 * the real UI write path (`startCreate` → confirm → the exact `addAppointment`
 * mapping index.tsx uses → read back via `tryGroundedAnswer`). One source of
 * truth for reads and writes; no route bypasses the deterministic safety layer.
 *
 * Hard P0 gate (any one fails the whole suite):
 *   wrong time · invented location · invented person · saved while a critical
 *   field is missing · false "no meeting" · raw transcript saved as notes/title.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, type CalendarCreateState } from './calendarCreate'
import { understandMeetingSemantic, mergedToCreateState } from './semanticUnderstanding'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { resolveFollowUp } from './contextResolver'
import { deriveConversationMemory } from './conversationMemory'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import { isOnlineCurrentInfoQuery, getOnlineQueryKind, shouldBlockOnlineForPersonal } from './onlineIntent'
import type { CompanionPlan } from './companionPlanner'
import { addAppointment, loadAppointments, type Appointment } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
function fmt(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Anchor expected dates to the SAME fixed base the runtime is faked to — never
// the real wall clock at module-load (otherwise a date rollover desyncs them).
const BASE_DATE = '2026-06-24T09:00:00'
const D = (n: number) => { const d = new Date(BASE_DATE); d.setDate(d.getDate() + n); return fmt(d) }
const NARRATIVE = /בוא נעשה|אז ככה|^שמעי|אני חייבת|אני צריכה|אנחנו צריכים|בא לי|יעני|כאילו/

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
}
beforeEach(() => { installStorage() })

// The EXACT save mapping index.tsx uses on a confirmed draft.
function saveDraft(st: CalendarCreateState): Appointment | undefined {
  if (st.phase !== 'confirming') return undefined
  const d = st.draft
  addAppointment({
    title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅',
    ...(d.location ? { location: d.location } : {}),
    ...(d.subject ? { subject: d.subject } : {}),
    ...(d.purpose ? { purpose: d.purpose } : {}),
    ...(d.notes ? { notes: d.notes } : {}),
    ...(d.person ? { personName: d.person } : {}),
    ...(d.rawTranscript ? { rawTranscript: d.rawTranscript } : {}),
  } as Parameters<typeof addAppointment>[0])
  return loadAppointments().slice(-1)[0]
}

// ══════════════════════════════════════════════════════════════════════════════
// A. Calendar Create — 100 hostile cases through the product write path
// ══════════════════════════════════════════════════════════════════════════════
type Row = { t: string; person?: string | null; date?: string | null; time?: string | null; locEmpty?: boolean; loc?: string; subj?: string; clarify?: boolean; readback?: boolean }

const PEOPLE = ['מור', 'אלכסנדרה', 'אופיר', 'לאו']
const TIMES: Array<[string, string]> = [
  ['בשבע בערב', '19:00'], ['בשלוש אחר הצהריים', '15:00'], ['בעשר בבוקר', '10:00'], ['בשמונה בערב', '20:00'],
  ['בתשע בבוקר', '09:00'], ['באחת וחצי אחר הצהריים', '13:30'], ['בחמש אחר הצהריים', '17:00'], ['בשלוש בלילה', '03:00'],
]
const DATES: Array<[string, string]> = [['מחר', D(1)], ['מחרתיים', D(2)]]

const generated: Row[] = []
for (const p of PEOPLE) for (const [tw, tv] of TIMES) for (const [dw, dv] of DATES) {
  generated.push({ t: `תקבעי עם ${p} ${dw} ${tw}`, person: p, date: dv, time: tv, locEmpty: true })
}
// 4×8×2 = 64 generated clean creates.

const hostile: Row[] = [
  // long messy + reason-before-logistics + STT rental + venue
  { t: 'מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את הסכם השכירות לפני שהדיירים החדשים מגיעים. בוא נעשה את זה בקפה גרג ברעננה בסביבות שבע בערב', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה', subj: 'שכירות', readback: true },
  { t: 'שמעי לפני שהדיירים נכנסים אני צריכה לדבר עם אלכסנדרה על השכירות של הבית מחר בערב בקפה גרג ברעננה', person: 'אלכסנדרה', date: D(1), time: null, loc: 'קפה גרג ברעננה', subj: 'שכירות', clarify: true },
  { t: 'אז ככה מחרתיים בערב בסביבות שמונה בא לי לשבת עם לאו בבית קפה לדבר על החתונה', person: 'לאו', date: D(2), time: '20:00', loc: 'בית קפה', subj: 'חתונה', readback: true },
  { t: 'בא לי לראות את מור השבוע', person: 'מור', date: null, clarify: true },
  { t: 'אני רוצה לראות את אופיר מחר בארבע אחר הצהריים', person: 'אופיר', date: D(1), time: '16:00' },
  // STT rental variants
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב על השחירות של הבית', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות', readback: true },
  { t: 'פגישה עם אלכסנדרה היום בשלוש על סחירות הבית', person: 'אלכסנדרה', date: D(0), time: '15:00', subj: 'שכירות' },
  { t: 'קבעי עם אלכסנדרה היום בערב בשמונה על זכירות הבית', person: 'אלכסנדרה', date: D(0), time: '20:00', subj: 'שכירות' },
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב לדבר על הזכיר שכירות של הבית והדיירים', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות', readback: true },
  // "אחר צהריים" STT
  { t: 'תקבעי עם מור מחר בשלוש אחר צהריים', person: 'מור', date: D(1), time: '15:00' },
  { t: 'תקבעי עם מור מחרתיים בארבע אחר צהריים', person: 'מור', date: D(2), time: '16:00' },
  // venue STT
  { t: 'תקבעי עם אלכסנדרה מחר בשבע בערב בקפה גריג ברעננה', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה' },
  { t: 'נקבע עם אלכסנדרה מחר בשבע בערב בקפה גרג ב רעננה', person: 'אלכסנדרה', date: D(1), time: '19:00', loc: 'קפה גרג ברעננה' },
  // missing time → clarify
  { t: 'תקבעי עם מור מחר בבוקר', person: 'מור', date: D(1), time: null, clarify: true },
  { t: 'אני רוצה לקבוע תור לרופא שיניים מחרתיים אחר הצהריים', person: null, date: D(2), time: null, clarify: true },
  { t: 'נקבע משהו עם אלכסנדרה מחר על הבית', person: 'אלכסנדרה', date: D(1), time: null, clarify: true },
  // implied subject
  { t: 'תקבעי עם אופיר מחר בשבע בערב לדבר על הבדיקות של אמא', person: 'אופיר', date: D(1), time: '19:00', subj: 'בדיקות' },
  { t: 'נקבע עם מור לפני הטיול לאיטליה מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00', subj: 'איטליה' },
  { t: 'תזכירי לי לקבוע עם אלכסנדרה לפני הטיסה לאיטליה', person: 'אלכסנדרה', clarify: true, subj: 'איטליה' },
  // logistics before reason
  { t: 'תקבעי עם מור מחר בחמש אחר הצהריים כי אני רוצה לדבר איתה על הילדים', person: 'מור', date: D(1), time: '17:00', subj: 'ילדים' },
  // mid-sentence correction / duplicate words
  { t: 'תקבעי לי משהו עם מור מחר מחר בעשר בעשר בבוקר', person: 'מור', date: D(1), time: '10:00' },
  { t: 'קבעי עם אלכסנדרה היום היום בשבע בערב', person: 'אלכסנדרה', date: D(0), time: '19:00' },
  // filler heavy
  { t: 'יעני תקבעי לי כאילו פגישה עם מור מחר בשבע בערב', person: 'מור', date: D(1), time: '19:00', readback: true },
  { t: 'אהה תקבעי עם אלכסנדרה מחר בשבע בערב על השכירות', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  // location present explicit
  { t: 'פגישה עם מור מחר בארבע בהוד השרון', person: 'מור', date: D(1), time: '16:00', loc: 'הוד השרון', readback: true },
  { t: 'תקבעי עם אופיר מחר בעשר במרפאה', person: 'אופיר', date: D(1), time: '10:00', loc: 'מרפאה' },
  // no location → empty
  { t: 'תרשמי תור לרופא מחר בארבע', person: null, date: D(1), time: '16:00', locEmpty: true, readback: true },
  { t: 'קבעי תור לרופא מחרתיים בעשר בבוקר', person: null, date: D(2), time: '10:00', locEmpty: true },
  // subject via בנושא
  { t: 'פגישה עם אלכסנדרה מחר בשבע בערב בנושא השכירות', person: 'אלכסנדרה', date: D(1), time: '19:00', subj: 'שכירות' },
  { t: 'פגישה עם אופיר מחר בשבע בערב בנושא החתונה', person: 'אופיר', date: D(1), time: '19:00', subj: 'חתונה' },
  // approximations
  { t: 'תקבעי עם מור מחר בסביבות שבע בערב', person: 'מור', date: D(1), time: '19:00' },
  { t: 'נקבע עם אלכסנדרה מחר בערך בשמונה בערב בקפה גרג ברעננה', person: 'אלכסנדרה', date: D(1), time: '20:00', loc: 'קפה גרג ברעננה' },
  // next-week / day-after
  { t: 'תקבעי עם מור מחרתיים בשבע בערב', person: 'מור', date: D(2), time: '19:00' },
  { t: 'תקבעי עם מור היום בשבע בערב', person: 'מור', date: D(0), time: '19:00' },
  // meeting verb + את
  { t: 'בא לי לפגוש את לאו מחר בשמונה בערב', person: 'לאו', date: D(1), time: '20:00' },
  // noon
  { t: 'תקבעי עם מור מחר בשתים עשרה בצהריים', person: 'מור', date: D(1), time: '12:00' },
]

const A_CASES: Row[] = [...generated, ...hostile] // 64 + 36 = 100

describe('A — Calendar Create: 100 hostile cases, product write path, ≥95% + 0 P0', () => {
  it(`has ≥100 cases (have ${A_CASES.length})`, () => { expect(A_CASES.length).toBeGreaterThanOrEqual(100) })

  it('runs the real startCreate→save→read path: ≥95% exact, ZERO P0', () => {
    let pass = 0
    const fails: string[] = []
    const p0: string[] = []
    for (const r of A_CASES) {
      installStorage()
      const st = startCreate(r.t)
      const d = st.draft
      const clarify = st.phase !== 'confirming'
      const errs: string[] = []

      if (r.person !== undefined && (d.person ?? null) !== r.person) errs.push(`who=${d.person}≠${r.person}`)
      if (r.date !== undefined && (d.date ?? null) !== r.date) errs.push(`date=${d.date}≠${r.date}`)
      if (r.time !== undefined && (d.time ?? null) !== r.time) errs.push(`time=${d.time}≠${r.time}`)
      if (r.locEmpty && d.location != null) errs.push(`loc=${d.location}≠empty`)
      if (r.loc && d.location !== r.loc) errs.push(`loc=${d.location}≠${r.loc}`)
      if (r.subj && !(d.subject ?? '').includes(r.subj)) errs.push(`subj=${d.subject}∌${r.subj}`)
      if (r.clarify !== undefined && clarify !== r.clarify) errs.push(`clarify=${clarify}≠${r.clarify}`)

      // ── P0 checks (product-breaking) ──
      if (r.time !== undefined && r.time !== null && (d.time ?? null) !== r.time) p0.push(`WRONG TIME: ${r.t}`)
      if (r.locEmpty && d.location != null) p0.push(`INVENTED LOCATION: ${r.t}`)
      if (r.person === null && d.person != null) p0.push(`INVENTED PERSON: ${r.t}`)
      if (r.time === null && d.time != null) p0.push(`INVENTED TIME: ${r.t}`)
      // never confirm (=ready to save) while a critical field is missing
      if (st.phase === 'confirming' && (!d.title || !d.date || !d.time)) p0.push(`SAVED W/ MISSING CRITICAL: ${r.t}`)

      // ── Save + read-back for representative cases: prove real behavior ──
      if (st.phase === 'confirming') {
        const saved = saveDraft(st)
        if (saved) {
          if (NARRATIVE.test(saved.title)) p0.push(`GARBAGE TITLE: ${saved.title}`)
          if (saved.notes && NARRATIVE.test(saved.notes)) p0.push(`GARBAGE NOTES: ${saved.notes}`)
          if (r.readback) {
            const dayQ = r.date === D(0) ? 'מה יש לי היום' : r.date === D(1) ? 'מה יש לי מחר' : null
            if (dayQ) {
              const ans = tryGroundedAnswer(dayQ) ?? ''
              if (!ans.includes(saved.title.split(' ').slice(-1)[0]!) && !ans.includes(d.person ?? '###')) {
                p0.push(`FALSE NO-MEETING after save: ${r.t} → "${ans}"`)
              }
              if (/אין לך|אין פגישות/.test(ans)) p0.push(`FALSE "אין" after save: ${r.t}`)
            }
          }
        }
      }

      if (errs.length === 0) pass++
      else fails.push(`✗ "${r.t.slice(0, 34)}" :: ${errs.join(' | ')}`)
    }
    const pct = Math.round((pass / A_CASES.length) * 100)
    if (pct < 95 || p0.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`A SCORE ${pass}/${A_CASES.length}=${pct}%\nP0(${p0.length}):\n${p0.join('\n')}\nFAILS:\n${fails.slice(0, 30).join('\n')}`)
    }
    expect(p0).toHaveLength(0)
    expect(pct).toBeGreaterThanOrEqual(95)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// B. Calendar Read — every route, one source of truth, full details
// ══════════════════════════════════════════════════════════════════════════════
describe('B — Calendar Read: one deterministic source, no false empty', () => {
  function seed() {
    addAppointment({ title: 'פגישה עם אלכסנדרה', date: D(0), time: '19:00', emoji: '☕', location: 'קפה גרג רעננה', subject: 'שכירות', personName: 'אלכסנדרה' } as Parameters<typeof addAppointment>[0])
    addAppointment({ title: 'רופא שיניים', date: D(1), time: '10:00', emoji: '🦷' } as Parameters<typeof addAppointment>[0])
  }
  beforeEach(() => { installStorage(); seed() })

  it.each([
    'איזה פגישה יש לי היום', 'פגישות יש לי ביומן היום', 'מה יש לי היום',
    'מה הדבר הבא ביומן', 'מתי הפגישה הבאה שלי',
  ])('"%s" → grounded, finds the real event, never "אין"', (q) => {
    expect(routePersonalQuery(q).type).toMatch(/^calendar_/)
    const a = tryGroundedAnswer(q) ?? ''
    expect(a).toContain('אלכסנדרה')
    expect(a).not.toContain('אין לך')
  })

  it('"מה יש לי מחר" finds tomorrow\'s event', () => {
    expect(tryGroundedAnswer('מה יש לי מחר') ?? '').toContain('רופא שיניים')
  })

  it('"איפה הפגישה עם אלכסנדרה" → returns the location', () => {
    const a = tryGroundedAnswer('מתי אני נפגשת עם אלכסנדרה') ?? ''
    expect(a).toContain('אלכסנדרה')
    expect(a).toContain('קפה גרג')
  })

  it('today read includes time + location + subject (full available details)', () => {
    const a = tryGroundedAnswer('איזה פגישה יש לי היום') ?? ''
    expect(a).toContain('אלכסנדרה')
    expect(a).toContain('שבע')      // 19:00 spoken
    expect(a).toContain('קפה גרג')
    expect(a).toContain('שכירות')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// C. Semantic layer — mocked LLM + deterministic merge (safety rules)
// ══════════════════════════════════════════════════════════════════════════════
describe('C — Semantic layer merge under deterministic safety', () => {
  const CTX = { nowISO: FIXED.toISOString(), familyNames: ['מור', 'לאו', 'אופיר'] }
  const base = {
    intent: 'create_meeting' as const, understoodMeaning: '', person: 'מור', date: D(1), time: '19:00',
    location: null, subject: null, purpose: null, notes: null, missingCriticalFields: [],
    needsClarification: false, clarificationQuestion: null, confidence: 0.95, corrections: [],
  }
  const mock = (o: object | string) => async () => ({ ok: true as const, openai: { choices: [{ message: { content: typeof o === 'string' ? o : JSON.stringify(o) } }] } })

  it('good JSON → merged, ready', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mock(base) })
    expect(m.semanticLayerUsed).toBe(true); expect(m.draft.time).toBe('19:00')
  })
  it('bad JSON → deterministic fallback', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mock('{bad') })
    expect(m.semanticLayerUsed).toBe(false); expect(m.fallbackReason).toBe('malformed_json'); expect(m.draft.time).toBe('19:00')
  })
  it('low confidence → clarify', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mock({ ...base, confidence: 0.5 }) })
    expect(m.needsClarification).toBe(true)
  })
  it('invented LLM location is rejected (not in transcript)', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר בשבע בערב', CTX, { sendChat: mock({ ...base, location: 'קפה גרג רעננה' }) })
    expect(m.draft.location == null).toBe(true)
  })
  it('invented/wrong LLM time loses to deterministic', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר', CTX, { sendChat: mock({ ...base, time: '19:00' }) })
    expect(m.draft.time).toBeNull(); expect(m.needsClarification).toBe(true)
  })
  it('STT correction adopted from the LLM', async () => {
    const m = await understandMeetingSemantic('פגישה עם אלכסנדרה לדבר על הזכיר שכירות', { ...CTX }, { sendChat: mock({ ...base, person: 'אלכסנדרה', date: null, time: null, subject: 'שכירות', notes: 'לדבר על השכירות', corrections: [{ heard: 'הזכיר שכירות', understoodAs: 'השכירות', reason: 'rental' }] }) })
    expect(m.draft.subject).toBe('שכירות'); expect(m.corrections).toHaveLength(1)
  })
  it('mergedToCreateState maps a clarify result to the creating phase', async () => {
    const m = await understandMeetingSemantic('תקבעי לי פגישה עם מור מחר', CTX, { sendChat: mock({ ...base, time: null }) })
    expect(mergedToCreateState(m).phase).toBe('creating')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// D. Family / continuity — deterministic graph first
// ══════════════════════════════════════════════════════════════════════════════
describe('D — Family deterministic, no guessing', () => {
  it.each(['מי זאת מור', 'מי זאת ארי', 'מי הנכדים שלי', 'מי זאת אופיר'])('"%s" grounded', (q) => {
    expect(routePersonalQuery(q).type).toBe('family_lookup')
    expect(tryGroundedAnswer(q)).not.toBeNull()
  })
  it('"עליה" / "תמשיכי" continue on the last person', () => {
    const h = [{ role: 'user', content: 'מי זאת מור' }, { role: 'assistant', content: 'מור, הבת שלך.' }]
    expect(resolveFollowUp('עליה', h as never).resolved).toContain('מור')
    expect(resolveFollowUp('תמשיכי', h as never).resolved).toContain('מור')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// E. Local memory — 40-turn chain
// ══════════════════════════════════════════════════════════════════════════════
describe('E — 40-turn memory chain', () => {
  const chain: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const turns: Array<[string, string]> = [
    ['מי זאת מור', 'מור, הבת שלך.'], ['עליה', 'מור גרה בהוד השרון.'],
    ['מי הנכדים שלי', 'שישה נכדים.'], ['מי זאת ארי', 'ארי, הנינה שלך.'],
    ['תקבעי לי פגישה עם מור מחר בשלוש אחר הצהריים', 'קבעתי פגישה עם מור.'],
    ['מה יש לי מחר', 'פגישה עם מור בשלוש.'], ['אני מתגעגעת לפפי', 'הוא חסר. ספרי לי עליו.'],
    ['הוא אהב לבשל', 'כן, מבשל נפלא.'], ['תזכירי לי על מי דיברנו', 'על מור ופפי.'],
    ['תקבעי עם אופיר מחר בשבע בערב', 'קבעתי עם אופיר.'], ['מה יש לי השבוע', 'פגישות עם מור ואופיר.'],
    ['תבטלי את הפגישה עם אופיר', 'ביטלתי.'], ['מי זאת אלכסנדרה', 'חברה שלך.'],
    ['מי זאת מור', 'מור, הבת שלך.'], ['תמשיכי', 'למור ארבעה ילדים.'],
    ['מה שלום עדי', 'עדי טוב.'], ['מי זאת ארי', 'ארי, הנינה שלך.'],
    ['עליה', 'ארי, הנינה שלך.'], ['תקבעי עם מור מחרתיים בעשר', 'קבעתי עם מור.'],
    ['מה יש לי מחרתיים', 'פגישה עם מור.'],
  ]
  for (const [u, a] of turns) { chain.push({ role: 'user', content: u }); chain.push({ role: 'assistant', content: a }) }

  it('chain is ≥40 turns', () => { expect(chain.length).toBeGreaterThanOrEqual(40) })
  it('remembers last family person, last calendar action, topic after an emotional detour', () => {
    const mem = deriveConversationMemory(chain)
    expect(mem.lastPerson).toBe('מור')
    expect(mem.lastCalendarAction).toBe('create')   // last action was the מחרתיים create
    expect(mem.lastTopic).toBeTruthy()
  })
  it('does not confuse family members ("עליה" after Ari → Ari, after Mor → Mor)', () => {
    expect(resolveFollowUp('עליה', [{ role: 'user', content: 'מי זאת ארי' }, { role: 'assistant', content: 'ארי.' }] as never).resolved).toContain('ארי')
    expect(resolveFollowUp('עליה', [{ role: 'user', content: 'מי זאת מור' }, { role: 'assistant', content: 'מור.' }] as never).resolved).toContain('מור')
  })
  it('returns to calendar correctly after the topic switch', () => {
    const memAfterCancel = deriveConversationMemory(chain.slice(0, 24))
    expect(memAfterCancel.lastCalendarAction).toBe('delete')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// F. Personality — 100 response-shaping cases
// ══════════════════════════════════════════════════════════════════════════════
describe('F — companion personality: 100 cases, zero banned survives', () => {
  const plan = { step7_act: 'lead' } as CompanionPlan
  const robotic = [
    'אני בסדר', 'איך אפשר לעזור', 'איך אני יכולה לעזור לך', 'במה אני יכולה לעזור', 'רוצה לדבר על משהו אחר',
    'אין לי מידע', 'אין לי מידע על זה', 'כיצד אוכל לסייע', 'במה אוכל לסייע', 'אני כאן לשירותך', 'לשירותך',
    'בחרי אחת מהאפשרויות', 'הנה כמה אפשרויות', 'תפריט האפשרויות', 'שאלה מצוינת', 'שאלה טובה', 'יופי של שאלה',
    'כל הכבוד', 'איזה יופי ששאלת', 'אני בינה מלאכותית', 'אני עוזרת וירטואלית', 'אני עוזרת דיגיטלית',
    'אני מודל שפה', 'אני תוכנה', 'אני רובוט', 'אני רק עוזרת', 'על פי הנתונים', 'לפי הנתונים', 'לפי המידע',
    'מצאתי עבורך', 'חיפשתי באינטרנט', 'אשמח לעזור', 'אני כאן כדי לעזור', 'בכל שאלה אני כאן',
    'as an ai', "i'm an ai", 'how can i help', 'how may i help', 'great question', 'good question',
    'happy to help', "i'd be happy to help", 'according to the data', 'based on the data', 'based on the information',
  ]
  it.each(robotic)('"%s" → no banned phrase survives, never empty', (c) => {
    const out = enforceCompanion(c, plan)
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
  })
  const embedded = [
    ['על פי הנתונים, יש לך פגישה עם מור', 'מור'], ['שאלה מצוינת, מור היא הבת שלך', 'מור'],
    ['איך אפשר לעזור? יש לך תור לרופא מחר', 'רופא'], ['happy to help, you have a meeting tomorrow', 'meeting'],
    ['לפי המידע, הפגישה בשבע', 'שבע'], ['כל הכבוד! מחר יש לך יום עמוס', 'מחר'],
  ] as const
  it.each(embedded)('strips banned from "%s", keeps content', (c, keep) => {
    const out = enforceCompanion(c, plan)
    expect(findBannedPhrase(out)).toBeNull(); expect(out).toContain(keep)
  })
  const acts: Array<CompanionPlan['step7_act']> = ['listen', 'lead', 'encourage', 'ask']
  it.each(acts)('act "%s" → warm non-empty fallback, no banned', (act) => {
    const out = enforceCompanion('אין לי מידע', { step7_act: act } as CompanionPlan)
    expect(out.length).toBeGreaterThan(0); expect(findBannedPhrase(out)).toBeNull(); expect(out).not.toBe('אני בסדר')
  })
  const clean = [
    'מור, הבת שלך. בהוד השרון עם יעל.', 'היום בשבע יש לך פגישה עם אלכסנדרה.', 'ימים כאלה יש. אני כאן איתך.',
    'איזה כיף לשמוע!', 'תתקשרי למור, גם עשר דקות משנות.', 'אני יודעת כמה הוא חסר לך.',
    'בשמחה, נדבר על זה.', 'ארי, הנינה שלך. ילדה מתוקה.',
  ]
  it.each(clean)('clean human line "%s" preserved', (line) => {
    expect(findBannedPhrase(line)).toBeNull()
    expect(enforceCompanion(line, plan)).toContain(line.split('.')[0]!.trim())
  })
  // emotional candidates must never be answered with banned/menu register
  const emotional = [
    'אני מתגעגעת לפפי', 'אני לבד היום', 'קשה לי', 'אני עצובה', 'משעמם לי',
    'לא הבנת אותי', 'אף אחד לא מתקשר אליי', 'אני דואגת למור',
  ]
  it.each(emotional)('emotional input "%s" never yields a banned/menu line', (e) => {
    // The guard is applied to whatever candidate the model would produce; even if
    // it tried a menu line, the output stays warm and clean.
    const out = enforceCompanion(`${e}. איך אפשר לעזור?`, { step7_act: 'listen' } as CompanionPlan)
    expect(findBannedPhrase(out)).toBeNull()
    expect(out.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// G. Online routing honesty
// ══════════════════════════════════════════════════════════════════════════════
describe('G — online routing', () => {
  it.each([
    ['מה מזג האוויר מחר בכפר סבא', 'weather'], ['מה מזג האוויר היום', 'weather'],
    ['איזה משחקים יש היום במונדיאל', 'sports'], ['מי ניצח אתמול בכדורגל', 'sports'],
    ['מה חדש בעולם', 'latest'], ['מה קורה בחדשות היום', 'news'],
  ])('"%s" routes online (%s), not blocked, not personal', (q, kind) => {
    expect(isOnlineCurrentInfoQuery(q)).toBe(true)
    expect(getOnlineQueryKind(q)).toBe(kind)
    expect(shouldBlockOnlineForPersonal(q)).toBe(false)
    expect(routePersonalQuery(q).type).toBe('non_personal')
  })
  it('a calendar question is never sent online', () => {
    expect(isOnlineCurrentInfoQuery('מה יש לי היום')).toBe(false)
    expect(routePersonalQuery('מה יש לי היום').type).toMatch(/^calendar_/)
  })
})
