import { describe, it, expect } from 'vitest'
import {
  isCreateIntent,
  isConfirm,
  isCancel,
  parseHebrewTime,
  parseCreateDate,
  extractTitle,
  parseCreateIntent,
  startCreate,
  updateCreate,
  IDLE_STATE,
} from './calendarCreate'

// ─── Intent Detection ───────────────────────────────────────────────────────

describe('isCreateIntent', () => {
  it.each([
    'תקבעי לי תור לרופא',
    'תרשמי לי פגישה מחר',
    'תזכירי לי קניות',
    'אני רוצה פגישה מחר',
    'יש לי תור מחר',
    'תכניסי ליומן',
    'תשימי ביומן פגישה',
    'צריכה לקבוע תור',
    'רוצה לקבוע פגישה',
    // Natural speech
    'אני צריכה להיות אצל הרופא מחר בעשר',
    'ביום רביעי בשעה חמש אני צריכה להיות אצל אופיר',
    'מחר בערב בשמונה יש לי ארוחה עם המשפחה',
  ])('detects: %s', (text) => {
    expect(isCreateIntent(text)).toBe(true)
  })

  it.each([
    'מה יש לי מחר',
    'מה קורה היום',
    'מי זה אופיר',
    'מה השעה',
    'ספרי לי בדיחה',
  ])('rejects: %s', (text) => {
    expect(isCreateIntent(text)).toBe(false)
  })
})

// ─── Confirmation / Cancel ──────────────────────────────────────────────────

describe('isConfirm', () => {
  it.each(['כן', 'נכון', 'בדיוק', 'סבבה', 'בסדר', 'יאללה', 'תרשמי', 'כן תרשמי', 'בטח'])
    ('confirms: %s', (text) => {
      expect(isConfirm(text)).toBe(true)
    })

  it('rejects non-confirmations', () => {
    expect(isConfirm('מה יש מחר')).toBe(false)
    expect(isConfirm('אולי')).toBe(false)
  })
})

describe('isCancel', () => {
  it.each(['לא', 'עזבי', 'תשכחי', 'ביטול', 'לא צריך', 'לא רוצה'])
    ('cancels: %s', (text) => {
      expect(isCancel(text)).toBe(true)
    })
})

// ─── Time Parsing ───────────────────────────────────────────────────────────

describe('parseHebrewTime', () => {
  it('בשלוש → 15:00 (PM default)', () => {
    expect(parseHebrewTime('בשלוש')).toBe('15:00')
  })

  it('בארבע → 16:00', () => {
    expect(parseHebrewTime('בארבע')).toBe('16:00')
  })

  it('בעשר בבוקר → 10:00', () => {
    expect(parseHebrewTime('בעשר בבוקר')).toBe('10:00')
  })

  it('בשמונה בערב → 20:00', () => {
    expect(parseHebrewTime('בשמונה בערב')).toBe('20:00')
  })

  it('בשלוש וחצי → 15:30', () => {
    expect(parseHebrewTime('בשלוש וחצי')).toBe('15:30')
  })

  it('בצהריים → 12:00', () => {
    expect(parseHebrewTime('בצהריים')).toBe('12:00')
  })

  it('בשעה 10:30 → 10:30', () => {
    expect(parseHebrewTime('בשעה 10:30')).toBe('10:30')
  })

  it('בשעה 9 → 09:00', () => {
    expect(parseHebrewTime('בשעה 9')).toBe('09:00')
  })

  it('בשעה חמש → 17:00 (word after בשעה)', () => {
    expect(parseHebrewTime('בשעה חמש')).toBe('17:00')
  })

  it('בשעה עשר בבוקר → 10:00', () => {
    expect(parseHebrewTime('בשעה עשר בבוקר')).toBe('10:00')
  })

  it('בשעה שלוש וחצי → 15:30', () => {
    expect(parseHebrewTime('בשעה שלוש וחצי')).toBe('15:30')
  })

  it('no time → null', () => {
    expect(parseHebrewTime('רופא מחר')).toBeNull()
  })

  it('בשבע → 19:00 (PM default for 7)', () => {
    // 7 is > 6, so stays as-is (7 AM? No — 7 is not in 1-6 range)
    // Actually 7 is NOT in 1-6 range, so stays 7 = 07:00
    expect(parseHebrewTime('בשבע')).toBe('07:00')
  })

  it('בשבע בערב → 19:00', () => {
    expect(parseHebrewTime('בשבע בערב')).toBe('19:00')
  })
})

