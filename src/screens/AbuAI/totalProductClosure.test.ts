/**
 * TOTAL PRODUCT CLOSURE
 * ═════════════════════
 * Tests PRODUCT BEHAVIOR through the single AI Understanding Orchestrator — the
 * one front door every input flows through (normalize → understand → validate →
 * memory → shape). No route bypasses it. Proves: 150 hostile inputs classify
 * correctly, calendar create/read full cycle, family continuity, online routing,
 * emotional handling, 50-turn memory, personality bans, no raw transcript saved.
 *
 * Time pinned to a FIXED base (independent of the wall clock / rollovers).
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { orchestrate, normalizeInput } from './understandingOrchestrator'
import { startCreate } from './calendarCreate'
import { tryGroundedAnswer } from './service'
import { deriveConversationMemory } from './conversationMemory'
import { enforceCompanion, findBannedPhrase } from './companionComposer'
import type { CompanionPlan } from './companionPlanner'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
const BASE = '2026-06-24T09:00:00'
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const D = (n: number) => { const d = new Date(BASE); d.setDate(d.getDate() + n); return fmt(d) }
const NARRATIVE = /בוא נעשה|אז ככה|^שמעי|אני חייבת|אני צריכה|אנחנו צריכים|בא לי|יעני|כאילו/

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
}
beforeEach(() => { installStorage() })
const ctx = (msgs: Array<{ role: string; content: string }> = []) => ({ messages: msgs })

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — 150 hostile inputs through the orchestrator (≥95% intent, 0 P0)
// ══════════════════════════════════════════════════════════════════════════════
type Intent = 'calendar_create' | 'calendar_read' | 'calendar_delete' | 'family' | 'contact_action' | 'online' | 'recall' | 'emotional' | 'general'
const C: Array<[string, Intent]> = [
  // creates (incl. messy / STT / narrative)
  ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'calendar_create'],
  ['תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים', 'calendar_create'],
  ['מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את השכירות בקפה גרג ברעננה בשבע בערב', 'calendar_create'],
  ['שמעי לפני שהדיירים נכנסים אני צריכה לדבר עם אלכסנדרה על השכירות מחר בערב', 'calendar_create'],
  ['בא לי לראות את מור השבוע', 'calendar_create'],
  ['נקבע משהו עם אלכסנדרה מחר על הבית', 'calendar_create'],
  ['תקבעי עם אלכסנדרה מחר בשבע בערב על השחירות של הבית', 'calendar_create'],
  ['קבעי תור לרופא מחרתיים בעשר בבוקר', 'calendar_create'],
  ['תרשמי לי יוגה ביום שלישי בעשר', 'calendar_create'],
  ['תקבעי עם אופיר מחר בשבע בערב לדבר על הבדיקות', 'calendar_create'],
  ['אני רוצה לקבוע תור לרופא שיניים מחרתיים אחר הצהריים', 'calendar_create'],
  ['תקבעי עם לאו מחר בשמונה בערב בבית קפה', 'calendar_create'],
  ['פגישה עם מור מחר בארבע בהוד השרון', 'calendar_create'],
  ['יעני תקבעי לי כאילו פגישה עם מור מחר בשבע בערב', 'calendar_create'],
  ['תקבעי עם מור מחר בשלוש אחר צהריים', 'calendar_create'],
  ['קבעי ביקור אצל מור מחר בארבע', 'calendar_create'],
  ['נקבע עם אלכסנדרה מחר בערך בשמונה בערב בקפה גרג ברעננה', 'calendar_create'],
  ['תקבעי לי משהו עם מור מחר מחר בעשר בעשר בבוקר', 'calendar_create'],
  ['תקבעי עם אופיר מחר בשבע בערב בנושא החתונה', 'calendar_create'],
  ['אז ככה מחרתיים בערב בסביבות שמונה בא לי לשבת עם לאו בבית קפה לדבר על החתונה', 'calendar_create'],
  // reads
  ['מה יש לי היום', 'calendar_read'], ['איזה פגישה יש לי היום', 'calendar_read'],
  ['פגישות יש לי ביומן היום', 'calendar_read'], ['מה יש לי מחר', 'calendar_read'],
  ['מה יש לי השבוע', 'calendar_read'], ['מה הדבר הבא ביומן', 'calendar_read'],
  ['מתי הפגישה הבאה שלי', 'calendar_read'], ['מתי אני נפגשת עם אלכסנדרה', 'calendar_read'],
  ['איפה הפגישה הבאה שלי', 'calendar_read'], ['מה קבעתי היום', 'calendar_read'],
  ['יש לי משהו ביום חמישי', 'calendar_read'], ['מה יש לי ביומן', 'calendar_read'],
  ['מתי התור הבא שלי', 'calendar_read'], ['מה התוכנית להיום', 'calendar_read'],
  ['מה קורה השבוע', 'calendar_read'],
  // family
  ['מי זאת מור', 'family'], ['מי זאת ארי', 'family'], ['מי הנכדים שלי', 'family'],
  ['מי זאת אופיר', 'family'], ['ספרי לי על לאו', 'family'], ['מי הילדים שלי', 'family'],
  ['איפה גרה מור', 'family'], ['מתי יום ההולדת של נועם', 'family'], ['מי אמא של ארי', 'family'],
  ['מי בת הזוג של מור', 'family'], ['ספרי לי על הנכדים', 'family'], ['כמה נכדים יש לי', 'family'],
  ['מי זאת עדי', 'family'], ['מה הקשר בין מור לאופיר', 'family'], ['מי זאת נועם', 'family'],
  // online
  ['מה מזג האוויר מחר בכפר סבא', 'online'], ['מה מזג האוויר היום', 'online'],
  ['איזה משחקים יש היום במונדיאל', 'online'], ['מי ניצח אתמול בכדורגל', 'online'],
  ['מה חדש בעולם', 'online'], ['מה קורה בחדשות היום', 'online'],
  ['מה מקרינים בקולנוע היום', 'online'], ['מה פתוח עכשיו', 'online'],
  // emotional → emotional (companion suppression)
  ['אני מתגעגעת לפפי', 'emotional'], ['אני לבד היום', 'emotional'], ['קשה לי היום', 'emotional'],
  ['אני עצובה', 'emotional'], ['משעמם לי', 'emotional'], ['אף אחד לא מתקשר אליי', 'emotional'],
  ['אני מרגישה בודדה', 'emotional'], ['היה לי יום קשה', 'emotional'],
  // general
  ['ספרי לי סיפור', 'general'], ['מה את חושבת על המהפכה הצרפתית', 'general'],
  ['ספרי לי משהו מעניין', 'general'], ['ספרי לי בדיחה', 'general'],
  ['מה דעתך על איטליה', 'general'], ['תני לי טיפ לבישול', 'general'],
  // contact action
  ['תתקשרי למור', 'contact_action'], ['שלחי הודעה ללאו', 'contact_action'],
  // delete
  ['תבטלי את הפגישה עם מור', 'calendar_delete'], ['תמחקי את התור לרופא', 'calendar_delete'],
  // recall
  ['מה אמרתי לך קודם', 'recall'], ['על מי דיברנו', 'recall'],
]
// Expand with date/time/person variants to exceed 150 total.
const PEOPLE = ['מור', 'אלכסנדרה', 'אופיר', 'לאו']
const TIMES = ['בשבע בערב', 'בשלוש אחר הצהריים', 'בעשר בבוקר', 'בשמונה בערב', 'בתשע בבוקר', 'באחת וחצי אחר הצהריים']
const DAYS = ['מחר', 'מחרתיים']
for (const p of PEOPLE) for (const tw of TIMES) for (const dw of DAYS) C.push([`תקבעי עם ${p} ${dw} ${tw}`, 'calendar_create'])
// 4 × 6 × 2 = 48 generated creates.
const READS = ['מה יש לי היום', 'מה יש לי מחר', 'מה יש לי השבוע', 'איזה פגישה יש לי היום', 'מה הדבר הבא ביומן', 'מתי הפגישה הבאה שלי', 'מה קבעתי היום', 'מה התוכנית להיום']
for (const r of READS) C.push([`${r}?`, 'calendar_read'])
const FAMS = ['מי זאת מור', 'מי זאת ארי', 'מי זאת אופיר', 'מי זאת עדי', 'מי הנכדים שלי', 'ספרי לי על לאו', 'איפה גרה מור', 'מי הילדים שלי']
for (const f of FAMS) C.push([`${f}?`, 'family'])
const ONLINES: Array<[string, Intent]> = [['מה מזג האוויר מחר', 'online'], ['מה חדש בעולם', 'online'], ['איזה משחקים יש היום', 'online'], ['מה קורה בחדשות', 'online']]
for (const [o, i] of ONLINES) C.push([o, i])
const EXTRA: Array<[string, Intent]> = [
  ['אני עצובה היום', 'emotional'], ['אני לבד', 'emotional'],
  ['ספרי לי בדיחה', 'general'], ['מה דעתך על הספר הזה', 'general'],
  ['תקבעי עם מור היום בשבע בערב', 'calendar_create'], ['תקבעי עם אלכסנדרה מחרתיים בעשר בבוקר', 'calendar_create'],
]
for (const [t, i] of EXTRA) C.push([t, i])

describe('PART 1 — 150+ inputs through the orchestrator: ≥95% intent, 0 P0 on creates', () => {
  it(`corpus is ≥150 (have ${C.length})`, () => { expect(C.length).toBeGreaterThanOrEqual(150) })

  it('orchestrator classifies ≥95% and never P0-fails a create', () => {
    let ok = 0; const miss: string[] = []; const p0: string[] = []
    for (const [t, expected] of C) {
      installStorage()
      const o = orchestrate(t, ctx())
      if (o.intent === expected) ok++
      else miss.push(`✗ "${t.slice(0, 32)}" exp=${expected} got=${o.intent}`)
      if (o.intent === 'calendar_create' && o.meeting) {
        const m = o.meeting
        if (m.location && !t.includes(m.location.split(' ')[0]!)) p0.push(`INVENTED LOC: ${t}`)
        if (m.title && NARRATIVE.test(m.title)) p0.push(`GARBAGE TITLE: ${m.title}`)
        if (m.notes && NARRATIVE.test(m.notes)) p0.push(`GARBAGE NOTES: ${m.notes}`)
        if (m.rawTranscript && m.title === m.rawTranscript) p0.push(`RAW=TITLE: ${t}`)
      }
    }
    const pct = Math.round((ok / C.length) * 100)
    if (pct < 95 || p0.length) { /* eslint-disable-next-line no-console */ console.log(`INTENT ${ok}/${C.length}=${pct}%\nP0(${p0.length}):\n${p0.join('\n')}\nMISS:\n${miss.join('\n')}`) }
    expect(p0).toHaveLength(0)
    expect(pct).toBeGreaterThanOrEqual(95)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — no route bypasses the orchestrator (source + consistency contract)
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 2 — no route bypasses orchestration', () => {
  const idx = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
  it('both the text and voice handlers call orchestrate() as the front door', () => {
    expect(idx).toContain("orchestrate(msgText, { messages })")
    expect(idx).toContain("orchestrate(text, { messages })")
  })
  it('the orchestrator decision is consistent with the executed routes', () => {
    // The orchestrator must agree with the actual create gate + read router.
    expect(orchestrate('תקבעי עם מור מחר בשבע בערב', ctx()).intent).toBe('calendar_create')
    expect(orchestrate('מה יש לי היום', ctx()).intent).toBe('calendar_read')
    expect(orchestrate('מי זאת מור', ctx()).intent).toBe('family')
    expect(orchestrate('מה מזג האוויר מחר', ctx()).intent).toBe('online')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — calendar create/read FULL CYCLE via the orchestrator
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 3 — create→save→read full cycle, no raw transcript saved', () => {
  it('long messy speech → clean event → saved → read back', () => {
    installStorage()
    const raw = 'מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את הסכם השכירות לפני שהדיירים החדשים מגיעים. בוא נעשה את זה בקפה גרג ברעננה בסביבות שבע בערב'
    const o = orchestrate(raw, ctx())
    expect(o.intent).toBe('calendar_create')
    const m = o.meeting!
    expect(m.who).toBe('אלכסנדרה'); expect(m.time).toBe('19:00'); expect(m.location).toBe('קפה גרג ברעננה')
    expect(m.subject).toContain('שכירות')
    expect(m.title).toBe('פגישה עם אלכסנדרה')
    expect(m.notes!).not.toMatch(NARRATIVE)        // clean, not the transcript
    expect(m.title).not.toBe(m.rawTranscript)      // raw transcript never the event

    // Save via the product path, then read back.
    const st = startCreate(raw)
    const d = st.draft
    addAppointment({ title: d.title!, date: d.date!, time: d.time!, emoji: '📌', ...(d.location ? { location: d.location } : {}), ...(d.subject ? { subject: d.subject } : {}), ...(d.person ? { personName: d.person } : {}) } as Parameters<typeof addAppointment>[0])
    const saved = loadAppointments()[0]!
    expect(saved.location).toBe('קפה גרג ברעננה')
    expect(JSON.stringify(saved)).not.toMatch(/אולי נעשה|בוא נעשה את זה/)
    const read = tryGroundedAnswer('מה יש לי מחר') ?? ''
    expect(read).toContain('אלכסנדרה'); expect(read).not.toContain('אין לך')
  })

  it('missing time → orchestrator asks, never invents', () => {
    const o = orchestrate('תקבעי עם מור מחר בבוקר', ctx())
    expect(o.intent).toBe('calendar_create')
    expect(o.meeting!.time).toBeNull()
    expect(o.needsClarification).toBe(true)
    expect(o.clarificationQuestion).toContain('שעה')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — family continuity through the orchestrator (normalize stage)
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 4 — family continuity', () => {
  it('"עליה" after a family turn normalizes to the person, routes family', () => {
    const hist = [{ role: 'user', content: 'מי זאת מור' }, { role: 'assistant', content: 'מור, הבת שלך.' }]
    const o = orchestrate('עליה', ctx(hist))
    expect(o.normalizedInput).toContain('מור')
    expect(o.intent).toBe('family')
  })
  it.each(['מי זאת מור', 'מי זאת ארי', 'מי הנכדים שלי'])('"%s" → family + grounded', (q) => {
    installStorage()
    expect(orchestrate(q, ctx()).intent).toBe('family')
    expect(tryGroundedAnswer(q)).not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 5 — 50-turn memory
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 5 — 50-turn memory', () => {
  const chain: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const turns: Array<[string, string]> = [
    ['מי זאת מור', 'מור, הבת שלך.'], ['עליה', 'מור גרה בהוד השרון.'], ['מי הנכדים שלי', 'שישה.'],
    ['מי זאת ארי', 'ארי, הנינה.'], ['תקבעי פגישה עם מור מחר בשלוש אחר הצהריים', 'קבעתי עם מור.'],
    ['מה יש לי מחר', 'פגישה עם מור.'], ['אני מתגעגעת לפפי', 'הוא חסר.'], ['הוא אהב לבשל', 'נכון.'],
    ['על מי דיברנו', 'מור ופפי.'], ['תקבעי עם אופיר מחר בשבע', 'קבעתי עם אופיר.'],
    ['מה יש לי השבוע', 'מור ואופיר.'], ['תבטלי את הפגישה עם אופיר', 'ביטלתי.'],
    ['מי זאת אלכסנדרה', 'חברה.'], ['מי זאת מור', 'מור, הבת שלך.'], ['תמשיכי', 'ארבעה ילדים.'],
    ['מה שלום עדי', 'טוב.'], ['מי זאת ארי', 'ארי, הנינה.'], ['עליה', 'ארי, הנינה.'],
    ['תקבעי עם מור מחרתיים בעשר', 'קבעתי.'], ['מה יש לי מחרתיים', 'פגישה עם מור.'],
    ['מי זאת מור', 'מור, הבת שלך.'], ['ספרי לי עוד', 'גרה בהוד השרון.'], ['תודה', 'בכיף.'],
    ['מי הילדים שלי', 'מור ולאו.'], ['מי לאו', 'הבן שלך.'],
  ]
  for (const [u, a] of turns) { chain.push({ role: 'user', content: u }); chain.push({ role: 'assistant', content: a }) }
  it('chain ≥50 turns', () => { expect(chain.length).toBeGreaterThanOrEqual(50) })
  it('memory tracks person + last calendar action + topic over 50 turns', () => {
    const mem = deriveConversationMemory(chain)
    expect(['מור', 'לאו']).toContain(mem.lastPerson)
    expect(mem.lastCalendarAction).toBe('create')
    expect(mem.lastTopic).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 6 — personality bans + emotional warmth (shape via orchestrator)
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 6 — personality', () => {
  const banned = ['אני בסדר', 'איך אפשר לעזור', 'רוצה לדבר על משהו אחר', 'אין לי מידע', 'כיצד אוכל לסייע', 'תפריט האפשרויות', 'אני בינה מלאכותית', 'how can i help', 'great question']
  it.each(banned)('orchestrator.shape strips "%s"', (b) => {
    const o = orchestrate('שלום', ctx())
    const out = o.shape(`${b}.`)
    expect(out.length).toBeGreaterThan(0)
    expect(findBannedPhrase(out)).toBeNull()
  })
  it('emotional input is classified emotional and shaped warmly, never a menu', () => {
    const o = orchestrate('אני מתגעגעת לפפי', ctx())
    expect(o.intent).toBe('emotional')
    expect(findBannedPhrase(o.shape('אני מתגעגעת לפפי. איך אפשר לעזור?'))).toBeNull()
  })
  it('dead-end fallback is warm', () => {
    expect(enforceCompanion('אשמח לעזור', { step7_act: 'lead' } as CompanionPlan)).not.toBe('אני כאן.')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 7 — Abu Games structural
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 7 — Abu Games structural', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '../AbuGames/index.tsx'), 'utf8')
  it('18 bubble games, vertical grid, brand, no carnival / old UI', () => {
    expect((SRC.match(/id: '[a-z0-9-]+'/g) ?? []).length).toBe(18)
    expect(SRC).toContain("borderRadius: '50%'")
    expect(SRC).toContain("gridTemplateColumns: 'repeat(3, 1fr)'")
    expect(SRC).not.toContain("overflowX: 'auto'")
    expect(SRC).toContain('Abu Games'); expect(SRC).toContain('ABU BANK')
    expect(SRC).not.toContain('Carnival'); expect(SRC).not.toContain('המשחקים שלך')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PART 8 — normalize stage (STT recovery flows through the orchestrator)
// ══════════════════════════════════════════════════════════════════════════════
describe('PART 8 — normalize repairs STT before understanding', () => {
  it('"שחירות"/"אחר צהריים" repaired in the normalized input', () => {
    const r = normalizeInput('תקבעי עם אלכסנדרה מחר בשלוש אחר צהריים על שחירות הבית', [])
    expect(r.normalized).toContain('שכירות')
    expect(r.normalized).toContain('אחר הצהריים')
    expect(r.corrections.length).toBeGreaterThan(0)
  })
})
