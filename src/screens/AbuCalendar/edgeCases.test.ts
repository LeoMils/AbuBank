import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addAppointment, deleteAppointment, loadAppointments } from './service'
import { getTimeState } from './constants'

describe('Edge cases', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  describe('missing time', () => {
    it('getTimeState handles empty time string gracefully', () => {
      const result = getTimeState('2026-04-20', '', '2026-04-20', Date.now())
      expect(result).toBe('upcoming')
    })

    it('getTimeState handles undefined-like time gracefully', () => {
      const result = getTimeState('2026-04-20', 'undefined', '2026-04-20', Date.now())
      expect(result).toBe('upcoming')
    })
  })

  describe('past dates', () => {
    it('events far in the past are correctly identified', () => {
      const now = new Date('2026-04-20T14:00:00').getTime()
      expect(getTimeState('2020-01-01', '09:00', '2026-04-20', now)).toBe('past')
    })
  })

  describe('rapid actions', () => {
    it('rapid add then delete leaves no appointment', () => {
      const appt = addAppointment({ title: 'Fast', date: '2026-04-20', time: '10:00', emoji: '📅' })
      deleteAppointment(appt.id)
      expect(loadAppointments()).toHaveLength(0)
    })

    it('rapid multiple additions create distinct appointments', () => {
      const a1 = addAppointment({ title: 'A', date: '2026-04-20', time: '10:00', emoji: '📅' })
      const a2 = addAppointment({ title: 'B', date: '2026-04-20', time: '10:00', emoji: '📅' })
      expect(a1.id).not.toBe(a2.id)
      expect(loadAppointments()).toHaveLength(2)
    })

    it('delete then delete same id is safe (no throw)', () => {
      const appt = addAppointment({ title: 'Test', date: '2026-04-20', time: '10:00', emoji: '📅' })
      deleteAppointment(appt.id)
      deleteAppointment(appt.id)
      expect(loadAppointments()).toHaveLength(0)
    })
  })

  describe('boundary dates', () => {
    it('midnight boundary: 23:59 today vs 00:00 tomorrow', () => {
      const now = new Date('2026-04-20T23:50:00').getTime()
      expect(getTimeState('2026-04-20', '23:55', '2026-04-20', now)).toBe('now')
      expect(getTimeState('2026-04-21', '00:05', '2026-04-20', now)).toBe('upcoming')
    })
  })
})
