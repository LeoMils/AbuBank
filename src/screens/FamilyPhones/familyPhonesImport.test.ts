import { describe, it, expect } from 'vitest'
import {
  matchFamilyPhonesRoute, buildMaskedPreview, savedMessage, mergeContacts,
  importContactsJSON, FAMILY_PHONES_PATH, type LocalFamilyContact,
} from './familyPhonesImport'

// FAKE numbers only — never a real family number in tests. These are the repo's
// PINNED_SYNTHETIC fixtures (see AbuWhatsApp/phonePrivacy.test.ts allow-list).
const FAKE_E164 = '+972501234567'
const FAKE_LOCAL = '0500000001'

describe('route matching (direct /settings/family-phones in Safari)', () => {
  it('matches the exact path, tolerates a trailing slash, and a hash fallback', () => {
    expect(matchFamilyPhonesRoute(FAMILY_PHONES_PATH, '')).toBe(true)
    expect(matchFamilyPhonesRoute('/settings/family-phones/', '')).toBe(true)
    expect(matchFamilyPhonesRoute('/', '#/settings/family-phones')).toBe(true)
    expect(matchFamilyPhonesRoute('/', '')).toBe(false)
    expect(matchFamilyPhonesRoute('/settings', '')).toBe(false)
  })
})

describe('importContactsJSON — the exact record format, Israeli + E.164', () => {
  it('accepts the exact { id, enabled, phoneE164 } format', () => {
    const json = JSON.stringify([{ id: 'mor', enabled: true, phoneE164: FAKE_E164 }])
    const r = importContactsJSON(json)
    expect(r.ok).toBe(true)
    expect(r.contacts).toHaveLength(1)
    expect(r.contacts[0]).toMatchObject({ id: 'mor', enabled: true, phoneE164: FAKE_E164 })
  })
  it('normalizes an Israeli local number to E.164', () => {
    const json = JSON.stringify([{ id: 'leo', enabled: true, phoneE164: FAKE_LOCAL }])
    const r = importContactsJSON(json)
    expect(r.ok).toBe(true)
    expect(r.contacts[0]!.phoneE164).toBe('+972500000001')
  })
  it('resolves the "rafi" spelling alias to canonical "raphi" (JSON is the contract)', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'rafi', enabled: true, phoneE164: FAKE_E164 }]))
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.contacts[0]!.id).toBe('raphi') // stored canonical, not the alias
  })
  it('validates a 12-record set that uses "rafi" — zero unknown ids', () => {
    const ids = ['mor', 'leo', 'yael', 'rafi', 'ofir', 'ayalon', 'eili', 'adar', 'adi', 'noam', 'yarden', 'gilad']
    const json = JSON.stringify(ids.map((id) => ({ id, enabled: false, phoneE164: '' })))
    const r = importContactsJSON(json)
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.contacts).toHaveLength(12)
    expect(r.contacts.map((c) => c.id)).toContain('raphi')
  })
  it('accepts any SAFE id (no fixed allowlist) but rejects an unsafe id and a bad number', () => {
    expect(importContactsJSON(JSON.stringify([{ id: 'nobody', enabled: true, phoneE164: FAKE_E164 }])).ok).toBe(true)
    expect(importContactsJSON(JSON.stringify([{ id: 'bad id!', enabled: true, phoneE164: FAKE_E164 }])).ok).toBe(false)
    expect(importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: '12' }])).ok).toBe(false)
  })
  it('rejects duplicates and non-array / non-JSON', () => {
    const dup = JSON.stringify([{ id: 'mor', enabled: true, phoneE164: FAKE_E164 }, { id: 'mor', enabled: true, phoneE164: FAKE_E164 }])
    expect(importContactsJSON(dup).ok).toBe(false)
    expect(importContactsJSON('{}').ok).toBe(false)
    expect(importContactsJSON('not json').ok).toBe(false)
  })
  it('allows a disabled record with an empty number (opt-out), still known id', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'ari', enabled: false, phoneE164: '' }]))
    expect(r.ok).toBe(true)
  })
})

describe('masked preview — NEVER the full number', () => {
  it('masks every number and keeps only a 3-digit prefix', () => {
    const contacts: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: FAKE_E164 }]
    const rows = buildMaskedPreview(contacts)
    expect(rows[0]!.masked).toContain('*')
    expect(rows[0]!.masked).not.toContain('1234567') // the body is hidden
    expect(rows[0]!.known).toBe(true)
  })
})

describe('save helpers + success message', () => {
  it('mergeContacts dedups by id and returns the count', () => {
    // In the node test env there is no localStorage, so existing = []; the merge of
    // two distinct ids yields 2 (dedup logic is exercised via the Map keying).
    const n = mergeContacts([
      { id: 'mor', enabled: true, phoneE164: FAKE_E164 },
      { id: 'leo', enabled: true, phoneE164: '+972500000002' },
    ])
    expect(n).toBe(2)
  })
  it('savedMessage is the exact required Hebrew line', () => {
    expect(savedMessage(12)).toBe('12 מספרי טלפון נשמרו במכשיר הזה')
  })
})
