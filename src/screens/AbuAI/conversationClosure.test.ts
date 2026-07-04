/**
 * CONVERSATION CLOSURE — the two iPhone-reported blockers, locked down.
 *  #1 Confirmation survives: every natural "yes" completes the pending create
 *     (and "אני רוצה את זה" no longer SILENTLY cancels).
 *  #2 Semantic time/place: "tonight at 11 at Luna Park" → today / 23:00 / Luna
 *     Park, clean title; proper-noun venues; "הערב"/"הלילה"/"הבוקר" → today.
 *
 * Time anchored to a fixed evening base (independent of the wall clock).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, resolvePendingMessage, isConfirm, type CalendarCreateState } from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'

const FIXED = new Date('2026-06-24T20:00:00') // Wed evening
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
const TODAY = '2026-06-24'
let storage: Record<string, string> = {}
beforeEach(() => { storage = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: () => {} }) })

// ── #1 Confirmation survives ────────────────────────────────────────────────
describe('#1 confirmation completes the pending create', () => {
  const CONFIRMS = [
    'כן', 'כן כן', 'נכון', 'בדיוק', 'בבקשה', 'קדימה', 'זה נכון', 'אני רוצה את זה',
    'מאשרת', 'תקבעי', 'תקבעי לי', 'אוקיי', 'בטח', 'ברור', 'כן בבקשה', 'כן תקבעי',
    'בסדר גמור', 'מושלם', 'תזמני לי', 'יאללה', 'סבבה', 'בהחלט', 'נהדר', 'יופי', 'סגור',
    'כן.', 'בבקשה!', 'נכון מאוד',
    // the EXACT longer phrases from the device transcript
    'כן אני רוצה שתקבעי את זה', 'תקבעי את זה', 'כן אני רוצה', 'אני רוצה שתקבעי את זה',
    'בסדר תקבעי את זה', 'שתקבעי את זה', 'כן אני רוצה שתקבעי',
  ]
  it.each(CONFIRMS)('"%s" → save', (c) => {
    const st = startCreate('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(isConfirm(c)).toBe(true)
    expect(resolvePendingMessage(st, c, false).action).toBe('save')
  })

  it('"אני רוצה את זה" SAVES (never silently cancels — the real device bug)', () => {
    const st = startCreate('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(resolvePendingMessage(st, 'אני רוצה את זה', false).action).toBe('save')
  })

  const NOT_CONFIRMS = ['לא', 'ספרי לי בדיחה', 'מי זה מור', 'תקבעי עם אופיר מחר בעשר', 'אהלן מה', 'בעשר']
  it.each(NOT_CONFIRMS)('"%s" → NOT a blind save', (c) => {
    const st = startCreate('תקבעי לי פגישה עם מור מחר בשבע בערב')
    const a = resolvePendingMessage(st, c, false).action
    expect(a).not.toBe('save')
  })
})

// ── #2 Semantic time + place ────────────────────────────────────────────────
describe('#2 tonight / this-morning times + proper-noun places', () => {
  it('the flagship: "…מוריס הערב באחת עשרה בלונה פארק"', () => {
    const m = understandMeeting('בוא ניפגש עם מוריס הערב באחת עשרה בלונה פארק')
    expect(m.who).toBe('מוריס')
    expect(m.date).toBe(TODAY)        // tonight = today
    expect(m.time).toBe('23:00')      // 11 at night
    expect(m.location).toBe('לונה פארק')
    expect(m.title).toBe('פגישה עם מוריס')
    expect(m.title).not.toMatch(/הערב/)
  })

  const cases: Array<[string, string, string]> = [
    ['תקבעי עם מור הערב בשמונה', '20:00', TODAY],
    ['נקבע עם אלכסנדרה הלילה בעשר', '22:00', TODAY],
    ['פגישה עם אופיר הבוקר בתשע', '09:00', TODAY],
    ['תקבעי עם מור הלילה בשלוש', '03:00', TODAY],     // 3am after midnight
    ['תקבעי עם מור הערב באחת עשרה', '23:00', TODAY],
  ]
  it.each(cases)('"%s" → %s on %s, clean title', (t, time, date) => {
    const m = understandMeeting(t)
    expect(m.time).toBe(time)
    expect(m.date).toBe(date)
    expect(m.title ?? '').not.toMatch(/הערב|הלילה|הבוקר|הצהריים/)
  })

  it('an explicit date still beats the tonight fallback', () => {
    expect(understandMeeting('תקבעי עם מור מחר בערב בשבע').date).toBe('2026-06-25')
    expect(understandMeeting('תקבעי עם מור מחרתיים בשלוש אחר הצהריים').date).toBe('2026-06-26')
  })

  it('a time word before a venue is never swallowed into the location', () => {
    const m = understandMeeting('תקבעי עם מור הערב בשמונה בלונה פארק')
    expect(m.location).toBe('לונה פארק')
    expect(m.time).toBe('20:00')
  })

  it('no place said → location empty (never invented)', () => {
    expect(understandMeeting('תקבעי עם מור הערב בשמונה').location).toBeNull()
  })
})

// ── #5 Dialogue manager — mid-flow corrections survive ──────────────────────
describe('#5 the dialogue manager applies corrections (does not lose the draft)', () => {
  function correct(orig: string, msg: string) {
    const st: CalendarCreateState = startCreate(orig)
    return resolvePendingMessage(st, msg, false)
  }
  const timeCorrections: Array<[string, string, string]> = [
    ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'בעצם בשמונה', '20:00'],   // inherits PM
    ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'לא, בתשע', '21:00'],
    ['תקבעי לי פגישה עם מור מחר בעשר בבוקר', 'בעצם באחת עשרה', '11:00'],
    ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'בעצם בשלוש אחר הצהריים', '15:00'],
    ['תקבעי לי פגישה עם מור מחר בשבע בערב', 'בשעה 21:30', '21:30'],
  ]
  it.each(timeCorrections)('"%s" + "%s" → updates the time, draft survives', (orig, msg, time) => {
    const r = correct(orig, msg)
    expect(r.action).toBe('update')
    if (r.action === 'update') expect(r.state.draft.time).toBe(time)
  })

  it('a date correction survives', () => {
    const r = correct('תקבעי לי פגישה עם מור מחר בשבע בערב', 'בעצם מחרתיים')
    expect(r.action).toBe('update')
    if (r.action === 'update') expect(r.state.draft.date).toBe('2026-06-26')
  })

  it('changing the person replaces the draft cleanly', () => {
    const r = correct('תקבעי לי פגישה עם מור מחר בשבע בערב', 'תקבעי עם אופיר מחר בשבע בערב')
    expect(r.action).toBe('replace')
    if (r.action === 'replace') { expect(r.state.draft.person).toBe('אופיר'); expect(r.state.draft.title).toBe('פגישה עם אופיר') }
  })

  it('a genuinely off-topic turn is answered while the draft is KEPT (never a false cancel)', () => {
    // Conversation state survives: the off-topic turn is park_keep'd (answered, draft
    // preserved so "כן" still confirms), NEVER a cold "בסדר, ביטלתי" and never forced
    // into the create machine.
    expect(correct('תקבעי לי פגישה עם מור מחר בשבע בערב', 'ספרי לי בדיחה').action).toBe('park_keep')
    expect(correct('תקבעי לי פגישה עם מור מחר בשבע בערב', 'אני קצת משועממת').action).toBe('park_keep')
  })

  it('the EXACT device chain: ask time → "ב-10 בבוקר בקפה נורדאו" merges time + location', () => {
    const st = startCreate('תקבעי לי פגישה עם עדי מחר')   // missing time → asks
    expect(st.phase).toBe('creating')
    const r = resolvePendingMessage(st, 'ב-10 בבוקר בקפה נורדאו', false)
    expect(r.action).toBe('update')
    if (r.action !== 'update') return
    expect(r.state.phase).toBe('confirming')
    expect(r.state.draft.person).toBe('עדי')        // preserved
    expect(r.state.draft.date).toBe('2026-06-25')   // preserved
    expect(r.state.draft.time).toBe('10:00')        // new
    expect(r.state.draft.location).toBe('קפה נורדאו') // new — the real bug
    // then a natural confirm completes it, with the location intact
    const r2 = resolvePendingMessage(r.state, 'כן אני רוצה שתקבעי את זה', false)
    expect(r2.action).toBe('save')
    if (r2.action === 'save') expect(r2.draft.location).toBe('קפה נורדאו')
  })
})

// ── #4 Title is always clean (no verbs / filler / raw transcript) ───────────
describe('#4 event title is the meeting, never raw transcript', () => {
  it.each([
    ['תקבעי פגישה עם מוריס הולכים ללונה פארק מחר בשמונה', 'פגישה עם מוריס', 'לונה פארק'],
    ['תקבעי עם עדי מחר בעשר נראה סרט', 'פגישה עם עדי', null],
    ['בוא ניפגש עם מוריס הערב באחת עשרה בלונה פארק', 'פגישה עם מוריס', 'לונה פארק'],
  ] as Array<[string, string, string | null]>)('"%s" → title "%s"', (t, title, loc) => {
    const m = understandMeeting(t)
    expect(m.title).toBe(title)
    expect(m.title).not.toMatch(/הולכים|נראה|בבקשה|תקבעי|נקבע|כן אני/)
    if (loc) expect(m.location).toBe(loc); else expect(m.location).toBeNull()
  })
})
