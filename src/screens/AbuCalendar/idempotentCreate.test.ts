/*
 * idempotentCreate.test.ts — A8 TRUE idempotency by OPERATION IDENTITY (challenge A).
 * The realtime function_call callId is the stable operation id; createAppointmentSafe uses it as the
 * PRIMARY dedup key (persisted). Proves: same op → one event; distinct ops (even identical content) →
 * two; same op with content variation → one; a re-create that adds info (new op) → not collapsed; no
 * op → each create is distinct (no content-based false collapse); reload/retry boundary holds.
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

const input = { title: 'רופא שיניים', date: '2026-09-01', time: '10:00', emoji: '🦷', notes: '' }
const count = (title: string) => loadAppointments().filter((x) => x.title.trim() === title.trim()).length

describe('createAppointmentSafe — operation-identity idempotency (A8)', () => {
  it('SAME operation repeated (retry, same callId) → exactly ONE event', () => {
    const a = createAppointmentSafe(input, { operationId: 'call_ABC' })
    const b = createAppointmentSafe({ ...input }, { operationId: 'call_ABC' }) // retry of the same op
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(b.appointment.id).toBe(a.appointment.id)
    expect(count('רופא שיניים')).toBe(1)
  })

  it('DISTINCT operations with IDENTICAL content → TWO events (never wrongly collapsed)', () => {
    createAppointmentSafe(input, { operationId: 'call_ONE' })
    createAppointmentSafe({ ...input }, { operationId: 'call_TWO' }) // a genuinely different operation
    expect(count('רופא שיניים')).toBe(2)
  })

  it('same operation with insignificant content variation → still ONE (retry, not a new intent)', () => {
    const a = createAppointmentSafe({ ...input, notes: '' }, { operationId: 'call_X' })
    const b = createAppointmentSafe({ ...input, notes: '  ' }, { operationId: 'call_X' }) // trivially different serialization
    if (a.ok && b.ok) expect(b.appointment.id).toBe(a.appointment.id)
    expect(count('רופא שיניים')).toBe(1)
  })

  it('a re-create that ADDS real information under a NEW operation is NOT collapsed', () => {
    createAppointmentSafe(input, { operationId: 'call_P' })
    createAppointmentSafe({ ...input, location: 'מרפאה ברחוב ויצמן' }, { operationId: 'call_Q' })
    expect(count('רופא שיניים')).toBe(2) // the located one is preserved, not lost to a stale copy
  })

  it('NO operationId → each create is a distinct event (no content-based false collapse)', () => {
    createAppointmentSafe(input)
    createAppointmentSafe({ ...input })
    expect(count('רופא שיניים')).toBe(2)
  })

  it('reload/retry boundary: the op ledger is PERSISTED, so a retry after reload still yields ONE', () => {
    const a = createAppointmentSafe(input, { operationId: 'call_RELOAD' })
    // simulate a reload: storage object survives (persisted), a fresh call with the same op id
    const b = createAppointmentSafe({ ...input }, { operationId: 'call_RELOAD' })
    if (a.ok && b.ok) expect(b.appointment.id).toBe(a.appointment.id)
    expect(count('רופא שיניים')).toBe(1)
    expect(JSON.parse(storage['abu-appt-ops-v1'] ?? '{}')['call_RELOAD']).toBeTruthy() // ledger persisted
  })
})
