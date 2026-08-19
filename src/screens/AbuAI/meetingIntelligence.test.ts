/**
 * Meeting Intelligence acceptance harness.
 *
 * Uses LONG, messy, real-world speech (the way Martita actually talks — rambling,
 * reason-before-logistics, self-corrections, narrative filler) and proves the
 * engine still understands the SAME clean meeting. The transcript is evidence;
 * the event is understanding. Runs the real engine + the create flow + the
 * grounded read — not isolated field parsers.
 *
 * Time pinned to 2026-06-24 (Wednesday).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { understandMeeting } from './meetingIntelligence'
import { startCreate, resolvePendingMessage, isCreateIntent } from './calendarCreate'
import { tryGroundedAnswer } from './service'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return localDate(d) }
const dayAfterStr = () => { const d = new Date(); d.setDate(d.getDate() + 2); return localDate(d) }

let storage: Record<string, string> = {}
function installStorage() {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
}

// Narrative noise that must NEVER reach the saved event.
const NARRATIVE_NOISE = /בוא נעשה|אז ככה|תשמעי|אני חושבת|בא לי|אנחנו צריכים|אני צריכה להיפגש/

describe('Meeting Intelligence — long messy speech → clean understood meeting', () => {
  beforeEach(() => { installStorage() })

  // ── Transcript A: the prompt's flagship example, Hebrew, reason-before-logistics
  const A = 'מחר אני צריכה להיפגש עם אלכסנדרה כי אנחנו צריכים לסגור את הסכם השכירות לפני שהדיירים החדשים מגיעים. בוא נעשה את זה בקפה גרג ברעננה בסביבות שבע בערב'

  it('A — understands WHO/DATE/TIME/LOCATION/SUBJECT/PURPOSE/TITLE/NOTES', () => {
    const m = understandMeeting(A)
    expect(m.who).toBe('אלכסנדרה')
    expect(m.date).toBe(tomorrowStr())
    expect(m.time).toBe('19:00')
    expect(m.location).toBe('קפה גרג ברעננה')
    expect(m.subject).toContain('שכירות')                 // topic understood
    expect(m.purpose).toContain('הסכם השכירות')           // WHY understood
    expect(m.title).toBe('פגישה עם אלכסנדרה')             // clean title
    // Notes = clean summary, NOT the raw transcript / narrative.
    expect(m.notes).toBeTruthy()
    expect(m.notes!).not.toMatch(NARRATIVE_NOISE)
    expect(m.needsClarification).toBe(false)
    expect(m.confidence).toBeGreaterThan(0.8)
    // The transcript is kept only as evidence.
    expect(m.rawTranscript).toBe(A)
    expect(m.title).not.toBe(m.rawTranscript)
  })

  // ── Transcript B: missing time — must ASK, never invent
  const B = 'תשמעי אני חושבת שכדאי שנקבע משהו עם הרופאה של מור ביום שלישי הבא אחר הצהריים כי אני רוצה לשאול אותה על הבדיקות'

  it('B — resolves next-Tuesday, infers topic, and ASKS for the missing time (no invention)', () => {
    const m = understandMeeting(B)
    expect(isCreateIntent(B)).toBe(true)                  // narrative create detected
    expect(m.date).toBe('2026-06-30')                     // יום שלישי הבא
    expect(m.time).toBeNull()                             // only "אחר הצהריים", no hour
    expect(m.needsClarification).toBe(true)
    expect(m.clarificationQuestion).toBe('באיזו שעה?')
    expect(m.location).toBeNull()                         // none said → none invented
    expect(m.subject).toContain('בדיקות')
    expect(m.notes!).not.toMatch(NARRATIVE_NOISE)
  })

  // ── Transcript C: detached period + family name starting with a stop-letter
  const C = 'אז ככה מחרתיים בערב בסביבות שמונה בא לי לשבת עם לאו בבית קפה לדבר על החתונה'

  it('C — cross-clause time (20:00), recovers "לאו", clean title, topic = חתונה', () => {
    const m = understandMeeting(C)
    expect(m.date).toBe(dayAfterStr())
    expect(m.time).toBe('20:00')                          // "בערב" + "בסביבות שמונה"
    expect(m.who).toBe('לאו')                             // name starting with ל recovered
    expect(m.title).toBe('פגישה עם לאו')                  // not "אז ככה … בא לי"
    expect(m.location).toBe('בית קפה')
    expect(m.subject).toBe('חתונה')
    expect(m.notes!).not.toMatch(NARRATIVE_NOISE)
  })

  // ── End-to-end: long speech → create flow → save → semantic read
  it('A end-to-end — create from long speech, save, and read it back semantically', () => {
    const s = startCreate(A)
    expect(s.phase).toBe('confirming')                    // fully understood → confirm
    expect(s.draft.title).toBe('פגישה עם אלכסנדרה')
    expect(s.draft.time).toBe('19:00')
    expect(s.draft.location).toBe('קפה גרג ברעננה')
    expect(s.draft.notes!).not.toMatch(NARRATIVE_NOISE)   // clean notes, not transcript
    expect(s.draft.rawTranscript).toBe(A)                 // evidence preserved

    const r = resolvePendingMessage(s, 'כן', false)
    if (r.action !== 'save') throw new Error('expected save')
    const d = r.draft
    addAppointment({
      title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅',
      ...(d.location ? { location: d.location } : {}),
      ...(d.subject ? { subject: d.subject } : {}),
      ...(d.purpose ? { purpose: d.purpose } : {}),
      ...(d.notes ? { notes: d.notes } : {}),
    } as Parameters<typeof addAppointment>[0])

    const saved = loadAppointments().find(a => a.title === 'פגישה עם אלכסנדרה')!
    expect(saved.location).toBe('קפה גרג ברעננה')
    expect(saved.subject).toContain('שכירות')
    // The saved event is the understanding, never the raw transcript.
    expect(JSON.stringify(saved)).not.toMatch(NARRATIVE_NOISE)

    // Semantic read: a human-assistant answer with who/time/topic/why.
    const read = tryGroundedAnswer('מה יש לי מחר') ?? ''
    expect(read).toContain('אלכסנדרה')
    expect(read).toContain('קפה גרג')
    expect(read).toContain('שכירות')        // topic surfaced
    expect(read).not.toMatch(NARRATIVE_NOISE)
  })

  // ── Backward compatibility: a short clean phrase still works identically
  it('short clean phrase still understood (no regression)', () => {
    const m = understandMeeting('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(m.who).toBe('מור')
    expect(m.time).toBe('19:00')
    expect(m.title).toBe('פגישה עם מור')
    expect(m.location).toBeNull()
    expect(m.needsClarification).toBe(false)
  })
})
