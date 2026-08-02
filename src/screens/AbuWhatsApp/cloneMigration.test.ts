/*
 * GATE 4 / D5 — migration-on-clone atomicity. A migration runs on a CLONE and
 * commits only if schema + phone-preservation + checksum all pass; any failure
 * leaves the prior committed revision byte-for-byte intact. Each abort path has a
 * mutant proving the guard fires. Privacy: pinned-synthetic phone token only.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  migrateContactsOnClone, getLocalContacts, setLocalContacts,
  type LocalFamilyContact,
} from './familyContactsStorage'

const P1 = '+972500000001', P2 = '+972500000002'

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
  }
}
const seed = (): LocalFamilyContact[] => ([
  { id: 'mor', enabled: true, phoneE164: P1, displayName: 'מור' },
  { id: 'leo', enabled: true, phoneE164: P2, displayName: 'לאו' },
])
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage })

describe('D5 — migration on clone', () => {
  it('VALID migration commits atomically and preserves phones', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const res = migrateContactsOnClone((clone) => clone.map((c) => ({ ...c, relationshipHebrew: 'משפחה' })), s)
    expect(res.committed).toBe(true)
    expect(res.reason).toBe('ok')
    const after = getLocalContacts(s)
    expect(after.every((c) => c.relationshipHebrew === 'משפחה')).toBe(true)
    expect(after.filter((c) => c.phoneE164).length).toBe(2)   // phones preserved
  })

  it('INTERRUPTED migration (throws) aborts; prior revision untouched', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const before = JSON.stringify(getLocalContacts(s))
    const res = migrateContactsOnClone(() => { throw new Error('boom') }, s)
    expect(res.committed).toBe(false)
    expect(res.reason).toBe('threw')
    expect(JSON.stringify(getLocalContacts(s))).toBe(before)   // intact
  })

  it('INVALID schema output aborts; prior revision untouched', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const before = JSON.stringify(getLocalContacts(s))
    // migration returns a malformed row (missing phoneE164/enabled)
    const res = migrateContactsOnClone(() => ([{ id: 'mor' } as unknown as LocalFamilyContact]), s)
    expect(res.committed).toBe(false)
    expect(res.reason).toBe('schema-invalid')
    expect(JSON.stringify(getLocalContacts(s))).toBe(before)
  })

  it('STRIP-PHONES mutant aborts on the phone-preservation invariant; prior intact', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const before = JSON.stringify(getLocalContacts(s))
    const res = migrateContactsOnClone((clone) => clone.map((c) => ({ ...c, phoneE164: '' })), s)
    expect(res.committed).toBe(false)
    expect(res.reason).toBe('phone-loss')
    expect(JSON.stringify(getLocalContacts(s))).toBe(before)   // phones NOT stripped
    expect(getLocalContacts(s).filter((c) => c.phoneE164).length).toBe(2)
  })

  it('IDEMPOTENT identity migration is a no-op (no rewrite)', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const res = migrateContactsOnClone((clone) => clone, s)
    expect(res.committed).toBe(false)
    expect(res.reason).toBe('no-op')
    expect(getLocalContacts(s).filter((c) => c.phoneE164).length).toBe(2)
  })

  it('dropping a phoned contact entirely is caught as phone-loss', () => {
    const s = fakeStorage(); setLocalContacts(seed(), s)
    const res = migrateContactsOnClone((clone) => clone.filter((c) => c.id !== 'leo'), s)
    expect(res.committed).toBe(false)
    expect(res.reason).toBe('phone-loss')
    expect(getLocalContacts(s).map((c) => c.id).sort()).toEqual(['leo', 'mor'])
  })
})
