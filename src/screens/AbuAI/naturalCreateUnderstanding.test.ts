/**
 * Natural Hebrew calendar-create understanding (#fix natural create).
 *
 * Proves the local-first (no server/LLM) create layer handles elderly-user
 * phrasing: noisy/typo verbs, weekday + הקרוב/הבא expressions, ambiguous
 * times, and clean title extraction. System time is pinned so weekday math
 * is deterministic — 2026-05-23 is a Saturday.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  isCreateIntent,
  parseCreateIntent,
  parseCreateDate,
  parseHebrewTimeDetailed,
  extractTitle,
  startCreate,
  updateCreate,
  normalizeCreateText,
} from './calendarCreate'
import { routePersonalQuery } from './router'
import { shapeCreateClarify } from './responseShaper'

const FIXED_TODAY = new Date('2026-05-23T09:00:00') // Saturday

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})
afterAll(() => {
  vi.useRealTimers()
})

// ─── A. Verb normalization / intent ──────────────────────────────────────────

describe('A. noisy create verbs are understood', () => {
  it('normalizes the typo "תקווה לי" → "תקבעי לי"', () => {
    expect(normalizeCreateText('תקווה לי פגישה')).toBe('תקבעי לי פגישה')
  })

  it.each([
    'תקבעי לי פגישה עם אופיר בחמישי הקרוב בשבע בערב',
    'תקווה לי פגישה עם אופיר בחמישי הקרוב בשבע בערב',
    'שימי לי פגישה עם רוני בחמישי הבא בארבע',
    'תעשי לי פגישה עם ירדן ביום ראשון הקרוב',
    'תרשמי לי תור לרופא בשבוע הבא ביום שלישי בשתיים בצהריים',
  ])('detects create intent: %s', (text) => {
    expect(isCreateIntent(text)).toBe(true)
  })
})

// ─── B. Weekday resolver ──────────────────────────────────────────────────────

describe('B. weekday + הקרוב/הבא resolver', () => {
  it('"בחמישי הקרוב" → next Thursday 2026-05-28', () => {
    expect(parseCreateDate('פגישה בחמישי הקרוב')).toBe('2026-05-28')
  })
  it('"ביום חמישי הקרוב" → 2026-05-28', () => {
    expect(parseCreateDate('ביום חמישי הקרוב')).toBe('2026-05-28')
  })
  it('"חמישי הבא" → next Thursday 2026-05-28', () => {
    expect(parseCreateDate('חמישי הבא')).toBe('2026-05-28')
  })
  it('"ביום ראשון הקרוב" → tomorrow Sunday 2026-05-24', () => {
    expect(parseCreateDate('ביום ראשון הקרוב')).toBe('2026-05-24')
  })
  it('"בשבוע הבא ביום שלישי" → Tuesday of next week 2026-05-26', () => {
    expect(parseCreateDate('בשבוע הבא ביום שלישי')).toBe('2026-05-26')
  })
})

// ─── C. Time resolver ─────────────────────────────────────────────────────────

describe('C. time resolver', () => {
  it('"בשבע בערב" → 19:00 (not ambiguous)', () => {
    const r = parseHebrewTimeDetailed('בשבע בערב')
    expect(r.time).toBe('19:00')
    expect(r.ambiguous).toBe(false)
  })
  it('"בעשר בבוקר" → 10:00', () => {
    expect(parseHebrewTimeDetailed('בעשר בבוקר').time).toBe('10:00')
  })
  it('"בארבע אחר הצהריים" → 16:00', () => {
    expect(parseHebrewTimeDetailed('בארבע אחר הצהריים').time).toBe('16:00')
  })
  it('"בשתיים בצהריים" → 14:00 (noon hint applies to the hour)', () => {
    expect(parseHebrewTimeDetailed('בשתיים בצהריים').time).toBe('14:00')
  })
  it('bare "בשבע" with no period → tentative 07:00 but ambiguous', () => {
    const r = parseHebrewTimeDetailed('בשבע')
    expect(r.time).toBe('07:00')
    expect(r.ambiguous).toBe(true)
  })
  it('standalone "בצהריים" → 12:00', () => {
    expect(parseHebrewTimeDetailed('בצהריים').time).toBe('12:00')
  })
})

// ─── D. Title cleanup ─────────────────────────────────────────────────────────

describe('D. clean title extraction strips command + date + time', () => {
  it.each([
    ['תקבעי לי פגישה עם אופיר בחמישי הקרוב בשבע בערב', 'פגישה עם אופיר'],
    ['תקווה לי פגישה עם אופיר בחמישי הקרוב בשבע בערב', 'פגישה עם אופיר'],
    ['קבעי לי תור לרופא ביום חמישי הקרוב בעשר בבוקר', 'תור לרופא'],
    ['תרשמי לי תור לרופא בשבוע הבא ביום שלישי בשתיים בצהריים', 'תור לרופא'],
    // bare "עם <person>" is promoted to a meeting, never command words
    ['תקבעי לי עם אופיר מחר בשבע', 'פגישה עם אופיר'],
  ])('%s → %s', (input, expected) => {
    expect(extractTitle(input)).toBe(expected)
  })
})

// ─── E. End-to-end contract examples ──────────────────────────────────────────

describe('E. full parse of contract examples', () => {
  it('"תקווה לי פגישה עם אופיר בחמישי הקרוב בשבע בערב"', () => {
    const r = parseCreateIntent('תקווה לי פגישה עם אופיר בחמישי הקרוב בשבע בערב')
    expect(r).not.toBeNull()
    expect(r!.draft.title).toBe('פגישה עם אופיר')
    expect(r!.draft.date).toBe('2026-05-28')
    expect(new Date(r!.draft.date!).getDay()).toBe(4) // Thursday
    expect(r!.draft.time).toBe('19:00')
    expect(r!.missing).toEqual([])
  })

  it('"קבעי לי תור לרופא ביום חמישי הקרוב בעשר בבוקר"', () => {
    const r = parseCreateIntent('קבעי לי תור לרופא ביום חמישי הקרוב בעשר בבוקר')
    expect(r!.draft.title).toBe('תור לרופא')
    expect(new Date(r!.draft.date!).getDay()).toBe(4)
    expect(r!.draft.time).toBe('10:00')
    expect(r!.missing).toEqual([])
  })
})

// ─── F. Ambiguous time clarification (does NOT silently store) ─────────────────

describe('F. ambiguous time asks instead of guessing', () => {
  it('"תקבעי לי עם אופיר מחר בשבע" stays in creating with an ambiguous time', () => {
    const s = startCreate('תקבעי לי עם אופיר מחר בשבע')
    expect(s.phase).toBe('creating')
    expect(s.missing).toContain('time')
    expect(s.draft.ambiguousTime).toBe(true)
    expect(s.draft.title).toBe('פגישה עם אופיר')
  })

  it('clarify message asks "בבוקר או בערב"', () => {
    const s = startCreate('תקבעי לי עם אופיר מחר בשבע')
    const msg = shapeCreateClarify(s.missing, s.draft)
    expect(msg).toContain('שבע בבוקר')
    expect(msg).toContain('שבע בערב')
  })

  it('follow-up "בערב" resolves to 19:00 and reaches confirming', () => {
    const s = startCreate('תקבעי לי עם אופיר מחר בשבע')
    const s2 = updateCreate(s, 'בערב')
    expect(s2.phase).toBe('confirming')
    expect(s2.draft.time).toBe('19:00')
    expect(s2.draft.ambiguousTime).toBe(false)
    expect(s2.missing).toEqual([])
  })

  it('follow-up "בבוקר" resolves to 07:00', () => {
    const s = startCreate('תקבעי לי עם אופיר מחר בשבע')
    const s2 = updateCreate(s, 'בבוקר')
    expect(s2.draft.time).toBe('07:00')
    expect(s2.draft.ambiguousTime).toBe(false)
  })
})

// ─── G. Read queries still route to read, not create ──────────────────────────

describe('G. read queries are not hijacked by create', () => {
  it('"איזה פגישות יש לי שבוע הקרוב" → calendar_upcoming (read)', () => {
    expect(routePersonalQuery('איזה פגישות יש לי שבוע הקרוב').type).toBe('calendar_upcoming')
  })
  it('"איזה פגישות יש לי שבוע הקרוב" is NOT a create intent', () => {
    expect(isCreateIntent('איזה פגישות יש לי שבוע הקרוב')).toBe(false)
  })
})
