/*
 * Scenario #1 E2E: "מחר בחצות פגישה עם אופיר"
 * Proves complete pipeline from transcript to saveable appointment.
 */

import { describe, it, expect } from 'vitest'
import { parseLocally } from './localParser'
import { isScheduleQuery } from './intentParser'
import { resolvePersonPhrase, extractPersonPhrase } from './familyResolve'
import { detectReminderIntent } from './reminders/reminderParser'

const PHRASE = 'מחר בחצות פגישה עם אופיר'
const TODAY = new Date()
const TODAY_ISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`

describe('Scenario #1 E2E: "מחר בחצות פגישה עם אופיר"', () => {
  const draft = parseLocally(PHRASE, TODAY_ISO)

  it('1. not a schedule query (it is a create)', () => {
    expect(isScheduleQuery(PHRASE)).toBe(false)
  })

  it('2. not a reminder', () => {
    expect(detectReminderIntent(PHRASE)).not.toBe('reminder')
  })

  it('3. date = tomorrow', () => {
    const tomorrow = new Date(TODAY)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    expect(draft.date).toBe(tomorrowStr)
  })

  it('4. time = 00:00 (midnight)', () => {
    expect(draft.time).toBe('00:00')
  })

  it('5. title contains "פגישה" and "אופיר"', () => {
    expect(draft.title).toContain('פגישה')
    expect(draft.title).toContain('אופיר')
  })

  it('6. time is NOT ambiguous', () => {
    expect(draft.ambiguousTime).toBe(false)
  })

  it('7. confidence ≥ 0.8', () => {
    expect(draft.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('8. person "אופיר" extracted from title', () => {
    const phrase = extractPersonPhrase(draft.title ?? '')
    expect(phrase).toBe('אופיר')
  })

  it('9. person "אופיר" resolves in family graph', () => {
    const result = resolvePersonPhrase('אופיר')
    expect(result.status).toBe('resolved')
  })

  it('10. all save-required fields present', () => {
    expect(draft.title).toBeTruthy()
    expect(draft.date).toBeTruthy()
    expect(draft.time).toBeTruthy()
    expect(draft.ambiguousTime).toBe(false)
  })
})

describe('Regression guards — save safety', () => {
  it('schedule query is read-only', () => {
    expect(isScheduleQuery('מה יש לי מחר?')).toBe(true)
  })

  it('"חצות" = 00:00', () => {
    expect(parseLocally('חצות פגישה', TODAY_ISO).time).toBe('00:00')
  })

  it('"בחצות" = 00:00', () => {
    expect(parseLocally('בחצות פגישה', TODAY_ISO).time).toBe('00:00')
  })

  it('"חצות וחצי" = 00:30', () => {
    expect(parseLocally('חצות וחצי פגישה', TODAY_ISO).time).toBe('00:30')
  })

  it('reminder detected for "תזכירי לי"', () => {
    expect(detectReminderIntent('תזכירי לי לקחת כדור')).toBe('reminder')
  })

  it('appointment NOT a reminder for "תקבעי לי רופא"', () => {
    expect(detectReminderIntent('תקבעי לי רופא מחר')).not.toBe('reminder')
  })

  it('unknown person does not crash', () => {
    const result = resolvePersonPhrase('דניאל')
    expect(result.status).toBe('missing')
  })
})
