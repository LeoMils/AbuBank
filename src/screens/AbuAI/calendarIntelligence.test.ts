/**
 * Calendar Intelligence acceptance harness — reproduces the EXACT iPhone
 * failures Leo reported and proves the new understanding pipeline on the same
 * runtime path the UI uses (cleanTranscript → intent → extraction → confidence
 * → confirm → grounded read). Not isolated unit mocks.
 *
 * Time pinned to 2026-06-24 (Wednesday) so מחר/מחרתיים math is deterministic.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { startCreate, resolvePendingMessage, parseHebrewTimeDetailed } from './calendarCreate'
import { runCalendarPipeline, cleanTranscript } from './calendarPipeline'
import { shapeCreateConfirm } from './responseShaper'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'

const FIXED_TODAY = new Date('2026-06-24T09:00:00') // Wednesday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY) })
afterAll(() => { vi.useRealTimers() })

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = () => localDate(new Date())
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
function seedAlexandraToday() {
  addAppointment({
    title: 'פגישה עם אלכסנדרה', date: todayStr(), time: '19:00', emoji: '☕',
    location: 'קפה גרג רעננה', subject: 'טיול לאיטליה', personName: 'אלכסנדרה',
  } as Parameters<typeof addAppointment>[0])
}

// ═══ 1 & 2. Calendar READ — seeded event, two real phrasings ════════════════════
describe('iPhone #1 & #2 — calendar read finds the seeded event', () => {
  beforeEach(() => { installStorage(); seedAlexandraToday() })

  it('#1 "איזה פגישה יש לי היום" → finds Alexandra with time/location/subject', () => {
    expect(routePersonalQuery('איזה פגישה יש לי היום').type).toMatch(/^calendar_/)
    const a = tryGroundedAnswer('איזה פגישה יש לי היום') ?? ''
    expect(a).toContain('אלכסנדרה')
    expect(a).toContain('שבע')          // 19:00 spoken
    expect(a).toContain('קפה גרג')
    expect(a).toContain('טיול לאיטליה')
    expect(a).not.toContain('אין לך')   // never "no meetings" when storage has events
  })

  it('#2 "פגישות יש לי ביומן היום" (noun-first) → also finds the event', () => {
    expect(routePersonalQuery('פגישות יש לי ביומן היום').type).toMatch(/^calendar_/)
    const a = tryGroundedAnswer('פגישות יש לי ביומן היום') ?? ''
    expect(a).toContain('אלכסנדרה')
    expect(a).not.toContain('אין לך')
  })
})

// ═══ 3. Hebrew time — "שלוש אחר הצהריים" = 15:00, never בלילה ═══════════════════
describe('iPhone #3 — Hebrew afternoon time resolves to 15:00 (not 03:00)', () => {
  beforeEach(() => { installStorage() })

  it('"תקבעי לי פגישה עם מור מחרתיים בשעה שלוש אחר הצהריים" → 15:00, מחרתיים', () => {
    const s = startCreate('תקבעי לי פגישה עם מור מחרתיים בשעה שלוש אחר הצהריים')
    expect(s.draft.time).toBe('15:00')
    expect(s.draft.date).toBe(dayAfterStr())
    expect(s.draft.person).toBe('מור')
    expect(s.draft.title).toBe('פגישה עם מור')
  })

  const timeCases: Array<[string, string]> = [
    ['בשלוש אחר הצהריים', '15:00'],
    ['שלוש אחר הצהריים', '15:00'],   // STT dropped the ב prefix
    ['ב3:00 אחר הצהריים', '15:00'],  // numeric clock + period word
    ['בשלוש בלילה', '03:00'],
    ['בשבע בערב', '19:00'],
    ['בשבע בבוקר', '07:00'],
    ['באחת וחצי אחר הצהריים', '13:30'],
  ]
  for (const [phrase, expected] of timeCases) {
    it(`"${phrase}" → ${expected}`, () => {
      expect(parseHebrewTimeDetailed(phrase).time).toBe(expected)
    })
  }
})

// ═══ 4. No location said → location stays empty (NEVER invented) ════════════════
describe('iPhone #4 — a meeting with no location is not given one', () => {
  beforeEach(() => { installStorage() })

  it('"תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים" → location empty', () => {
    const s = startCreate('תקבעי לי פגישה עם מור מחרתיים בשלוש אחר הצהריים')
    expect(s.draft.location == null).toBe(true)
    expect(s.draft.subject == null).toBe(true)
    expect(shapeCreateConfirm(s.draft)).not.toContain('ב.') // no empty location artifact
  })
})

// ═══ 5. Location said → saved & displayed ══════════════════════════════════════
describe('iPhone #5 — a stated location is extracted, saved and read back', () => {
  beforeEach(() => { installStorage() })

  it('"…בקפה גרג ברעננה…" → location persisted and shown', () => {
    const s = startCreate('תקבעי לי מחר בשבע בערב פגישה עם אלכסנדרה בקפה גרג ברעננה לדבר על השכירות של הבית')
    expect(s.draft.location).toBe('קפה גרג ברעננה')
    const r = resolvePendingMessage(s, 'כן', false)
    expect(r.action).toBe('save')
    if (r.action !== 'save') return
    const d = r.draft
    addAppointment({
      title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅',
      ...(d.location ? { location: d.location } : {}),
      ...(d.subject ? { subject: d.subject } : {}),
      ...(d.notes ? { notes: d.notes } : {}),
    } as Parameters<typeof addAppointment>[0])
    const saved = loadAppointments().find(a => a.title === 'פגישה עם אלכסנדרה')
    expect(saved!.location).toBe('קפה גרג ברעננה')
    expect(tryGroundedAnswer('מה יש לי מחר') ?? '').toContain('קפה גרג ברעננה')
  })
})

// ═══ 6. Messy STT note about שכירות is cleaned (clean meaning, no garbage) ═══════
describe('iPhone #6 — note extracted as clean meaning, not raw STT garbage', () => {
  beforeEach(() => { installStorage() })

  it('"…היום בשבע בבוקר אנחנו צריכים לדבר על השכירות" → clean subject + notes, clean title', () => {
    const s = startCreate('תקבעי לי פגישה עם אלכסנדרה היום בשבע בבוקר אנחנו צריכים לדבר על השכירות')
    expect(s.draft.title).toBe('פגישה עם אלכסנדרה')     // no "אנחנו צריכים" garbage
    expect(s.draft.time).toBe('07:00')
    expect(s.draft.subject).toBe('שכירות')
    expect(s.draft.notes).toBe('לדבר על השכירות')        // clean action phrase
    expect(s.draft.location == null).toBe(true)          // none said → none invented
  })

  it('cleanTranscript strips fillers + stutters without losing meaning', () => {
    expect(cleanTranscript('תקבעי לי יעני פגישה עם מור מור מחר'))
      .toBe('תקבעי לי פגישה עם מור מחר')
  })

  it('the pipeline annotates provenance + confidence', () => {
    const r = runCalendarPipeline('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(r.isCreate).toBe(true)
    expect(r.draft.rawTranscript).toBe('תקבעי לי פגישה עם מור מחר בשבע בערב')
    expect(typeof r.draft.cleanedTranscript).toBe('string')
    expect(r.confidence).toBeGreaterThan(0.8)   // complete event → high confidence
    expect(r.needsClarification).toBe(false)
  })

  it('a missing critical field lowers confidence and asks for clarification (no silent bad save)', () => {
    const r = runCalendarPipeline('תקבעי לי פגישה עם מור') // no date/time
    expect(r.isCreate).toBe(true)
    expect(r.needsClarification).toBe(true)
    expect(r.confidence).toBeLessThan(0.8)
  })
})

// ═══ 7. Voice calendar answer triggers TTS (source contract) ════════════════════
describe('iPhone #7 — voice calendar answer goes through TTS', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const idx = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuAI/index.tsx'), 'utf8')

  it('grounded voice answers reach the serial speak + log TTS evidence', () => {
    expect(idx.includes('await speakVoiceMode(spokenText)')).toBe(true)
    expect(idx.includes('TTS_ENGINE_USED=')).toBe(true)
    expect(idx.includes('TTS_SUCCESS')).toBe(true)
  })

  it('a calendar read returns a non-null grounded answer (→ taken by the serial-speak branch)', () => {
    installStorage(); seedAlexandraToday()
    expect(tryGroundedAnswer('איזה פגישה יש לי היום')).not.toBeNull()
  })
})

// ═══ 8. Calendar UI card renders all existing structured fields ════════════════
describe('iPhone #8 — event card shows מה / מתי / איפה / נושא / הערות when present', () => {
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const card = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuCalendar/ApptCard.tsx'), 'utf8')

  it('ApptCard references title, time, location, subject and notes', () => {
    expect(card.includes('appt.title')).toBe(true)
    expect(card.includes('appt.time')).toBe(true)
    expect(card.includes('appt.location')).toBe(true)
    expect(card.includes('appt.subject')).toBe(true)   // newly added
    expect(card.includes('appt.notes')).toBe(true)
    expect(card.includes('data-testid="appt-subject"')).toBe(true)
  })

  it('the saved appointment schema carries the structured + provenance fields', () => {
    installStorage()
    const s = startCreate('תקבעי לי מחר בשבע בערב פגישה עם אלכסנדרה בקפה גרג ברעננה לדבר על השכירות של הבית')
    const r = resolvePendingMessage(s, 'כן', false)
    if (r.action !== 'save') throw new Error('expected save')
    const d = r.draft
    expect(d.rawTranscript).toBeTruthy()
    expect(d.cleanedTranscript).toBeTruthy()
    expect(typeof d.confidence).toBe('number')
    expect(d.location).toBe('קפה גרג ברעננה')
    expect(d.subject).toBe('שכירות הבית')
    expect(d.notes).toBe('לדבר על השכירות של הבית')
  })
})