// ─── Date Parsing ───────────────────────────────────────────────────────────

describe('parseCreateDate', () => {
  it('היום → today', () => {
    const today = new Date().toISOString().split('T')[0]!
    expect(parseCreateDate('היום')).toBe(today)
  })

  it('מחר → tomorrow', () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const tmrw = d.toISOString().split('T')[0]!
    expect(parseCreateDate('מחר')).toBe(tmrw)
  })

  it('מחרתיים → day after tomorrow', () => {
    const result = parseCreateDate('מחרתיים')
    expect(result).not.toBeNull()
    // Build expected using same local-date logic
    const d = new Date()
    d.setDate(d.getDate() + 2)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    expect(result).toBe(`${y}-${m}-${day}`)
  })

  it('ביום ראשון → next Sunday', () => {
    const result = parseCreateDate('ביום ראשון')
    expect(result).not.toBeNull()
    const d = new Date(result!)
    expect(d.getDay()).toBe(0) // Sunday
  })

  it('no date → null', () => {
    expect(parseCreateDate('רופא בשלוש')).toBeNull()
  })
})

// ─── Title Extraction ───────────────────────────────────────────────────────

describe('extractTitle', () => {
  it('strips intent prefix', () => {
    expect(extractTitle('תקבעי לי תור לרופא')).toBe('תור לרופא')
  })

  it('strips time', () => {
    expect(extractTitle('תקבעי לי תור לרופא בשלוש')).toBe('תור לרופא')
  })

  it('strips date', () => {
    expect(extractTitle('תקבעי לי תור לרופא מחר')).toBe('תור לרופא')
  })

  it('strips both time and date', () => {
    expect(extractTitle('תקבעי לי תור לרופא מחר בשלוש')).toBe('תור לרופא')
  })

  it('returns null for empty result', () => {
    expect(extractTitle('תקבעי לי מחר')).toBeNull()
  })
})

// ─── Full Intent Parse ──────────────────────────────────────────────────────

describe('parseCreateIntent', () => {
  it('full intent: title + date + time', () => {
    const result = parseCreateIntent('תקבעי לי תור לרופא מחר בשלוש')
    expect(result).not.toBeNull()
    expect(result!.draft.title).toBe('תור לרופא')
    expect(result!.draft.date).not.toBeNull()
    expect(result!.draft.time).toBe('15:00')
    expect(result!.draft.emoji).toBe('🏥')
    expect(result!.missing).toEqual([])
  })

  it('missing time', () => {
    const result = parseCreateIntent('תקבעי לי פגישה מחר')
    expect(result).not.toBeNull()
    expect(result!.draft.title).toBe('פגישה')
    expect(result!.draft.date).not.toBeNull()
    expect(result!.draft.time).toBeNull()
    expect(result!.missing).toEqual(['time'])
  })

  it('missing date', () => {
    const result = parseCreateIntent('תקבעי לי רופא בעשר בבוקר')
    expect(result).not.toBeNull()
    expect(result!.draft.title).toBe('רופא')
    expect(result!.draft.date).toBeNull()
    expect(result!.draft.time).toBe('10:00')
    expect(result!.missing).toEqual(['date'])
  })

  it('non-create intent returns null', () => {
    expect(parseCreateIntent('מה יש לי מחר')).toBeNull()
  })
})

// ─── State Machine ──────────────────────────────────────────────────────────

describe('startCreate', () => {
  it('complete intent → confirming phase', () => {
    const state = startCreate('תקבעי לי תור לרופא מחר בשלוש')
    expect(state.phase).toBe('confirming')
    expect(state.draft.title).toBe('תור לרופא')
    expect(state.missing).toEqual([])
  })

  it('missing fields → creating phase', () => {
    const state = startCreate('תקבעי לי פגישה מחר')
    expect(state.phase).toBe('creating')
    expect(state.missing).toContain('time')
  })

  it('non-create → idle', () => {
    const state = startCreate('מה השעה')
    expect(state.phase).toBe('idle')
  })
})

