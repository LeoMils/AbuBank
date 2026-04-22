import { describe, it, expect } from 'vitest'
import { classifyPriority, sortByPriority, narrateDay, narrateRange } from './narration'
import { type Appointment } from './service'

const makeAppt = (title: string, date: string, time: string): Appointment => ({
  id: 'test', title, date, time, emoji: '📅', color: '#C9A84C',
})

describe('classifyPriority', () => {
  it('medical is critical', () => {
    expect(classifyPriority(makeAppt('רופא שיניים', '2026-04-22', '10:00'))).toBe('critical')
    expect(classifyPriority(makeAppt('בדיקת דם', '2026-04-22', '08:00'))).toBe('critical')
  })

  it('meetings are high', () => {
    expect(classifyPriority(makeAppt('פגישה עם עורך דין', '2026-04-22', '14:00'))).toBe('high')
  })

  it('birthdays are high', () => {
    expect(classifyPriority(makeAppt('יום הולדת של מור', '2026-04-22', '18:00'))).toBe('high')
  })

  it('shopping is normal', () => {
    expect(classifyPriority(makeAppt('קניות בסופר', '2026-04-22', '11:00'))).toBe('normal')
  })

  it('generic is normal', () => {
    expect(classifyPriority(makeAppt('משהו', '2026-04-22', '12:00'))).toBe('normal')
  })
})

describe('sortByPriority', () => {
  it('critical before high before normal', () => {
    const appts = [
      makeAppt('קניות', '2026-04-22', '09:00'),
      makeAppt('רופא', '2026-04-22', '14:00'),
      makeAppt('פגישה', '2026-04-22', '11:00'),
    ]
    const sorted = sortByPriority(appts)
    expect(sorted[0]!.title).toBe('רופא')
    expect(sorted[1]!.title).toBe('פגישה')
    expect(sorted[2]!.title).toBe('קניות')
  })

  it('same priority sorted by time', () => {
    const appts = [
      makeAppt('קניות ב', '2026-04-22', '14:00'),
      makeAppt('קניות א', '2026-04-22', '09:00'),
    ]
    const sorted = sortByPriority(appts)
    expect(sorted[0]!.title).toBe('קניות א')
  })
})

describe('narrateDay', () => {
  const today = '2026-04-22'

  it('empty day', () => {
    const result = narrateDay([], today, today)
    expect(result).toContain('חופשי')
  })

  it('single event narrated', () => {
    const appts = [makeAppt('רופא שיניים', today, '10:00')]
    const result = narrateDay(appts, today, today)
    expect(result).toContain('רופא שיניים')
    expect(result).toContain('חשוב')
  })

  it('multiple events — most important first', () => {
    const appts = [
      makeAppt('קניות', today, '09:00'),
      makeAppt('בדיקת דם', today, '14:00'),
    ]
    const result = narrateDay(appts, today, today)
    expect(result).toContain('בדיקת דם')
    expect(result.indexOf('בדיקת דם')).toBeLessThan(result.indexOf('קניות'))
  })

  it('tomorrow uses relative day', () => {
    const tomorrow = '2026-04-23'
    const appts = [makeAppt('תספורת', tomorrow, '11:00')]
    const result = narrateDay(appts, tomorrow, today)
    expect(result).toContain('מחר')
  })

  it('caps at 3 narrated items + remainder count', () => {
    const appts = [
      makeAppt('א', today, '09:00'),
      makeAppt('ב', today, '10:00'),
      makeAppt('ג', today, '11:00'),
      makeAppt('ד', today, '12:00'),
    ]
    const result = narrateDay(appts, today, today)
    expect(result).toContain('ועוד 1')
  })
})

describe('narrateRange', () => {
  const today = '2026-04-22'

  it('empty range', () => {
    const result = narrateRange([], today, 7)
    expect(result).toContain('אין לך כלום')
  })

  it('includes events across multiple days', () => {
    const appts = [
      makeAppt('רופא', '2026-04-22', '10:00'),
      makeAppt('תספורת', '2026-04-24', '14:00'),
    ]
    const result = narrateRange(appts, today, 7)
    expect(result).toContain('רופא')
    expect(result).toContain('תספורת')
  })
})
