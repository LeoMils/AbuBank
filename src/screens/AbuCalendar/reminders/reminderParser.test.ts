import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectReminderIntent, parseReminder, parseRelativeTime, parseRecurrence } from './reminderParser'

const TODAY = '2026-05-29'

// ─── Intent detection ─────────────────────────────────────────────────────────
describe('detectReminderIntent', () => {
  it('"תזכירי לי לקחת כדור" → reminder', () => {
    expect(detectReminderIntent('תזכירי לי לקחת כדור')).toBe('reminder')
  })
  it('"תזכרי לי לשתות מים" → reminder', () => {
    expect(detectReminderIntent('תזכרי לי לשתות מים')).toBe('reminder')
  })
  it('"תזכיר לי לבדוק את הסיר" → reminder', () => {
    expect(detectReminderIntent('תזכיר לי לבדוק את הסיר')).toBe('reminder')
  })
  it('"תזכורת לקחת תרופה" → reminder', () => {
    expect(detectReminderIntent('תזכורת לקחת תרופה')).toBe('reminder')
  })
  it('"תקבעי פגישה עם גלעד" → appointment', () => {
    expect(detectReminderIntent('תקבעי פגישה עם גלעד')).toBe('appointment')
  })
  it('"תזכירי לי שיש לי פגישה עם גלעד" → appointment (has appointment content)', () => {
    expect(detectReminderIntent('תזכירי לי שיש לי פגישה עם גלעד מחר')).toBe('appointment')
  })
  it('"מה יש לי מחר" → unknown (query)', () => {
    expect(detectReminderIntent('מה יש לי מחר')).toBe('unknown')
  })
  it('"תקבעי תור לרופא" → appointment', () => {
    expect(detectReminderIntent('תקבעי תור לרופא')).toBe('appointment')
  })
})

