import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  detectEmoji,
  formatHebrewDate,
  formatShortHebrewDate,
  addAppointment,
  loadAppointments,
  deleteAppointment,
  updateAppointment,
  FAMILY_BIRTHDAYS,
  FAMILY_MEMORIALS,
} from './service'

describe('detectEmoji', () => {
  it('returns hospital emoji for doctor-related text', () => {
    expect(detectEmoji('פגישה עם הרופא')).toBe('🏥')
    expect(detectEmoji('doctor appointment')).toBe('🏥')
  })

  it('returns scissors emoji for haircut text', () => {
    expect(detectEmoji('תספורת')).toBe('✂️')
  })

  it('returns birthday emoji for birthday text', () => {
    expect(detectEmoji('יום הולדת של מור')).toBe('🎂')
  })

  it('returns calendar emoji for generic text', () => {
    expect(detectEmoji('פגישה בשלוש')).toBe('📅')
  })
})

describe('formatHebrewDate', () => {
  it('formats a valid date in Hebrew', () => {
    const result = formatHebrewDate('2026-04-11')
    expect(result).toContain('11')
    expect(result).toContain('אפריל')
    expect(result).toContain('2026')
  })

  it('returns raw string for invalid date', () => {
    expect(formatHebrewDate('bad')).toBe('bad')
  })
})

describe('formatShortHebrewDate', () => {
  it('formats date with day name and month', () => {
    const result = formatShortHebrewDate('2026-04-11')
    expect(result).toContain('11')
    expect(result).toContain('אפריל')
    expect(result).toContain('שבת')
  })

  it('returns raw string for invalid date', () => {
    expect(formatShortHebrewDate('xyz')).toBe('xyz')
  })
})

describe('FAMILY_BIRTHDAYS', () => {
  it('has at least 10 family members', () => {
    expect(FAMILY_BIRTHDAYS.length).toBeGreaterThanOrEqual(10)
  })

  it('every birthday has personName', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      expect(bday.personName).toBeTruthy()
    }
  })

  it('no birthday title duplicates "יום הולדת" in personName', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      // personName should be just the name, not "יום הולדת X"
      expect(bday.personName).not.toContain('יום הולדת')
    }
  })

  it('all dates are valid MM-DD format', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      const mmdd = bday.date.slice(5) // "MM-DD"
      expect(mmdd).toMatch(/^\d{2}-\d{2}$/)
    }
  })
})

describe('FAMILY_MEMORIALS', () => {
  it('has at least one memorial', () => {
    expect(FAMILY_MEMORIALS.length).toBeGreaterThanOrEqual(1)
  })

  it('Pepe memorial has correct type', () => {
    const pepe = FAMILY_MEMORIALS.find(m => m.personName === 'פפי')
    expect(pepe).toBeDefined()
    expect(pepe?.type).toBe('memory')
    expect(pepe?.isRecurring).toBe(true)
  })
})

describe('Appointment CRUD', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('addAppointment creates an appointment with id and color', () => {
    const appt = addAppointment({
      title: 'רופא שיניים',
      date: '2026-04-20',
      time: '10:00',
      emoji: '🏥',
    })
    expect(appt.id).toBeTruthy()
    expect(appt.color).toBeTruthy()
    expect(appt.title).toBe('רופא שיניים')
  })

  it('loadAppointments retrieves saved appointments', () => {
    addAppointment({ title: 'A', date: '2026-04-20', time: '10:00', emoji: '📅' })
    addAppointment({ title: 'B', date: '2026-04-21', time: '11:00', emoji: '📅' })
    const all = loadAppointments()
    expect(all).toHaveLength(2)
    expect(all[0]!.title).toBe('A')
    expect(all[1]!.title).toBe('B')
  })

  it('deleteAppointment removes the appointment', () => {
    const appt = addAppointment({ title: 'Delete me', date: '2026-04-20', time: '10:00', emoji: '📅' })
    deleteAppointment(appt.id)
    expect(loadAppointments()).toHaveLength(0)
  })

  it('updateAppointment modifies fields', () => {
    const appt = addAppointment({ title: 'Original', date: '2026-04-20', time: '10:00', emoji: '📅' })
    updateAppointment(appt.id, { title: 'Updated', time: '14:00' })
    const all = loadAppointments()
    expect(all[0]!.title).toBe('Updated')
    expect(all[0]!.time).toBe('14:00')
    expect(all[0]!.date).toBe('2026-04-20')
  })

  it('loadAppointments returns empty array for corrupted storage', () => {
    storage['abubank-appointments'] = 'not json {'
    expect(loadAppointments()).toEqual([])
  })

  it('loadAppointments returns empty array for non-array JSON', () => {
    storage['abubank-appointments'] = JSON.stringify({ foo: 'bar' })
    expect(loadAppointments()).toEqual([])
  })

  it('deleteAppointment is safe when id does not exist', () => {
    addAppointment({ title: 'Keep me', date: '2026-04-20', time: '10:00', emoji: '📅' })
    deleteAppointment('nonexistent-id')
    expect(loadAppointments()).toHaveLength(1)
  })
})
