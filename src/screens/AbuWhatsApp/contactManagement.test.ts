import { describe, it, expect } from 'vitest'
import {
  validateContactFields,
  previewImportContacts,
  knownContactIdList,
  seedDefaultContactsIfEmpty,
  setLocalContacts,
  getLocalContacts,
  exportContactsJSON,
  contactsReceipt,
  DEFAULT_SEED_CONTACTS,
  type LocalFamilyContact,
} from './familyContactsStorage'

class MapStore {
  m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}

// Synthetic, pinned phone fixtures (see phonePrivacy.test.ts allow-list).
const P1 = '+972500000001'
const P2 = '+972500000002'

describe('validateContactFields — per-field, specific errors', () => {
  it('accepts a well-formed contact (any safe id — the store is the source of truth)', () => {
    expect(validateContactFields({ id: 'dr-cohen', displayName: 'ד״ר כהן', phoneE164: P1, enabled: true })).toEqual({})
  })
  it('rejects a missing id', () => {
    expect(validateContactFields({ id: '', displayName: 'X', phoneE164: P1, enabled: false }).id).toBeTruthy()
  })
  it('rejects an UNSAFE id (spaces / capitals / punctuation)', () => {
    expect(validateContactFields({ id: 'Mor Cohen!', displayName: 'מור', phoneE164: P1, enabled: false }).id).toBeTruthy()
  })
  it('accepts any previously-"unknown" safe id now (no fixed allowlist)', () => {
    expect(validateContactFields({ id: 'nobody', displayName: 'מישהו', phoneE164: P1, enabled: false }).id).toBeUndefined()
  })
  it('requires a display name (no scaffold fallback)', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: P1, enabled: true }).displayName).toBeTruthy()
  })
  it('accepts a documented alias (rafi → raphi)', () => {
    expect(validateContactFields({ id: 'rafi', displayName: 'רפי', phoneE164: P1, enabled: true }).id).toBeUndefined()
  })
  it('rejects an invalid phone', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: '12', enabled: false }).phoneE164).toBeTruthy()
  })
  it('normalizes an Israeli local number as valid', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: '0501234567', enabled: true }).phoneE164).toBeUndefined()
  })
  it('blocks enabling without any valid number', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: '', enabled: true }).enabled).toBeTruthy()
  })
  it('allows enabling via whatsapp only', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: '', whatsappE164: P1, enabled: true }).enabled).toBeUndefined()
  })
  it('rejects an empty display-name override', () => {
    expect(validateContactFields({ id: 'mor', displayName: '   ', phoneE164: P1, enabled: false }).displayName).toBeTruthy()
  })
  it('knownContactIdList excludes the family-group and is non-empty', () => {
    const list = knownContactIdList()
    expect(list).toContain('mor')
    expect(list).not.toContain('family-group')
  })
})

describe('contactsReceipt — privacy-safe operator diagnostic (Failure A)', () => {
  it('reports counts + actionability the way Communication sees them; no names/numbers', () => {
    const s = new MapStore()
    setLocalContacts([
      { id: 'mor', displayName: 'מור', enabled: true, phoneE164: '+972500000001' },   // call+wa ready
      { id: 'leo', displayName: 'לאו', enabled: true, phoneE164: '', whatsappE164: '+972500000002' }, // wa only
      { id: 'yael', displayName: 'יעל', enabled: false, phoneE164: '+972500000003' }, // disabled → not actionable
    ], s)
    const r = contactsReceipt(s)
    expect(r.contactCount).toBe(3)
    expect(r.actionableCall).toBe(1)       // only mor has an enabled valid phone
    expect(r.actionableWhatsApp).toBe(2)   // mor (phone) + leo (whatsapp)
    expect(r.storageSource).toBe('localStorage')
    expect(typeof r.snapshotVersion).toBe('number')
    // Privacy: the receipt shape carries no name / number / message fields.
    expect(Object.keys(r)).not.toContain('phoneE164')
    expect(JSON.stringify(r)).not.toContain('+9725')
    expect(JSON.stringify(r)).not.toContain('מור')
  })
  it('an empty store reports zero actionable (the "no usable numbers" state)', () => {
    const s = new MapStore()
    setLocalContacts([], s)
    const r = contactsReceipt(s)
    expect(r.contactCount).toBe(0)
    expect(r.actionableCall).toBe(0)
    expect(r.actionableWhatsApp).toBe(0)
  })
})

