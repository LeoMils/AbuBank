import { describe, it, expect } from 'vitest'
import { getTimeState } from './constants'

describe('getTimeState', () => {
  const today = '2026-04-20'

  it('returns past for events before now', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-19', '10:00', today, nowMs)).toBe('past')
    expect(getTimeState('2026-04-20', '12:00', today, nowMs)).toBe('past')
  })

  it('returns now for events within 10 minutes', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-20', '14:05', today, nowMs)).toBe('now')
    expect(getTimeState('2026-04-20', '14:10', today, nowMs)).toBe('now')
  })

  it('returns today for same-day events beyond 10 minutes', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-20', '14:11', today, nowMs)).toBe('today')
    expect(getTimeState('2026-04-20', '18:00', today, nowMs)).toBe('today')
  })

  it('returns upcoming for future events on different days', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-21', '10:00', today, nowMs)).toBe('upcoming')
    expect(getTimeState('2026-05-01', '09:00', today, nowMs)).toBe('upcoming')
  })

  it('boundary: exactly 10 minutes is now', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-20', '14:10', today, nowMs)).toBe('now')
  })

  it('boundary: 11 minutes from now on same day is today', () => {
    const nowMs = new Date('2026-04-20T14:00:00').getTime()
    expect(getTimeState('2026-04-20', '14:11', today, nowMs)).toBe('today')
  })

  it('returns upcoming for invalid dates', () => {
    const nowMs = Date.now()
    expect(getTimeState('invalid', '10:00', today, nowMs)).toBe('upcoming')
  })
})
