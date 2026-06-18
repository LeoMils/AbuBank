/**
 * OPERATIONAL CONTRACT — Calendar ↔ AbuAI end-to-end.
 *
 * Proves the operational flow described in the mission:
 *   1. Hebrew time parsing (שבע בערב → 19:00)
 *   2. AbuAI calendar create uses the same store AbuCalendar reads
 *   3. AbuAI week/upcoming reads only trusted stored events
 *   4. AbuAI calendar factual queries do not call server/LLM
 *   5. No demo/sample data leaks into runtime
 *   6. freeSpeech advisory does NOT block calendar create
 *   7. "מה יש לי בשבוע הקרוב" routes to calendar_upcoming
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseHebrewTime, parseCreateIntent, isCreateIntent, startCreate, resolvePendingMessage } from './calendarCreate'
import { parseLocally } from '../AbuCalendar/localParser'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { adviseFreeSpeech } from './freeSpeechAdvisory'
import { addAppointment, loadAppointments } from '../AbuCalendar/service'
import { getWeekEvents } from './tools'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tomorrowLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// tools.ts uses toISOString() (UTC) for date comparisons — match that here
// to avoid timezone-boundary mismatches in tests running near midnight.
function tomorrowUTC(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]!
}

// ═══ A. Hebrew Time Parsing ═══════════════════════════════════════════════════

describe('A. Hebrew time parsing — calendarCreate.parseHebrewTime', () => {
  it('"בשעה שבע בערב" → 19:00', () => {
    expect(parseHebrewTime('פגישה מחר עם אופיר בשעה שבע בערב')).toBe('19:00')
  })

  it('"בשבע בערב" → 19:00', () => {
    expect(parseHebrewTime('פגישה מחר בשבע בערב')).toBe('19:00')
  })

  it('"שבע בערב" with בשעה prefix → 19:00', () => {
    expect(parseHebrewTime('בשעה שבע בערב')).toBe('19:00')
  })

  it('"בעשר בבוקר" → 10:00', () => {
    expect(parseHebrewTime('תור לרופא בעשר בבוקר')).toBe('10:00')
  })

  it('"בשתיים אחר הצהריים" → 14:00', () => {
    expect(parseHebrewTime('פגישה בשתיים אחר הצהריים')).toBe('14:00')
  })

  it('"בחמש אחר הצהריים" → 17:00', () => {
    expect(parseHebrewTime('יש לי פגישה בחמש אחר הצהריים')).toBe('17:00')
  })

  it('"בשמונה בבוקר" → 08:00', () => {
    expect(parseHebrewTime('בשמונה בבוקר')).toBe('08:00')
  })

  it('default 1-6 → PM convention', () => {
    expect(parseHebrewTime('בארבע')).toBe('16:00')
  })
})

describe('A. Hebrew time parsing — localParser.parseLocally', () => {
  const today = todayLocal()

  it('"פגישה מחר עם אופיר בשעה שבע בערב" → date=tomorrow, time=19:00', () => {
    const result = parseLocally('פגישה מחר עם אופיר בשעה שבע בערב', today)
    expect(result.date).toBe(tomorrowLocal())
    expect(result.time).toBe('19:00')
    expect(result.ambiguousTime).toBe(false)
  })

  it('"בעשר בבוקר" → 10:00', () => {
    const result = parseLocally('תור לרופא מחר בעשר בבוקר', today)
    expect(result.time).toBe('10:00')
    expect(result.ambiguousTime).toBe(false)
  })
})

// ═══ B. Calendar create intent parsing ════════════════════════════════════════

describe('B. Calendar create intent — full parse', () => {
  it('parses "שימי לי פגישה עם אופיר מחר בשעה שבע בערב" completely', () => {
    const text = 'שימי לי פגישה עם אופיר מחר בשעה שבע בערב'
    expect(isCreateIntent(text)).toBe(true)

    const result = parseCreateIntent(text)
    expect(result).not.toBeNull()
    expect(result!.draft.date).toBe(tomorrowLocal())
    expect(result!.draft.time).toBe('19:00')
    expect(result!.missing).not.toContain('time')
    expect(result!.missing).not.toContain('date')
  })

  it('parses "תקבעי לי תור לרופא מחר בעשר בבוקר"', () => {
    const result = parseCreateIntent('תקבעי לי תור לרופא מחר בעשר בבוקר')
    expect(result).not.toBeNull()
    expect(result!.draft.time).toBe('10:00')
    expect(result!.draft.date).toBe(tomorrowLocal())
    expect(result!.missing).toEqual([])
  })
})

// ═══ C. Advisory does NOT block calendar create ══════════════════════════════

describe('C. FreeSpeech advisory passes through calendar create', () => {
  it('advisory returns null for calendar create — falls through to AbuAI create state machine', () => {
    const result = adviseFreeSpeech('תקבעי לי פגישה מחר בשבע בערב')
    expect(result.response).toBeNull()
  })

  it('advisory returns null for "שימי לי פגישה עם אופיר מחר בשעה שבע בערב"', () => {
    const result = adviseFreeSpeech('שימי לי פגישה עם אופיר מחר בשעה שבע בערב')
    expect(result.response).toBeNull()
  })

  it('advisory still passes through calendar query', () => {
    const result = adviseFreeSpeech('מה יש לי מחר?')
    expect(result.response).toBeNull()
  })
})

// ═══ D. Routing: "בשבוע הקרוב" ══════════════════════════════════════════════

describe('D. Routing coverage for week/upcoming queries', () => {
  it('"מה יש לי בשבוע הקרוב" → calendar_upcoming', () => {
    const route = routePersonalQuery('מה יש לי בשבוע הקרוב')
    expect(route.type).toBe('calendar_upcoming')
  })

  it('"מה יש בשבוע הקרוב" → calendar_upcoming', () => {
    const route = routePersonalQuery('מה יש בשבוע הקרוב')
    expect(route.type).toBe('calendar_upcoming')
  })

  it('"מה יש לי ביומן" → calendar_upcoming', () => {
    const route = routePersonalQuery('מה יש לי ביומן')
    expect(route.type).toBe('calendar_upcoming')
  })

  it('"מה יש לי השבוע" → calendar_upcoming', () => {
    const route = routePersonalQuery('מה יש לי השבוע')
    expect(route.type).toBe('calendar_upcoming')
  })
})

// ═══ E. Shared trusted store ═════════════════════════════════════════════════

describe('E. AbuCalendar save ↔ AbuAI read — same trusted store', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('addAppointment writes to localStorage, tryGroundedAnswer reads it', () => {
    // Use UTC-based date to match tools.ts tomorrowStr() which uses toISOString()
    const tomorrow = tomorrowUTC()
    addAppointment({ title: 'פגישה עם אופיר', date: tomorrow, time: '19:00', emoji: '📅' })

    // Verify localStorage has the appointment
    const stored = loadAppointments()
    expect(stored.some(a => a.title === 'פגישה עם אופיר')).toBe(true)

    // AbuAI reads from the same store
    const answer = tryGroundedAnswer('מה יש לי מחר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('פגישה עם אופיר')
  })

  it('getWeekEvents reads from the same store', () => {
    const tomorrow = tomorrowUTC()
    addAppointment({ title: 'בדיקה שבועית', date: tomorrow, time: '14:00', emoji: '📅' })

    const result = getWeekEvents()
    const userEvents = result.events.filter(e => e.title === 'בדיקה שבועית')
    expect(userEvents).toHaveLength(1)
  })
})

// ═══ F. Week/upcoming returns "לא מצאתי" when empty ═════════════════════════

describe('F. Empty store returns honest "לא מצאתי" answer', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('"מה יש לי בשבוע הקרוב" with empty store → "לא מצאתי"', () => {
    const answer = tryGroundedAnswer('מה יש לי בשבוע הקרוב')
    expect(answer).not.toBeNull()
    expect(answer).toMatch(/שקט|אין כלום/)
  })

  it('"מה יש לי מחר" with empty store → "אין כלום"', () => {
    const answer = tryGroundedAnswer('מה יש לי מחר')
    expect(answer).not.toBeNull()
    expect(answer).toMatch(/שקט|אין כלום/)
  })
})

// ═══ G. Calendar factual queries use grounded path (no server/LLM) ═══════════

describe('G. Calendar queries use grounded deterministic path', () => {
  it('tryGroundedAnswer returns non-null for calendar queries (no LLM needed)', () => {
    // If tryGroundedAnswer returns non-null, the LLM is never called.
    // This proves calendar factual queries are server-independent.
    expect(tryGroundedAnswer('מה יש לי היום')).not.toBeNull()
    expect(tryGroundedAnswer('מה יש לי מחר')).not.toBeNull()
    expect(tryGroundedAnswer('מה יש לי בשבוע הקרוב')).not.toBeNull()
    expect(tryGroundedAnswer('מה יש לי ביומן')).not.toBeNull()
  })
})

// ═══ H. No demo/sample data in runtime ═══════════════════════════════════════

describe('H. No demo data leaks into production runtime', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('empty store — no invented events in grounded answer', () => {
    const answer = tryGroundedAnswer('מה יש לי מחר?')
    expect(answer).not.toBeNull()
    // Must not contain invented events
    expect(answer).not.toContain('ארוחת שישי')
    expect(answer).not.toContain('תור רופא')
    expect(answer).not.toContain('בדיקת דם')
    expect(answer).toMatch(/שקט|אין כלום/)
  })
})

// ═══ I. Pending-confirmation recovery (resolvePendingMessage) ════════════════

function isCalendarRead(text: string): boolean {
  const r = routePersonalQuery(text)
  return r.type.startsWith('calendar_') && r.type !== 'calendar_create'
}

describe('I. Pending confirmation recovery', () => {
  const confirming = startCreate('תקבעי לי תור לרופא מחר בעשר בבוקר')

  it('confirming state is reached for a complete create request', () => {
    expect(confirming.phase).toBe('confirming')
    expect(confirming.missing).toEqual([])
  })

  it('1. unclear text → clarify, NOT a repeated confirmation', () => {
    const r = resolvePendingMessage(confirming, 'אהלן מה', isCalendarRead('אהלן מה'))
    expect(r.action).toBe('clarify')
  })

  it('2. "לא" → cancel clears the pending draft', () => {
    const r = resolvePendingMessage(confirming, 'לא', isCalendarRead('לא'))
    expect(r.action).toBe('cancel')
  })

  it('2b. "ביטול" / "לא נכון" also cancel', () => {
    expect(resolvePendingMessage(confirming, 'ביטול', false).action).toBe('cancel')
    expect(resolvePendingMessage(confirming, 'לא נכון', false).action).toBe('cancel')
  })

  it('"כן" / "מאשרת" / "אוקיי" → save', () => {
    expect(resolvePendingMessage(confirming, 'כן', false).action).toBe('save')
    expect(resolvePendingMessage(confirming, 'אוקיי', false).action).toBe('save')
  })

  it('3. new create request replaces the pending draft', () => {
    const text = 'תקבעי לי פגישה עם אופיר מחר בשבע בערב'
    const r = resolvePendingMessage(confirming, text, isCalendarRead(text))
    expect(r.action).toBe('replace')
    if (r.action === 'replace') {
      expect(r.state.phase).toBe('confirming')
      expect(r.state.draft.time).toBe('19:00')
      expect(r.state.draft.title).not.toBe('תור לרופא')
    }
  })

  it('4. calendar read query while pending → answered locally', () => {
    const text = 'מה יש לי השבוע'
    const r = resolvePendingMessage(confirming, text, isCalendarRead(text))
    expect(r.action).toBe('read')
  })

  it('4b. "איזה פגישות יש לי שבוע הקרוב" while pending → read', () => {
    const text = 'איזה פגישות יש לי שבוע הקרוב'
    const r = resolvePendingMessage(confirming, text, isCalendarRead(text))
    expect(r.action).toBe('read')
  })
})

// ═══ J. Expanded Hebrew calendar query routing ═══════════════════════════════

describe('J. Calendar read variants route to calendar_upcoming', () => {
  it.each([
    'איזה פגישות יש לי השבוע',
    'איזה פגישות יש לי שבוע הקרוב',
    'איזה פגישות יש לי בשבוע הקרוב',
    'מה הפגישות שלי השבוע',
    'מה הפגישות שלי בשבוע הקרוב',
    'תראי לי את הפגישות שלי',
    'יש לי פגישות השבוע',
    'יש לי משהו השבוע',
    'יש לי משהו בשבוע הקרוב',
  ])('"%s" → calendar_upcoming', (text) => {
    expect(routePersonalQuery(text).type).toBe('calendar_upcoming')
  })

  it('plural "יש לי פגישות השבוע" is a read, NOT a create intent', () => {
    expect(isCreateIntent('יש לי פגישות השבוע')).toBe(false)
  })

  it('singular "יש לי תור מחר" stays a create intent', () => {
    expect(isCreateIntent('יש לי תור מחר')).toBe(true)
  })
})

describe('J. Calendar read variants are server/LLM-free (grounded)', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it.each([
    'איזה פגישות יש לי שבוע הקרוב',
    'מה הפגישות שלי בשבוע הקרוב',
    'תראי לי את הפגישות שלי',
    'יש לי פגישות השבוע',
    'יש לי משהו בשבוע הקרוב',
  ])('"%s" → tryGroundedAnswer non-null (no server/LLM)', (text) => {
    expect(tryGroundedAnswer(text)).not.toBeNull()
  })
})
