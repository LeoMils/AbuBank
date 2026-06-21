import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { saveAppointments, loadAppointments } from './service'
import { durable } from '../../services/durableStore'

function installLS() {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(), key: () => null, length: 0,
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('calendar persistence — durable write-through survives localStorage eviction', () => {
  beforeEach(() => installLS())
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('saveAppointments → evict localStorage → durable.init() restores → loadAppointments recovers', async () => {
    const appts = [{ id: 't1', title: 'רופא', date: '2026-06-22', time: '16:00', emoji: '🏥', color: '#C9A84C' }]
    saveAppointments(appts)
    await flush()
    expect(loadAppointments()).toHaveLength(1) // present via the synchronous mirror

    // Simulate eviction (localStorage wiped) while the durable backend survives.
    installLS()
    expect(loadAppointments()).toHaveLength(0) // mirror gone

    await durable.init()                        // restore the mirror from the durable backend
    expect(loadAppointments()).toEqual(appts)   // recovered — zero data loss
  })
})
