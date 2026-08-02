/*
 * GATE 5 / D11 — DURABILITY-BEFORE-SUCCESS CONTRACT (defect #1 oracle).
 *
 * The device-relevant failure a hard process kill would expose is: "UI reports
 * SAVED before the durable (IndexedDB) transaction has actually committed."
 * Playwright cannot SIGKILL a persistent-context browser in this version, so this
 * proves the same property deterministically with a DELAYED backend that only
 * resolves its writes after a macrotask — the automatable equivalent of a kill in
 * the fire-and-forget window.
 *
 * D11: a write is durable ONLY after flush() resolves. A UI that claims success
 * before flushing has a real data-loss window. This test both DEFINES that law
 * and CERTIFIES the detector (the race is observable before flush, closed after).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { DurableStore, type KVBackend } from './durableStore'

const KEY = 'abubank.familyContacts.v1'
const envelope = (contacts: unknown[]) => JSON.stringify({ v: 2, contacts })
const IMPORTED = envelope([{ id: 'mor', enabled: true, phoneE164: '+972500000001' }])

function installLS(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
  }
  return m
}

/** A backend whose set() only commits after a macrotask — models the real async
 *  IndexedDB write latency, so a kill BEFORE flush loses the write. */
class DelayedBackend implements KVBackend {
  private m = new Map<string, string>()
  pending = 0
  async getAll() { return Object.fromEntries(this.m) }
  set(k: string, v: string): Promise<void> {
    this.pending++
    return new Promise((resolve) => setTimeout(() => { this.m.set(k, v); this.pending--; resolve() }, 0))
  }
  async remove(k: string) { this.m.delete(k) }
  committed(k: string) { return this.m.has(k) }
}

afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

describe('D11 — durability before success', () => {
  it('a fire-and-forget write is NOT durable until flush() resolves (race window is real)', async () => {
    installLS()
    const backend = new DelayedBackend()
    const store = new DurableStore(backend)
    await store.init()

    store.setString(KEY, IMPORTED)
    // Synchronous mirror is present immediately (what the UI reads to claim "saved").
    expect(store.getString(KEY)).toBe(IMPORTED)
    // …but the DURABLE backend has NOT committed yet — a kill here loses the write.
    expect(backend.committed(KEY), 'race window: backend not yet durable').toBe(false)
    expect(backend.pending).toBeGreaterThan(0)

    // D11: only after flush() is the write durable. A correct "saved" claim must
    // await this (the transactional-repository contract).
    await store.flush()
    expect(backend.committed(KEY), 'after flush: durable').toBe(true)
    expect(backend.pending).toBe(0)
  })

  it('after flush, a fresh store over the same backend recovers the import (durable proof)', async () => {
    installLS()
    const backend = new DelayedBackend()
    const s1 = new DurableStore(backend)
    await s1.init()
    s1.setString(KEY, IMPORTED)
    await s1.flush()                                   // COMMIT the transaction

    // Simulate reopen with localStorage evicted: only the durable copy remains.
    installLS()
    const s2 = new DurableStore(backend)
    await s2.init()
    expect(s2.getString(KEY)).toBe(IMPORTED)           // recovered from IndexedDB
  })
})