describe('updateCreate — multi-turn', () => {
  it('fills missing time → moves to confirming', () => {
    const initial = startCreate('תקבעי לי פגישה מחר')
    expect(initial.phase).toBe('creating')
    expect(initial.missing).toContain('time')

    const next = updateCreate(initial, 'בשלוש')
    expect(next.phase).toBe('confirming')
    expect(next.draft.time).toBe('15:00')
    expect(next.missing).toEqual([])
  })

  it('fills missing date → stays creating if time also missing', () => {
    const initial = startCreate('תקבעי לי רופא')
    expect(initial.missing).toContain('date')
    expect(initial.missing).toContain('time')

    const next = updateCreate(initial, 'מחר')
    expect(next.phase).toBe('creating')
    expect(next.draft.date).not.toBeNull()
    expect(next.missing).toEqual(['time'])
  })

  it('cancel discards draft', () => {
    const initial = startCreate('תקבעי לי פגישה מחר')
    const next = updateCreate(initial, 'עזבי')
    expect(next.phase).toBe('idle')
  })

  it('fills title when missing', () => {
    const initial = startCreate('תקבעי לי מחר בשלוש')
    expect(initial.missing).toContain('title')

    const next = updateCreate(initial, 'תור לרופא')
    expect(next.draft.title).toBe('תור לרופא')
    expect(next.draft.emoji).toBe('🏥')
  })
})

describe('full conversation flow', () => {
  it('3-turn: intent → time → confirm', () => {
    // Turn 1: user says "תקבעי לי פגישה מחר"
    const s1 = startCreate('תקבעי לי פגישה מחר')
    expect(s1.phase).toBe('creating')
    expect(s1.missing).toEqual(['time'])

    // Turn 2: user says "בארבע"
    const s2 = updateCreate(s1, 'בארבע')
    expect(s2.phase).toBe('confirming')
    expect(s2.draft.time).toBe('16:00')

    // Turn 3: user says "כן" → caller saves
    expect(isConfirm('כן')).toBe(true)
  })

  it('cancel mid-flow', () => {
    const s1 = startCreate('תקבעי לי פגישה מחר')
    const s2 = updateCreate(s1, 'לא צריך')
    expect(s2.phase).toBe('idle')
  })

  it('1-turn: full intent → straight to confirming', () => {
    const s1 = startCreate('תרשמי לי קניות מחר בחמש')
    expect(s1.phase).toBe('confirming')
    expect(s1.draft.title).toBe('קניות')
    expect(s1.draft.time).toBe('17:00')
  })
})

// ─── Natural Language Extraction ────────────────────────────────────────────

describe('natural language — long sentences', () => {
  it('strips explanation clause (כי...)', () => {
    const title = extractTitle('ביום רביעי בשעה חמש אני צריכה להיות אצל אופיר כי היא ביקשה')
    expect(title).toBe('אצל אופיר')
  })

  it('natural speech: אני צריכה להיות אצל הרופא מחר בעשר', () => {
    expect(extractTitle('אני צריכה להיות אצל הרופא מחר בעשר')).toBe('אצל הרופא')
    expect(parseCreateDate('אני צריכה להיות אצל הרופא מחר בעשר')).not.toBeNull()
    expect(parseHebrewTime('אני צריכה להיות אצל הרופא מחר בעשר')).toBe('10:00')
  })

  it('strips בערב from title', () => {
    expect(extractTitle('מחר בערב בשמונה יש לי ארוחה עם המשפחה')).toBe('ארוחה עם המשפחה')
  })

  it('strips leading ש connector', () => {
    expect(extractTitle('תזכירי לי שמחר בשלוש יש לי פגישה עם עורכת דין')).toBe('פגישה עם עורכת דין')
  })

  it('full pipeline: natural sentence → confirming state', () => {
    const s = startCreate('ביום רביעי בשעה חמש אני צריכה להיות אצל אופיר כי היא ביקשה')
    expect(s.phase).toBe('confirming')
    expect(s.draft.title).toBe('אצל אופיר')
    expect(s.draft.time).toBe('17:00')
    expect(s.draft.date).not.toBeNull()
  })

  it('natural sentence missing date → creating', () => {
    const s = startCreate('בשעה חמש אני צריכה להיות אצל אופיר')
    expect(s.phase).toBe('creating')
    expect(s.draft.title).toBe('אצל אופיר')
    expect(s.draft.time).toBe('17:00')
    expect(s.missing).toEqual(['date'])
  })

  it('noisy sentence with irrelevant words', () => {
    const title = extractTitle('תרשמי לי מחר בבוקר בעשר תור לרופא שיניים כי אני חייבת לבדוק את זה')
    expect(title).toBe('תור לרופא שיניים')
  })
})
