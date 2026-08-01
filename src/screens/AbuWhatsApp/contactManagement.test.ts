import { describe, it, expect } from 'vitest'
import {
  validateContactFields,
  previewImportContacts,
  knownContactIdList,
  type LocalFamilyContact,
} from './familyContactsStorage'

// Synthetic, pinned phone fixtures (see phonePrivacy.test.ts allow-list).
const P1 = '+972500000001'
const P2 = '+972500000002'

describe('validateContactFields — per-field, specific errors', () => {
  it('accepts a well-formed known contact', () => {
    expect(validateContactFields({ id: 'mor', phoneE164: P1, enabled: true })).toEqual({})
  })
  it('rejects a missing id', () => {
    expect(validateContactFields({ id: '', phoneE164: P1, enabled: false }).id).toBeTruthy()
  })
  it('rejects an unsupported id and names the allowed set', () => {
    const e = validateContactFields({ id: 'nobody', phoneE164: P1, enabled: false })
    expect(e.id).toContain('לא נתמך')
  })
  it('accepts a documented alias (rafi → raphi)', () => {
    expect(validateContactFields({ id: 'rafi', phoneE164: P1, enabled: true }).id).toBeUndefined()
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

  it('flags invalid items (unknown id, bad shape, enabled-without-number) without saving', () => {
    const json = JSON.stringify([
      { id: 'nobody', enabled: true, phoneE164: P1 }, // unknown id
      { id: 'mor', enabled: true },                    // bad shape (no phoneE164)
      { id: 'leo', enabled: true, phoneE164: 'xx' },   // enabled without a valid number
    ])
    const p = previewImportContacts(json, current)
    expect(p.invalid.length).toBe(3)
    expect(p.toSave.length).toBe(0)
    expect(p.invalid[0]!.reason).toContain('לא נתמך')
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
})
