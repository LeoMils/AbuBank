import { describe, it, expect } from 'vitest'
import {
  isScheduleQuery,
  extractQueryTimeframe,
  validateParsedIntent,
  buildClarificationQuestion,
  buildConfirmationText,
  type ParsedIntent,
} from './intentParser'

describe('isScheduleQuery', () => {
  it('detects "מה קורה לי"', () => {
    expect(isScheduleQuery('מה קורה לי היום')).toBe(true)
    expect(isScheduleQuery('מה יש לי מחר')).toBe(true)
    expect(isScheduleQuery('מה ביומן')).toBe(true)
  })

  it('rejects event creation phrases', () => {
    expect(isScheduleQuery('אני צריכה ללכת לרופא')).toBe(false)
    expect(isScheduleQuery('תקבעי פגישה')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isScheduleQuery('')).toBe(false)
  })
})

describe('extractQueryTimeframe', () => {
  it('detects tomorrow', () => {
    expect(extractQueryTimeframe('מה יש לי מחר')).toEqual({ scope: 'tomorrow' })
  })

  it('detects week', () => {
    expect(extractQueryTimeframe('מה קורה השבוע')).toEqual({ scope: 'week' })
  })

  it('defaults to today', () => {
    expect(extractQueryTimeframe('מה קורה לי')).toEqual({ scope: 'today' })
  })
})

describe('validateParsedIntent', () => {
  const base: ParsedIntent = {
    intent: 'create_event', title: 'רופא', date: '2026-04-22',
    time: '10:00', emoji: '🏥', personName: null, confidence: 0.9,
  }

  it('valid when all fields present and confidence >= 0.7', () => {
    expect(validateParsedIntent(base)).toEqual({ valid: true, missing: [] })
  })

  it('invalid when missing date', () => {
    const result = validateParsedIntent({ ...base, date: null })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('date')
  })

  it('invalid when missing time', () => {
    const result = validateParsedIntent({ ...base, time: null })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain('time')
  })

  it('invalid when confidence too low', () => {
    const result = validateParsedIntent({ ...base, confidence: 0.5 })
    expect(result.valid).toBe(false)
  })
})

describe('buildClarificationQuestion', () => {
  it('asks for date+time when both missing', () => {
    const q = buildClarificationQuestion(['date', 'time'])
    expect(q).toContain('תאריך')
    expect(q).toContain('שעה')
  })

  it('asks for date only', () => {
    const q = buildClarificationQuestion(['date'])
    expect(q).toContain('תאריך')
  })

  it('asks for time only', () => {
    const q = buildClarificationQuestion(['time'])
    expect(q).toContain('שעה')
  })

  it('returns null when nothing missing', () => {
    expect(buildClarificationQuestion([])).toBeNull()
  })
})

describe('buildConfirmationText', () => {
  it('builds Hebrew confirmation', () => {
    const result = buildConfirmationText({
      intent: 'create_event', title: 'רופא שיניים',
      date: '2026-04-23', time: '10:00', emoji: '🏥',
      personName: null, confidence: 0.9,
    })
    expect(result).toContain('לקבוע')
    expect(result).toContain('רופא שיניים')
    expect(result).toContain('10:00')
  })

  it('handles missing time', () => {
    const result = buildConfirmationText({
      intent: 'create_event', title: 'פגישה',
      date: '2026-04-22', time: null, emoji: '📅',
      personName: null, confidence: 0.7,
    })
    expect(result).toContain('לקבוע')
    expect(result).toContain('פגישה')
    expect(result).not.toContain('null')
  })
})