describe('seedDefaultContactsIfEmpty — store is the single source of truth, seeded once', () => {
  it('seeds the full default family into an empty store', () => {
    const s = new MapStore()
    expect(seedDefaultContactsIfEmpty(s)).toBe(true)
    const c = getLocalContacts(s)
    expect(c.length).toBe(DEFAULT_SEED_CONTACTS.length)
    // Seeded contacts carry identity + are disabled with no number.
    const mor = c.find((x) => x.id === 'mor')!
    expect(mor.displayName).toBe('מור')
    expect(mor.enabled).toBe(false)
    expect(mor.phoneE164).toBe('')
  })

  it('is a NO-OP once the store exists — a cleared (empty) store is NOT re-seeded', () => {
    const s = new MapStore()
    setLocalContacts([], s)                      // user cleared everyone
    expect(seedDefaultContactsIfEmpty(s)).toBe(false)
    expect(getLocalContacts(s)).toEqual([])       // stays empty (deleted stays deleted)
  })

  it('does not clobber existing contacts', () => {
    const s = new MapStore()
    setLocalContacts([{ id: 'saba', displayName: 'סבא', enabled: true, phoneE164: '+972500000001' }], s)
    expect(seedDefaultContactsIfEmpty(s)).toBe(false)
    expect(getLocalContacts(s).map((c) => c.id)).toEqual(['saba'])
  })
})

describe('previewImportContacts — merge diff before any save', () => {
  const current: LocalFamilyContact[] = [
    { id: 'mor', enabled: true, phoneE164: P1 },
    { id: 'yael', enabled: true, phoneE164: P2 },
  ]

  it('classifies added / updated / unchanged against the current store', () => {
    const json = JSON.stringify([
      { id: 'mor', enabled: true, phoneE164: P1 },            // unchanged
      { id: 'yael', enabled: false, phoneE164: P2 },          // updated (enabled flip)
      { id: 'leo', enabled: true, phoneE164: P1 },            // added
    ])
    const p = previewImportContacts(json, current)
    expect(p.parseError).toBeNull()
    expect(p.added.map((c) => c.id)).toEqual(['leo'])
    expect(p.updated.map((c) => c.id)).toEqual(['yael'])
    expect(p.unchanged.map((c) => c.id)).toEqual(['mor'])
    expect(p.toSave.map((c) => c.id).sort()).toEqual(['leo', 'yael'])
  })

  it('MERGE preserves absent ids: replaceAllRemoves counts what Replace-All would drop', () => {
    // Incoming names only leo → mor & yael are absent → replace-all would remove 2.
    const p = previewImportContacts(JSON.stringify([{ id: 'leo', enabled: true, phoneE164: P1 }]), current)
    expect(p.replaceAllRemoves).toBe(2)
    expect(p.added.map((c) => c.id)).toEqual(['leo'])
  })

  it('flags invalid items (unsafe id, bad shape, enabled-without-number) without saving', () => {
    const json = JSON.stringify([
      { id: 'bad id!', enabled: true, phoneE164: P1 }, // unsafe id (space + punctuation)
      { id: 'mor', enabled: true },                    // bad shape (no phoneE164)
      { id: 'leo', enabled: true, phoneE164: 'xx' },   // enabled without a valid number
    ])
    const p = previewImportContacts(json, current)
    expect(p.invalid.length).toBe(3)
    expect(p.toSave.length).toBe(0)
    expect(p.invalid[0]!.reason).toContain('לא תקין')
  })

  it('detects duplicate ids in the incoming JSON', () => {
    const json = JSON.stringify([
      { id: 'leo', enabled: true, phoneE164: P1 },
      { id: 'leo', enabled: true, phoneE164: P2 },
    ])
    const p = previewImportContacts(json, current)
    expect(p.duplicate.map((d) => d.id)).toEqual(['leo'])
  })

  it('surfaces a parse error with line/column and touches nothing', () => {
    const p = previewImportContacts('[{ "id": "mor" "enabled": true }]', current)
    expect(p.parseError).toBeTruthy()
    expect(p.parseErrorOffset).not.toBeNull()
    expect(p.added.length + p.updated.length + p.toSave.length).toBe(0)
  })

  it('rejects a non-array top level with a plain-language message', () => {
    const p = previewImportContacts('{"id":"mor"}', current)
    expect(p.parseError).toContain('מערך')
  })

  it('(9) export → import round-trip preserves photoDataUrl and photoFile', () => {
    const withPhotos: LocalFamilyContact[] = [
      { id: 'mor', displayName: 'מור', enabled: true, phoneE164: P1, photoDataUrl: 'data:image/jpeg;base64,QUJD' },
      { id: 'leo', displayName: 'לאו', enabled: false, phoneE164: '', photoFile: '/family-contacts/leo.png' },
    ]
    const json = exportContactsJSON(withPhotos)
    const p = previewImportContacts(json, [])
    expect(p.parseError).toBeNull()
    const mor = p.toSave.find((c) => c.id === 'mor')!
    const leo = p.toSave.find((c) => c.id === 'leo')!
    expect(mor.photoDataUrl).toBe('data:image/jpeg;base64,QUJD')
    expect(leo.photoFile).toBe('/family-contacts/leo.png')
  })
})
