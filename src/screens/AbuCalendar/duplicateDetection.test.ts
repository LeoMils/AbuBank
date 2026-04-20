import { describe, it, expect } from 'vitest'
import { isDuplicate } from './constants'
import { type Appointment } from './service'

const makeAppt = (title: string, date: string, time: string): Appointment => ({
  id: 'test-1', title, date, time, emoji: '📅', color: '#C9A84C',
})

describe('isDuplicate', () => {
  const existing = [
    makeAppt('רופא שיניים', '2026-04-20', '10:00'),
    makeAppt('תספורת', '2026-04-21', '14:00'),
  ]

  it('detects exact duplicate (same title + date + time)', () => {
    expect(isDuplicate('רופא שיניים', '2026-04-20', '10:00', existing)).toBe(true)
  })

  it('does not flag different time as duplicate', () => {
    expect(isDuplicate('רופא שיניים', '2026-04-20', '11:00', existing)).toBe(false)
  })

  it('does not flag different date as duplicate', () => {
    expect(isDuplicate('רופא שיניים', '2026-04-21', '10:00', existing)).toBe(false)
  })

  it('matches case-insensitively', () => {
    expect(isDuplicate('רופא שיניים', '2026-04-20', '10:00', existing)).toBe(true)
  })

  it('trims whitespace before matching', () => {
    expect(isDuplicate('  רופא שיניים  ', '2026-04-20', '10:00', existing)).toBe(true)
  })

  it('returns false for empty existing list', () => {
    expect(isDuplicate('רופא שיניים', '2026-04-20', '10:00', [])).toBe(false)
  })
})