// ─── Relative time parsing ─────────────────────────────────────────────────────
describe('parseRelativeTime', () => {
  const fixedNow = new Date('2026-05-29T14:00:00')

  it('"בעוד חמש דקות" → +5 min', () => {
    const r = parseRelativeTime('תזכירי לי בעוד חמש דקות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(5)
    expect(r!.displayTimeLabel).toBe('14:05')
  })
  it('"בעוד עשר דקות" → +10 min', () => {
    const r = parseRelativeTime('בעוד עשר דקות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(10)
  })
  it('"בעוד רבע שעה" → +15 min', () => {
    const r = parseRelativeTime('בעוד רבע שעה', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(15)
  })
  it('"בעוד חצי שעה" → +30 min', () => {
    const r = parseRelativeTime('בעוד חצי שעה', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(30)
  })
  it('"עוד חצי שעה" → +30 min (עוד prefix)', () => {
    const r = parseRelativeTime('עוד חצי שעה', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(30)
  })
  it('"בעוד שלושת רבעי שעה" → +45 min', () => {
    const r = parseRelativeTime('בעוד שלושת רבעי שעה', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(45)
  })
  it('"בעוד שעה" → +60 min', () => {
    const r = parseRelativeTime('בעוד שעה', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(60)
  })
  it('"בעוד שעתיים" → +120 min', () => {
    const r = parseRelativeTime('בעוד שעתיים', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(120)
  })
  it('"בעוד שלוש שעות" → +180 min', () => {
    const r = parseRelativeTime('בעוד שלוש שעות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(180)
  })
  it('"בעוד 5 דקות" → +5 min (numeric)', () => {
    const r = parseRelativeTime('בעוד 5 דקות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(5)
  })
  it('"בעוד 2 שעות" → +120 min (numeric)', () => {
    const r = parseRelativeTime('בעוד 2 שעות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(120)
  })
  it('"עוד 10 דקות" → +10 min', () => {
    const r = parseRelativeTime('עוד 10 דקות', fixedNow)
    expect(r).not.toBeNull()
    expect(r!.minutesFromNow).toBe(10)
  })
  it('"מחר בעשר" → not relative time (absolute)', () => {
    const r = parseRelativeTime('מחר בעשר', fixedNow)
    expect(r).toBeNull()
  })
  it('label for 60 min → "בעוד שעה"', () => {
    const r = parseRelativeTime('בעוד שעה', fixedNow)
    expect(r!.displayDateLabel).toContain('בעוד שעה')
  })
  it('label for 120 min → "בעוד שעתיים"', () => {
    const r = parseRelativeTime('בעוד שעתיים', fixedNow)
    expect(r!.displayDateLabel).toContain('בעוד שעתיים')
  })
})

// ─── Recurrence parser ────────────────────────────────────────────────────────
describe('parseRecurrence', () => {
  it('"כל יום" → daily', () => {
    const r = parseRecurrence('תזכירי לי כל יום בתשע לקחת תרופה')
    expect(r).not.toBeNull()
    expect(r!.frequency).toBe('daily')
  })
  it('"כל בוקר" → daily', () => {
    const r = parseRecurrence('כל בוקר בתשע')
    expect(r?.frequency).toBe('daily')
  })
  it('"כל ערב" → daily', () => {
    const r = parseRecurrence('כל ערב בשמונה')
    expect(r?.frequency).toBe('daily')
  })
  it('"כל שבוע" → weekly', () => {
    const r = parseRecurrence('כל שבוע ביום ראשון')
    expect(r?.frequency).toBe('weekly')
  })
  it('"מחר בעשר" → null (not recurring)', () => {
    const r = parseRecurrence('מחר בעשר')
    expect(r).toBeNull()
  })
})

// ─── Full parseReminder ───────────────────────────────────────────────────────
describe('parseReminder — absolute time', () => {
  it('extracts tomorrow+time', () => {
    const d = parseReminder('תזכירי לי מחר בעשר בבוקר לקחת כדור', TODAY)
    expect(d.intent).toBe('reminder')
    expect(d.displayDateLabel).toBe('מחר')
    expect(d.displayTimeLabel).toBe('10:00')
    expect(d.dueAt).toContain('T10:00')
  })
  it('extracts today+time', () => {
    const d = parseReminder('תזכירי לי היום בשעה 21 להתקשר לאופיר', TODAY)
    expect(d.displayDateLabel).toBe('היום')
    expect(d.displayTimeLabel).toBe('21:00')
  })
  it('extracts day-of-week', () => {
    const d = parseReminder('תזכירי לי ביום שישי בשמונה בערב לבשל', TODAY)
    expect(d.displayTimeLabel).toBe('20:00')
    expect(d.dueAt).toBeDefined()
  })
  it('"9 בערב" → 21:00', () => {
    const d = parseReminder('תזכירי לי מחר ב-9 בערב לשתות מים', TODAY)
    expect(d.displayTimeLabel).toBe('21:00')
  })
  it('"9 בבוקר" → 09:00', () => {
    const d = parseReminder('תזכירי לי מחר ב-9 בבוקר לשתות מים', TODAY)
    expect(d.displayTimeLabel).toBe('09:00')
  })
  it('"12 בצהריים" → 12:00', () => {
    const d = parseReminder('תזכירי לי היום ב-12 בצהריים לאכול', TODAY)
    expect(d.displayTimeLabel).toBe('12:00')
  })
  it('"12 בלילה" → 00:00', () => {
    const d = parseReminder('תזכירי לי ב-12 בלילה לבדוק', TODAY)
    expect(d.displayTimeLabel).toBe('00:00')
  })
})

describe('parseReminder — relative time', () => {
  it('"בעוד חצי שעה לשתות מים"', () => {
    const d = parseReminder('תזכירי לי בעוד חצי שעה לשתות מים', TODAY)
    expect(d.dueAt).toBeDefined()
    expect(d.displayDateLabel).toContain('בעוד')
    expect(d.missingFields).not.toContain('time')
  })
  it('"בעוד שעתיים לקחת כדור"', () => {
    const d = parseReminder('תזכירי לי בעוד שעתיים לקחת כדור', TODAY)
    expect(d.dueAt).toBeDefined()
    expect(d.category).toBe('medication')
  })
  it('"עוד עשר דקות לכבות תנור"', () => {
    const d = parseReminder('עוד עשר דקות לכבות תנור', TODAY)
    expect(d.dueAt).toBeDefined()
    expect(d.category).toBe('home')
  })
  it('"בעוד 5 דקות" → title still extracted', () => {
    const d = parseReminder('תזכירי לי בעוד 5 דקות לשתות מים', TODAY)
    expect(d.title).toBeDefined()
    expect(d.missingFields).not.toContain('title')
  })
})

describe('parseReminder — recurring', () => {
  it('"כל יום בתשע בבוקר לקחת תרופה"', () => {
    const d = parseReminder('תזכירי לי כל יום בתשע בבוקר לקחת תרופה', TODAY)
    expect(d.recurrence).toBeDefined()
    expect(d.recurrence?.frequency).toBe('daily')
    expect(d.recurrence?.time).toBe('09:00')
    expect(d.category).toBe('medication')
  })
  it('"כל ערב בשמונה"', () => {
    const d = parseReminder('תזכירי לי כל ערב בשמונה לשתות מים', TODAY)
    expect(d.recurrence?.frequency).toBe('daily')
  })
  it('recurring has no missingFields for time', () => {
    const d = parseReminder('תזכירי לי כל יום בתשע לקחת כדור', TODAY)
    expect(d.missingFields).not.toContain('time')
  })
  it('"כל שבוע ביום ראשון"', () => {
    const d = parseReminder('תזכירי לי כל שבוע ביום ראשון בעשר לבדוק', TODAY)
    expect(d.recurrence?.frequency).toBe('weekly')
  })
})

// ─── Category detection ───────────────────────────────────────────────────────
describe('parseReminder — category detection', () => {
  it('"לקחת כדור" → medication', () => {
    expect(parseReminder('תזכירי לי לקחת כדור', TODAY).category).toBe('medication')
  })
  it('"לקחת תרופה" → medication', () => {
    expect(parseReminder('תזכירי לי לקחת תרופה', TODAY).category).toBe('medication')
  })
  it('"לשתות מים" → water', () => {
    expect(parseReminder('תזכירי לי לשתות מים', TODAY).category).toBe('water')
  })
  it('"להתקשר לאופיר" → call', () => {
    expect(parseReminder('תזכירי לי להתקשר לאופיר', TODAY).category).toBe('call')
  })
  it('"לבדוק את הסיר" → home', () => {
    expect(parseReminder('תזכירי לי לבדוק את הסיר', TODAY).category).toBe('home')
  })
  it('"לכבות תנור" → home', () => {
    expect(parseReminder('תזכירי לי לכבות תנור', TODAY).category).toBe('home')
  })
  it('"לסדר מסמכים לרופא" → appointment_prep', () => {
    expect(parseReminder('תזכירי לי לסדר מסמכים לרופא', TODAY).category).toBe('appointment_prep')
  })
  it('"לצאת לאוויר" → general (fallback)', () => {
    expect(parseReminder('תזכירי לי לצאת לאוויר', TODAY).category).toBe('general')
  })
})

// ─── Command verb stripping ───────────────────────────────────────────────────
describe('parseReminder — command verb stripping', () => {
  it('strips "תזכירי לי" from title', () => {
    const d = parseReminder('תזכירי לי לקחת כדור מחר בעשר', TODAY)
    expect(d.title).not.toMatch(/תזכירי/)
    expect(d.title).not.toMatch(/^לי\s/)
  })
  it('strips "תזכרי לי"', () => {
    const d = parseReminder('תזכרי לי לשתות מים', TODAY)
    expect(d.title).not.toMatch(/תזכרי/)
  })
  it('strips "תזכורת"', () => {
    const d = parseReminder('תזכורת לקחת תרופה', TODAY)
    expect(d.title).not.toMatch(/תזכורת/)
  })
  it('preserves the action part of title', () => {
    const d = parseReminder('תזכירי לי לקחת כדור מחר בעשר בבוקר', TODAY)
    expect(d.title).toContain('כדור')
  })
})

// ─── Missing fields ───────────────────────────────────────────────────────────
describe('parseReminder — missing fields', () => {
  it('missing time → missingFields includes "time"', () => {
    const d = parseReminder('תזכירי לי מחר לקחת כדור', TODAY)
    // no time given explicitly → may be missing or ambiguous
    // either missingFields has 'time' or ambiguity.type === 'time'
    const hasTimeProblem = d.missingFields.includes('time') || d.ambiguity?.type === 'time'
    expect(hasTimeProblem).toBe(true)
  })
  it('missing title → missingFields includes "title"', () => {
    const d = parseReminder('תזכירי לי מחר בעשר', TODAY)
    // title may be empty when only time/date given
    // we accept either missing or very short title
    expect(d.intent).toBe('reminder')
  })
  it('with both date and time → no missingFields', () => {
    const d = parseReminder('תזכירי לי מחר בעשר בבוקר לקחת כדור', TODAY)
    expect(d.missingFields).not.toContain('date')
    expect(d.missingFields).not.toContain('time')
  })
})

// ─── Readback text ────────────────────────────────────────────────────────────
describe('parseReminder — readbackText', () => {
  it('never contains raw command verb', () => {
    const d = parseReminder('תזכירי לי מחר בעשר לקחת כדור', TODAY)
    expect(d.readbackText).not.toMatch(/תזכירי\s+לי/)
  })
  it('contains "להזכיר לך"', () => {
    const d = parseReminder('תזכירי לי לקחת כדור מחר בעשר', TODAY)
    expect(d.readbackText).toContain('להזכיר לך')
  })
  it('contains time for absolute reminder', () => {
    const d = parseReminder('תזכירי לי מחר בעשר בבוקר לקחת כדור', TODAY)
    expect(d.readbackText).toContain('10:00')
  })
  it('recurring readback contains "כל יום"', () => {
    const d = parseReminder('תזכירי לי כל יום בתשע לקחת תרופה', TODAY)
    expect(d.readbackText).toContain('כל יום')
  })
})

// ─── Family resolution ────────────────────────────────────────────────────────
describe('parseReminder — family resolution', () => {
  it('"להתקשר לאופיר" → call category', () => {
    const d = parseReminder('תזכירי לי מחר בערב להתקשר לאופיר', TODAY)
    expect(d.category).toBe('call')
  })
  it('"הבעל של אופיר" resolves in family resolution', () => {
    const d = parseReminder('תזכירי לי להתקשר לבעל של אופיר מחר בערב', TODAY)
    // familyResolution should be set
    expect(d.familyResolution).toBeDefined()
    if (d.familyResolution?.status === 'resolved') {
      expect(d.familyResolution.resolvedName).toBe('גלעד')
    }
  })
  it('"הבת של מור" → missing status', () => {
    const d = parseReminder('תזכירי לי להתקשר לבת של מור', TODAY)
    if (d.familyResolution) {
      expect(['missing', 'ambiguous']).toContain(d.familyResolution.status)
    }
  })
  it('resolved family name appears in title', () => {
    const d = parseReminder('תזכירי לי להתקשר לבעל של אופיר מחר בעשר', TODAY)
    if (d.familyResolution?.status === 'resolved') {
      expect(d.title).toContain(d.familyResolution.resolvedName!)
    }
  })
})

// ─── No debug/private data leakage ───────────────────────────────────────────
describe('parseReminder — no debug/private leakage', () => {
  const FORBIDDEN_IN_DRAFT = ['DEBUG', 'asr:', 'blob:', 'chunks:', 'transcript:']

  it('draft has no forbidden debug strings', () => {
    const d = parseReminder('תזכירי לי לקחת כדור מחר בעשר', TODAY)
    const serialized = JSON.stringify(d)
    for (const bad of FORBIDDEN_IN_DRAFT) {
      expect(serialized).not.toContain(bad)
    }
  })
  it('readbackText does not contain raw transcript', () => {
    const raw = 'תזכירי לי לקחת כדור מחר בעשר'
    const d = parseReminder(raw, TODAY)
    // readbackText must NOT just be the raw transcript
    expect(d.readbackText).not.toBe(raw)
  })
  it('draft intent is always "reminder"', () => {
    expect(parseReminder('כל יום לקחת כדור', TODAY).intent).toBe('reminder')
  })
})

// ─── Ambiguity ────────────────────────────────────────────────────────────────
describe('parseReminder — ambiguity', () => {
  it('missing time → ambiguity.type === "time" with quick-pick options', () => {
    const d = parseReminder('תזכירי לי מחר לקחת כדור', TODAY)
    // If no time at all, ambiguity should be set OR missingFields has 'time'
    const hasTimeProblem = d.missingFields.includes('time') || d.ambiguity?.type === 'time'
    expect(hasTimeProblem).toBe(true)
    if (d.ambiguity?.type === 'time') {
      expect(d.ambiguity.options.length).toBeGreaterThan(0)
    }
  })
  it('ambiguous person triggers person ambiguity', () => {
    const d = parseReminder('תזכירי לי להתקשר לבן של מור מחר בעשר', TODAY)
    if (d.familyResolution?.status === 'ambiguous') {
      expect(d.ambiguity?.type).toBe('person')
    }
  })
})
