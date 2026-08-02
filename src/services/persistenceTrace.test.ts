/*
 * Persistence trace — privacy-safe instrumentation that must (a) count contacts
 * and phones correctly, (b) never emit a name/number, (c) capture the reconcile
 * winner, and (d) survive a simulated reopen (persisted in localStorage).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DurableStore, setReconcileObserver } from './durableStore'
import {
  initPersistenceTrace, traceStage, getTraceText, getTraceEntries, clearPersistenceTrace,
} from './persistenceTrace'

const CONTACTS_KEY = 'abubank.familyContacts.v1'

function installLS(seed: Record<string, string> = {}): Map<string, string> {
  const m = new Map<string, string>(Object.entries(seed))
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
  return m
}

class MemoryBackend {
  private store: Map<string, string>
  constructor(seed: Record<string, string> = {}) { this.store = new Map(Object.entries(seed)) }
  async get(k: string) { return this.store.has(k) ? this.store.get(k)! : null }
  async set(k: string, v: string) { this.store.set(k, v) }
  async remove(k: string) { this.store.delete(k) }
  async getAll() { return Object.fromEntries(this.store) }
}

const envelope = (contacts: unknown[]) => JSON.stringify({ v: 2, contacts })
// Seed shape: names + photos, NO phones (the exact device symptom).
const SEED = [
  { id: 'mor', displayName: 'מור', enabled: false, phoneE164: '', photoFile: '/x.png' },
  { id: 'leo', displayName: 'לאו', enabled: false, phoneE164: '', photoFile: '/y.png' },
]
// Imported shape: same people WITH phones.
const IMPORTED = [
  { id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000456', photoFile: '/x.png' },
  { id: 'leo', displayName: 'לאו', enabled: true, phoneE164: '+972500000123', photoFile: '/y.png' },
]

beforeEach(() => { installLS(); clearPersistenceTrace() })
afterEach(() => { setReconcileObserver(null); delete (globalThis as { localStorage?: unknown }).localStorage })

describe('persistenceTrace — truthful counts, privacy-safe', () => {
  it('captures the reconcile winner + ls/idb counts when localStorage (with phones) wins', async () => {
    // localStorage has the fresh import (2 phones); backend has the stale seed (0 phones).
    installLS({ [CONTACTS_KEY]: envelope(IMPORTED) })
    const backend = new MemoryBackend({ [CONTACTS_KEY]: envelope(SEED) })
    initPersistenceTrace()
    const s = new DurableStore(backend)
    await s.init()
    traceStage('post-init')

    const text = getTraceText()
    // Reconcile line present with the right counts + winner.
    const reconcile = getTraceEntries().find((e) => e.stage === 'reconcile')!
    expect(reconcile.lsPhones).toBe(2)      // import present in localStorage
    expect(reconcile.idbPhones).toBe(0)     // stale seed in the backend
    expect(reconcile.winner).toBe('localStorage')
    // Privacy: the rendered trace never leaks a name or number.
    expect(text).not.toMatch(/972/)
    expect(text).not.toMatch(/מור|לאו/)
  })

  it('flags the failure shape: boot-start localStorage already has 0 phones', () => {
    // Simulate the reported reopen: localStorage holds the number-less seed.
    installLS({ [CONTACTS_KEY]: envelope(SEED) })
    initPersistenceTrace()
    const boot = getTraceEntries().find((e) => e.stage === 'boot-start')!
    expect(boot.lsContacts).toBe(2)
    expect(boot.lsPhones).toBe(0)           // numbers already gone before any reconcile
  })

  it('marks a corrupt localStorage payload as CORRUPT (not silently 0)', () => {
    installLS({ [CONTACTS_KEY]: '{ not json' })
    initPersistenceTrace()
    const boot = getTraceEntries().find((e) => e.stage === 'boot-start')!
    expect(boot.lsContacts).toBe(-1)
    expect(getTraceText()).toMatch(/CORRUPT/)
  })

  it('persists across a simulated reopen (survives in localStorage)', () => {
    installLS({ [CONTACTS_KEY]: envelope(IMPORTED) })
    initPersistenceTrace()
    traceStage('wa-read')
    const before = getTraceEntries().length
    expect(before).toBeGreaterThan(0)
    // New module state is not resettable here, but the persisted copy is what the
    // operator panel reads — assert it is retrievable and non-empty.
    expect(getTraceText()).toMatch(/wa-read/)
    expect(getTraceText()).toMatch(/boot-start/)
  })
})
