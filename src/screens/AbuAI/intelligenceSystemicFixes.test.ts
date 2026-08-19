/**
 * Regression locks for the systemic root causes the Autonomous Intelligence
 * Gauntlet surfaced (one shared class each, not per-symptom).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, resolvePendingMessage, isConfirm, isCancel, parseCreateDate, normalizeUtterance } from './calendarCreate'
import { understandMeeting } from './meetingIntelligence'
import { isContinuation } from './conversationOS'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
afterAll(() => vi.useRealTimers())
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

describe('systemic: robust confirmation (politeness/whitespace/extra words)', () => {
  it.each(['בסדר גמור  ', 'כן  ', 'מאושר בבקשה', 'כן נכון תקבעי את זה בבקשה', 'כן אני מאוד רוצה את זה', 'תעשי את זה כבר'])('"%s" confirms', (t) => {
    expect(isConfirm(t)).toBe(true)
  })
  it('a pure-filler phrase does NOT confirm', () => { expect(isConfirm('את זה')).toBe(false) })
})

describe('systemic: unrecognized confirm never falls through to a silent cancel', () => {
  it('"כן נכון תקבעי את זה בבקשה" while confirming → save (not cancel)', () => {
    const st = startCreate('תקבעי פגישה עם מור מחר בשמונה בערב')
    expect(resolvePendingMessage(st, 'כן נכון תקבעי את זה בבקשה', false).action).toBe('save')
  })
})

describe('systemic: dedupe consecutive duplicate STT words', () => {
  it('audio complaint with a duplicated word still routes to audio_help', () => {
    const st = startCreate('תקבעי פגישה עם מור מחר בשמונה בערב')
    expect(resolvePendingMessage(st, 'למה את את לא מדברת אני לא שומע אותך', false).action).toBe('audio_help')
  })
  it('normalizeUtterance collapses duplicates + trailing politeness', () => {
    expect(normalizeUtterance('כן כן בבקשה')).toBe('כן')
  })
})

describe('systemic: "בשבוע הבא" resolves to a date (draft never stuck in creating)', () => {
  it('bare next-week create reaches confirming and saves', () => {
    expect(parseCreateDate('בשבוע הבא')).toBeTruthy()
    const st = startCreate('תקבעי פגישה עם מור בשבוע הבא בשמונה בערב')
    expect(st.phase).toBe('confirming')
    expect(resolvePendingMessage(st, 'מאושר', false).action).toBe('save')
  })
})

describe('systemic: person/location priority ("עם" wins, "אצל" = location)', () => {
  it('"עם מור אצל גבי" → person=מור, location contains גבי', () => {
    const m = understandMeeting('תקבעי פגישה עם מור מחר בשמונה בערב אצל גבי')
    expect(m.who).toBe('מור')
    expect(m.location).toMatch(/גבי/)
  })
})

describe('systemic: continuation phrasings', () => {
  it.each(['מאיפה שעצרת', 'continue', 'תמשיכי', 'מאיפה שהפסקת'])('"%s" is a continuation', (t) => {
    expect(isContinuation(t)).toBe(true)
  })
})
