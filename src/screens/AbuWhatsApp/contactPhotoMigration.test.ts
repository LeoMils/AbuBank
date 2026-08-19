import { describe, it, expect } from 'vitest'
import {
  migrateContactPhotos,
  setLocalContacts,
  getLocalContacts,
  DEFAULT_CONTACT_PHOTOS,
  type LocalFamilyContact,
} from './familyContactsStorage'

// Injected, hermetic storage (no window/durable). Pinned synthetic phone only.
class MapStore {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const P1 = '+972500000001'
const DATA = 'data:image/jpeg;base64,QUJD'

describe('migrateContactPhotos — one-time, versioned, idempotent photo backfill', () => {
  it('(1) backfills the correct bundled photo onto a known contact that has none', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'mor', displayName: 'מור', enabled: false, phoneE164: '' }], s)
    const r = migrateContactPhotos(s)
    expect(r.migrated).toBe(1)
    expect(getLocalContacts(s).find((c) => c.id === 'mor')!.photoFile).toBe(DEFAULT_CONTACT_PHOTOS.mor)
  })

  it('(2) never overwrites a user-uploaded photoDataUrl', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'mor', displayName: 'מור', enabled: true, phoneE164: P1, photoDataUrl: DATA }], s)
    const r = migrateContactPhotos(s)
    expect(r.migrated).toBe(0)
    const mor = getLocalContacts(s).find((c) => c.id === 'mor')!
    expect(mor.photoDataUrl).toBe(DATA)
    expect(mor.photoFile).toBeUndefined()
  })

  it('(2b) never overwrites an existing photoFile', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'mor', displayName: 'מור', enabled: false, phoneE164: '', photoFile: '/custom/mor.png' }], s)
    migrateContactPhotos(s)
    expect(getLocalContacts(s).find((c) => c.id === 'mor')!.photoFile).toBe('/custom/mor.png')
  })

  it('(3) never recreates a deleted contact (only touches what is stored)', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'mor', displayName: 'מור', enabled: false, phoneE164: '' }], s) // yael deleted / absent
    migrateContactPhotos(s)
    expect(getLocalContacts(s).map((c) => c.id)).toEqual(['mor'])
  })

  it('(4) is idempotent + version-gated: a second run is a skipped no-op', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'leo', displayName: 'לאו', enabled: false, phoneE164: '' }], s)
    const first = migrateContactPhotos(s)
    expect(first.migrated).toBe(1)
    expect(first.skipped).toBe(false)
    const before = getLocalContacts(s)
    const second = migrateContactPhotos(s)
    expect(second.skipped).toBe(true)
    expect(second.migrated).toBe(0)
    expect(getLocalContacts(s)).toEqual(before) // unchanged
  })

  it('leaves an unknown (non-family) contact without a bundled photo', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'dr-cohen', displayName: 'ד״ר כהן', enabled: true, phoneE164: P1 }], s)
    migrateContactPhotos(s)
    expect(getLocalContacts(s).find((c) => c.id === 'dr-cohen')!.photoFile).toBeUndefined()
  })
})
