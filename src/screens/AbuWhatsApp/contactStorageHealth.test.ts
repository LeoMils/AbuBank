/*
 * GATE 8 — contact storage health taxonomy. Proves each code is produced for the
 * right observable state, and that a storage/recovery failure is NEVER reported
 * as "not configured". Privacy: pinned-synthetic phone token only.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  classifyContactStorage, contactStorageMessageHebrew,
  recordCommittedSave, markSaveInflight, markUserDeletion, recordWriteError,
} from './contactStorageHealth'
import { LOCAL_FAMILY_CONTACTS_STORAGE_KEY as KEY } from './familyContactsStorage'

const P1 = '+972500000001'
const envelope = (cs: unknown[]) => JSON.stringify({ v: 2, contacts: cs })

function fake(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    _map: m,
  }
}
function setOrigin(host: string | null) {
  if (host === null) { delete (globalThis as { window?: unknown }).window; return }
  ;(globalThis as { window?: unknown }).window = { location: { hostname: host } }
}
afterEach(() => setOrigin(null))

describe('contact storage taxonomy', () => {
  it('OK when a phone is present', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]) })
    expect(classifyContactStorage(s).code).toBe('OK')
  })

  it('CONTACT_NOT_CONFIGURED on a genuine first run (never saved, unknown origin)', () => {
    const s = fake({ [KEY]: envelope([{ id: 'mor', enabled: false, phoneE164: '' }]) })
    expect(classifyContactStorage(s).code).toBe('CONTACT_NOT_CONFIGURED')
  })

  it('DATA_CORRUPT on an unparseable payload', () => {
    const s = fake({ [KEY]: '{ not json' })
    expect(classifyContactStorage(s).code).toBe('DATA_CORRUPT')
  })

  it('STORAGE_UNAVAILABLE when there is no storage', () => {
    expect(classifyContactStorage(null).code).toBe('STORAGE_UNAVAILABLE')
  })

  it('QUOTA_EXCEEDED when a quota write-error was recorded and nothing saved', () => {
    const s = fake({ [KEY]: envelope([]) })
    recordWriteError('quota', s)
    expect(classifyContactStorage(s).code).toBe('QUOTA_EXCEEDED')
  })

  it('SAVE_INTERRUPTED when an in-flight save never committed', () => {
    const s = fake({ [KEY]: envelope([]) })
    markSaveInflight(s)
    expect(classifyContactStorage(s).code).toBe('SAVE_INTERRUPTED')
  })

  it('EXTERNAL_STORAGE_LOSS when the store is empty but was saved before on the canonical origin', () => {
    setOrigin('abu-ela-rc.vercel.app')
    const s = fake({ [KEY]: envelope([]) })
    recordCommittedSave(3, s)                 // high-water = 3
    // now the store is emptied by an external cause (not user deletion):
    s._map.set(KEY, envelope([]))
    expect(classifyContactStorage(s).code).toBe('EXTERNAL_STORAGE_LOSS')
  })

  it('USER_DELETION when the user explicitly deleted after a prior save', () => {
    setOrigin('abu-ela-rc.vercel.app')
    const s = fake({ [KEY]: envelope([]) })
    recordCommittedSave(3, s)
    markUserDeletion(s)
    expect(classifyContactStorage(s).code).toBe('USER_DELETION')
  })

  it('WRONG_ORIGIN on a non-canonical origin with a fresh store', () => {
    setOrigin('abu-bank-random-preview.vercel.app')
    const s = fake({ [KEY]: envelope([]) })
    expect(classifyContactStorage(s).code).toBe('WRONG_ORIGIN')
  })

  it('recordCommittedSave raises the high-water and clears failure markers', () => {
    setOrigin('abu-ela-rc.vercel.app')
    const s = fake({ [KEY]: envelope([]) })
    markSaveInflight(s); recordWriteError('quota', s)
    recordCommittedSave(2, s)                 // clean save clears markers
    // store now has phones → OK, not SAVE_INTERRUPTED/QUOTA
    s._map.set(KEY, envelope([{ id: 'mor', enabled: true, phoneE164: P1 }]))
    expect(classifyContactStorage(s).code).toBe('OK')
  })

  it('a storage/recovery failure is NEVER worded as "not configured"', () => {
    for (const code of ['SAVE_INTERRUPTED', 'DATA_CORRUPT', 'EXTERNAL_STORAGE_LOSS', 'QUOTA_EXCEEDED', 'STORAGE_UNAVAILABLE'] as const) {
      const msg = contactStorageMessageHebrew(code)
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).not.toContain('לא הוגדר')  // only CONTACT_NOT_CONFIGURED may say this
    }
    expect(contactStorageMessageHebrew('CONTACT_NOT_CONFIGURED')).toContain('לא הוגדר')
  })
})
