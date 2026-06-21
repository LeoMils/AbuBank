import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DurableStore, MemoryBackend } from './durableStore'

// Minimal localStorage mock (node test env has none).
function installLS(seed: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(seed))
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null, length: 0,
  }
  return m
}
const flush = () => new Promise((r) => setTimeout(r, 0)) // let fire-and-forget backend writes settle

const KEY = 'abubank-calendar-appointments'

describe('DurableStore — CRUD', () => {
  beforeEach(() => installLS())
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('save + read (string)', () => {
    const s = new DurableStore(new MemoryBackend())
    s.setString(KEY, 'hello')
    expect(s.getString(KEY)).toBe('hello')
  })

  it('save + read + update + delete (JSON)', () => {
    const s = new DurableStore(new MemoryBackend())
    s.setJSON(KEY, [{ id: '1', title: 'רופא' }])
    expect(s.getJSON(KEY, [])).toEqual([{ id: '1', title: 'רופא' }])
    s.setJSON(KEY, [{ id: '1', title: 'רופא' }, { id: '2', title: 'מור' }]) // update
    expect(s.getJSON<unknown[]>(KEY, [])).toHaveLength(2)
    s.remove(KEY)                                                            // delete
    expect(s.getString(KEY)).toBeNull()
  })

  it('write-through: writes the localStorage mirror synchronously', () => {
    const ls = installLS()
    const s = new DurableStore(new MemoryBackend())
    s.setString(KEY, 'mirrored')
    expect(ls.get(KEY)).toBe('mirrored') // mirror present immediately, no await
  })
})

describe('DurableStore — migration (localStorage → backend)', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('migrates existing localStorage data into the durable backend on init', async () => {
    installLS({ [KEY]: JSON.stringify([{ id: 'x', title: 'old' }]) })
    const backend = new MemoryBackend()             // backend starts EMPTY (cold IndexedDB)
    const s = new DurableStore(backend)
    await s.init()
    await flush()
    expect(s.getJSON<unknown[]>(KEY, [])).toHaveLength(1)        // visible after migration
    expect(backend.snapshot()[KEY]).toBeDefined()               // copied into the durable backend
  })

  it('migration is idempotent + safe to retry (no data loss on re-init)', async () => {
    installLS({ [KEY]: JSON.stringify([{ id: 'x' }]) })
    const backend = new MemoryBackend()
    const s = new DurableStore(backend)
    await s.init(); await flush()
    await s.init(); await flush()                   // retry
    expect(s.getJSON<unknown[]>(KEY, [])).toHaveLength(1)
    expect(Object.keys(backend.snapshot()).filter((k) => k === KEY)).toHaveLength(1)
  })

  it('does NOT overwrite backend data with stale localStorage on init', async () => {
    installLS({ [KEY]: JSON.stringify([{ id: 'stale' }]) })
    const backend = new MemoryBackend({ [KEY]: JSON.stringify([{ id: 'fresh-from-idb' }]) })
    const s = new DurableStore(backend)
    await s.init()
    expect(s.getJSON<{ id: string }[]>(KEY, [])[0]!.id).toBe('fresh-from-idb') // backend wins
  })
})

describe('DurableStore — durability across reload', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('data written in one session is present after a simulated reload (even if localStorage is wiped)', async () => {
    installLS()
    const backend = new MemoryBackend()
    const s1 = new DurableStore(backend)
    await s1.init()
    s1.setJSON(KEY, [{ id: 'doctor', time: '16:00' }])
    await flush()

    // Simulate reload: localStorage cleared (eviction), brand-new store over the
    // SAME durable backend (IndexedDB survives).
    installLS() // wipe mirror
    const s2 = new DurableStore(backend)
    await s2.init()
    expect(s2.getJSON<{ id: string }[]>(KEY, [])).toEqual([{ id: 'doctor', time: '16:00' }])
  })
})

describe('DurableStore — corruption recovery', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('invalid JSON in primary falls back to the caller default, never throws', () => {
    installLS({ [KEY]: '{not json' })
    const s = new DurableStore(new MemoryBackend())
    expect(() => s.getJSON(KEY, [])).not.toThrow()
    expect(s.getJSON(KEY, ['default'])).toEqual(['default'])
  })

  it('recovers from a valid localStorage mirror when the cache value is corrupt', async () => {
    installLS()
    const s = new DurableStore(new MemoryBackend())
    // Cache corrupt, mirror good (set directly so cache != mirror).
    ;(s as unknown as { cache: Map<string, string> }).cache.set(KEY, '{bad')
    ;(globalThis.localStorage as Storage).setItem(KEY, JSON.stringify([{ id: 'recovered' }]))
    expect(s.getJSON<{ id: string }[]>(KEY, [])[0]!.id).toBe('recovered')
  })
})

describe('DurableStore — export / import backup', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('exportAll → importAll restores managed keys into a fresh store', () => {
    installLS()
    const a = new DurableStore(new MemoryBackend())
    a.setJSON(KEY, [{ id: 'a1' }])
    a.setJSON('abu_reminders_v1', [{ id: 'r1' }])
    const blob = a.exportAll()

    installLS() // fresh origin (URL change) — empty
    const b = new DurableStore(new MemoryBackend())
    const res = b.importAll(blob)
    expect(res.ok).toBe(true)
    expect(res.restored).toBeGreaterThanOrEqual(2)
    expect(b.getJSON<unknown[]>(KEY, [])).toHaveLength(1)
    expect(b.getJSON<unknown[]>('abu_reminders_v1', [])).toHaveLength(1)
  })

  it('importAll rejects a malformed blob without throwing', () => {
    installLS()
    const s = new DurableStore(new MemoryBackend())
    expect(s.importAll('garbage').ok).toBe(false)
  })
})
