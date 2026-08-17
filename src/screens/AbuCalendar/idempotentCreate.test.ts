/*
 * idempotentCreate.test.ts — A8: a duplicated/retried tool-result must not create a second event.
 * createAppointmentSafe is idempotent for an exact (title+date+time) duplicate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAppointmentSafe, loadAppointments } from './service'

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { storage = {} },
  })
})

describe('createAppointmentSafe — idempotent create (A8)', () => {
  const input = { title: 'רופא שיניים', date: '2026-09-01', time: '10:00', emoji: '🦷', notes: '' }

  it('a duplicated/retried create with identical title+date+time yields ONE event', () => {
    const a = createAppointmentSafe(input)
    const b = createAppointmentSafe({ ...input })      // duplicate tool-result / retry
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(b.appointment.id).toBe(a.appointment.id) // same event, not a new one
    expect(loadAppointments().filter((x) => x.title === input.title).length).toBe(1)
  })

  it('trims whitespace when matching (a resumed turn with padded title is still the same event)', () => {
    createAppointmentSafe(input)
    const b = createAppointmentSafe({ ...input, title: '  רופא שיניים  ' })
    expect(b.ok).toBe(true)
    expect(loadAppointments().filter((x) => x.title.trim() === 'רופא שיניים').length).toBe(1)
  })

  it('a genuinely different time is NOT deduped (two real events)', () => {
    createAppointmentSafe(input)
    createAppointmentSafe({ ...input, time: '16:00' })
    expect(loadAppointments().filter((x) => x.title === input.title).length).toBe(2)
  })
})
