/*
 * AbuWhatsApp contacts — DATA RELIABILITY proof.
 *
 * The bug: AbuWhatsApp per-person phones live under the localStorage key
 * `abubank.familyContacts.v1`, which was NOT registered in the durable
 * (IndexedDB) store. Safari ITP / storage pressure evicts localStorage → the
 * numbers vanish with no durable copy to restore from.
 *
 * The fix (proven here):
 *   1. The key is now a CRITICAL_KEY → it gets an IndexedDB mirror + auto-restore.
 *   2. Contacts writes keep the durable backend current → no stale-clobber on reload.
 *   3. A schema-versioned envelope + back-compat read of the legacy bare array.
 *   4. Automatic pre-migration backup before any schema migration.
 *   5. Corruption recovery: bad JSON never throws and never wipes a good copy.
 *
 * Privacy: no phone digits — every fixture uses id + enabled:false + empty phone,
 * so this file adds zero phone-like tokens to the repo.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  DurableStore,
  MemoryBackend,
  CRITICAL_KEYS,
  PRE_MIGRATION_BACKUP_KEY,
} from '../../services/durableStore'
import {
  CONTACTS_SCHEMA_VERSION,
  LOCAL_FAMILY_CONTACTS_STORAGE_KEY as KEY,
  parseContactsPayload,
  readContactsWithDiagnostics,
  migrateContactsFormat,
  validateContacts,
  getLocalContacts,
  setLocalContacts,
  clearLocalContacts,
  type ContactsEnvelope,
  type LocalFamilyContact,
} from './familyContactsStorage'

// Internal durable schema-version key (mirrors the private SCHEMA_KEY constant
// in durableStore.ts) — used ONLY to white-box simulate an app/schema version
// change in the version-bump test below.
const SCHEMA_KEY = '__abu_schema_version__'

// ── helpers ─────────────────────────────────────────────────────────────────

function envelope(contacts: LocalFamilyContact[]): string {
  return JSON.stringify({ v: CONTACTS_SCHEMA_VERSION, contacts } satisfies ContactsEnvelope)
}
const CONTACTS: LocalFamilyContact[] = [
  { id: 'mor', enabled: false, phoneE164: '' },
  { id: 'leo', enabled: false, phoneE164: '' },
]

function installLS(seed: Record<string, string> = {}) {
  const m = new Map<string, string>(Object.entries(seed))
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(), key: () => null, length: 0,
  }
  return m
}
const flush = () => new Promise((r) => setTimeout(r, 0))

interface MapStorage {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}
function makeFakeStorage(): MapStorage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v) },
    removeItem: (k) => { store.delete(k) },
  }
}

// ── 1. The key is durable ─────────────────────────────────────────────────────

describe('reliability — the contacts key is registered as durable', () => {
  it('abubank.familyContacts.v1 is in CRITICAL_KEYS (root-cause fix)', () => {
    expect(KEY).toBe('abubank.familyContacts.v1')
    expect([...CRITICAL_KEYS]).toContain(KEY)
  })
})

// ── 2. Survives reload + eviction (the core disappearance bug) ─────────────────

describe('reliability — contacts survive reload + localStorage eviction', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('current-format contacts migrate into IndexedDB and survive an evicted reload', async () => {
    installLS({ [KEY]: envelope(CONTACTS) })
    const backend = new MemoryBackend()        // cold IndexedDB
    const s1 = new DurableStore(backend)
    await s1.init(); await flush()
    expect(backend.snapshot()[KEY]).toBe(envelope(CONTACTS)) // now durable

    installLS()                                 // Safari ITP wipes localStorage
    const s2 = new DurableStore(backend)        // reload: fresh store, same IndexedDB
    await s2.init()
    expect(parseContactsPayload(s2.getString(KEY)).contacts.map(c => c.id)).toEqual(['mor', 'leo'])
  })

  it('legacy bare-array contacts also survive an evicted reload (back-compat)', async () => {
    const legacy = JSON.stringify(CONTACTS)     // v1: bare array, no envelope
    installLS({ [KEY]: legacy })
    const backend = new MemoryBackend()
    const s1 = new DurableStore(backend)
    await s1.init(); await flush()

    installLS()                                 // evict
    const s2 = new DurableStore(backend)
    await s2.init()
    const diag = parseContactsPayload(s2.getString(KEY))
    expect(diag.version).toBe(1)                // read as legacy
    expect(diag.contacts.map(c => c.id)).toEqual(['mor', 'leo']) // no loss
  })
})

// ── 3. Automatic pre-migration backup ─────────────────────────────────────────

describe('reliability — automatic backup before migration', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('captures a reversible snapshot of contacts before the first migration', async () => {
    installLS({ [KEY]: envelope(CONTACTS) })
    const backend = new MemoryBackend()
    const s = new DurableStore(backend)
    await s.init(); await flush()

    const raw = s.getPreMigrationBackup()
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as { data: Record<string, string> }
    expect(parsed.data[KEY]).toBe(envelope(CONTACTS)) // recoverable pre-migration copy
  })

  it('fresh install (no data) writes no backup — nothing to protect', async () => {
    installLS()
    const backend = new MemoryBackend()
    const s = new DurableStore(backend)
    await s.init(); await flush()
    expect(s.getPreMigrationBackup()).toBeNull()
    expect(backend.snapshot()[PRE_MIGRATION_BACKUP_KEY]).toBeUndefined()
  })
})

// ── 4. Survives an app / schema version change ────────────────────────────────

describe('reliability — contacts survive an app/schema version change', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('a schema-version bump preserves contacts and snapshots the pre-bump state', async () => {
    installLS()
    // Backend already holds contacts under an OLDER schema stamp (simulates a
    // previously-installed app version).
    const backend = new MemoryBackend({ [SCHEMA_KEY]: '0', [KEY]: envelope(CONTACTS) })
    const s = new DurableStore(backend)
    await s.init(); await flush()

    // Data is intact after the version change...
    expect(parseContactsPayload(s.getString(KEY)).contacts).toHaveLength(2)
    // ...and a pre-bump backup was captured.
    const raw = s.getPreMigrationBackup()
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).fromSchema).toBe('0')
  })
})

// ── 5. Corruption recovery ────────────────────────────────────────────────────

describe('reliability — corruption never wipes a good copy', () => {
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

  it('corrupt localStorage is repaired from the durable backend on reload', async () => {
    installLS({ [KEY]: '{ this is not json' })                 // corrupt mirror
    const backend = new MemoryBackend({ [KEY]: envelope(CONTACTS) }) // good durable copy
    const s = new DurableStore(backend)
    await s.init()
    // durable.init() overwrites the corrupt mirror with the good backend value.
    expect(s.getString(KEY)).toBe(envelope(CONTACTS))
    expect(parseContactsPayload(s.getString(KEY)).contacts).toHaveLength(2)
  })

  it('parseContactsPayload never throws on garbage and flags corruption', () => {
    const diag = parseContactsPayload('}{ total garbage')
    expect(diag.contacts).toEqual([])
    expect(diag.corrupt).toBe(true)
  })
})

// ── 6. Schema envelope + validation + salvage (hermetic, injected storage) ─────

describe('familyContactsStorage — schema envelope + validation', () => {
  it('writes a versioned envelope and reads it back', () => {
    const fake = makeFakeStorage()
    setLocalContacts(CONTACTS, fake)
    const raw = fake.getItem(KEY)!
    expect(JSON.parse(raw).v).toBe(CONTACTS_SCHEMA_VERSION)
    expect(getLocalContacts(fake).map(c => c.id)).toEqual(['mor', 'leo'])
    expect(readContactsWithDiagnostics(fake).version).toBe(CONTACTS_SCHEMA_VERSION)
  })

  it('reads a legacy bare array (v1) without loss', () => {
    const fake = makeFakeStorage()
    fake.setItem(KEY, JSON.stringify(CONTACTS))
    const diag = readContactsWithDiagnostics(fake)
    expect(diag.version).toBe(1)
    expect(diag.contacts).toHaveLength(2)
  })

  it('salvages the valid entries when the payload is partially corrupt', () => {
    const fake = makeFakeStorage()
    fake.setItem(KEY, JSON.stringify([
      { id: 'mor', enabled: false, phoneE164: '' },
      { id: 'leo', enabled: 'NOPE' },   // invalid shape
      { garbage: true },                // invalid shape
    ]))
    const diag = readContactsWithDiagnostics(fake)
    expect(diag.contacts.map(c => c.id)).toEqual(['mor'])
    expect(diag.recovered).toBe(true)
    expect(diag.dropped).toBe(2)
  })

  it('validateContacts rejects unknown ids and bad shapes, keeps valid ones', () => {
    const r = validateContacts([
      { id: 'mor', enabled: false, phoneE164: '' },
      { id: 'stranger', enabled: false, phoneE164: '' },  // unknown id
      { nope: 1 },                                        // bad shape
    ])
    expect(r.valid.map(c => c.id)).toEqual(['mor'])
    expect(r.errors).toHaveLength(2)
    expect(validateContacts('not-an-array').errors).toEqual(['not an array'])
  })
})

describe('familyContactsStorage — migrateContactsFormat', () => {
  it('upgrades a legacy bare array to the current envelope in place', () => {
    const fake = makeFakeStorage()
    fake.setItem(KEY, JSON.stringify(CONTACTS))
    const r = migrateContactsFormat(fake)
    expect(r.migrated).toBe(true)
    expect(r.from).toBe(1)
    expect(r.to).toBe(CONTACTS_SCHEMA_VERSION)
    expect(JSON.parse(fake.getItem(KEY)!).v).toBe(CONTACTS_SCHEMA_VERSION)
  })

  it('is a no-op when storage is already current and clean', () => {
    const fake = makeFakeStorage()
    setLocalContacts(CONTACTS, fake)
    expect(migrateContactsFormat(fake).migrated).toBe(false)
  })

  it('leaves an unsalvageable blob untouched (lets a good durable copy win later)', () => {
    const fake = makeFakeStorage()
    fake.setItem(KEY, '{ hopeless')
    expect(migrateContactsFormat(fake).migrated).toBe(false)
    expect(fake.getItem(KEY)).toBe('{ hopeless')
  })
})

// ── 7. Mid-session durable recovery via the real runtime path ─────────────────

describe('familyContactsStorage — durable mirror recovers evicted contacts', () => {
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown }
  let savedWindow: unknown
  let savedLS: unknown

  afterEach(() => {
    // Clear the durable singleton's copy of the key, then restore globals.
    try { clearLocalContacts() } catch { /* ignore */ }
    if (savedWindow === undefined) delete g.window; else g.window = savedWindow
    if (savedLS === undefined) delete g.localStorage; else g.localStorage = savedLS
  })

  it('getLocalContacts() recovers from the durable mirror after localStorage is evicted', () => {
    savedWindow = g.window
    savedLS = g.localStorage

    // Runtime path: window.localStorage is the default storage → writes mirror
    // into the durable singleton.
    const fake = makeFakeStorage()
    g.window = { localStorage: fake }
    g.localStorage = fake
    setLocalContacts(CONTACTS)                 // default storage = window.localStorage
    expect(getLocalContacts()).toHaveLength(2)

    // Simulate ITP eviction: localStorage is wiped, but the durable in-memory
    // mirror still holds the value.
    const evicted = makeFakeStorage()
    g.window = { localStorage: evicted }
    g.localStorage = evicted
    expect(evicted.getItem(KEY)).toBeNull()    // mirror really is gone
    expect(getLocalContacts().map(c => c.id)).toEqual(['mor', 'leo']) // recovered
  })
})
