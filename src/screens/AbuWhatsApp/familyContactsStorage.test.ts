import { describe, it, expect } from 'vitest'
import {
  LOCAL_FAMILY_CONTACTS_STORAGE_KEY,
  clearLocalContacts,
  exportContactsJSON,
  getLocalContacts,
  importContactsJSON,
  isLocalFamilyContactShape,
  maskPhonePreview,
  removeLocalContact,
  setLocalContacts,
  upsertLocalContact,
  type LocalFamilyContact,
} from './familyContactsStorage'

// Single synthetic placeholder reused by every storage test in this file.
// Real numbers must never appear in source.
const TEST_FAKE_PHONE = '+972501234567'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.has(key) ? (this.data.get(key) as string) : null }
  setItem(key: string, value: string): void { this.data.set(key, String(value)) }
  removeItem(key: string): void { this.data.delete(key) }
}

describe('LOCAL_FAMILY_CONTACTS_STORAGE_KEY', () => {
  it('is versioned with v1', () => {
    expect(LOCAL_FAMILY_CONTACTS_STORAGE_KEY).toBe('abubank.familyContacts.v1')
  })
})

describe('isLocalFamilyContactShape', () => {
  it('rejects null/undefined/non-object', () => {
    expect(isLocalFamilyContactShape(null)).toBe(false)
    expect(isLocalFamilyContactShape(undefined)).toBe(false)
    expect(isLocalFamilyContactShape('x')).toBe(false)
    expect(isLocalFamilyContactShape(42)).toBe(false)
  })
  it('rejects missing or empty id', () => {
    expect(isLocalFamilyContactShape({ enabled: true, phoneE164: '' })).toBe(false)
    expect(isLocalFamilyContactShape({ id: '', enabled: true, phoneE164: '' })).toBe(false)
  })
  it('rejects non-boolean enabled', () => {
    expect(isLocalFamilyContactShape({ id: 'mor', enabled: 'yes' as unknown, phoneE164: '' })).toBe(false)
  })
  it('rejects non-string phoneE164', () => {
    expect(isLocalFamilyContactShape({ id: 'mor', enabled: true, phoneE164: 123 as unknown })).toBe(false)
  })
  it('accepts a minimal valid shape', () => {
    expect(isLocalFamilyContactShape({ id: 'mor', enabled: false, phoneE164: '' })).toBe(true)
  })
})

describe('getLocalContacts / setLocalContacts / clearLocalContacts', () => {
  it('returns [] when storage is empty', () => {
    const s = new MemoryStorage()
    expect(getLocalContacts(s)).toEqual([])
  })
  it('roundtrips a contact through set then get', () => {
    const s = new MemoryStorage()
    const inp: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    setLocalContacts(inp, s)
    const out = getLocalContacts(s)
    expect(out.length).toBe(1)
    expect(out[0]?.id).toBe('mor')
    expect(out[0]?.enabled).toBe(true)
  })
  it('clears local contacts', () => {
    const s = new MemoryStorage()
    setLocalContacts([{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }], s)
    expect(getLocalContacts(s).length).toBe(1)
    clearLocalContacts(s)
    expect(getLocalContacts(s)).toEqual([])
  })
  it('returns [] when stored value is invalid JSON', () => {
    const s = new MemoryStorage()
    s.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, 'not-json{')
    expect(getLocalContacts(s)).toEqual([])
  })
  it('filters out malformed entries on read', () => {
    const s = new MemoryStorage()
    s.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, JSON.stringify([
      { id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE },
      { id: '' },
      'string-not-object',
      null,
    ]))
    const out = getLocalContacts(s)
    expect(out.length).toBe(1)
    expect(out[0]?.id).toBe('mor')
  })
})

describe('importContactsJSON', () => {
  it('rejects invalid JSON', () => {
    const r = importContactsJSON('this is not json')
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => /JSON parse/.test(e))).toBe(true)
  })
  it('rejects non-array root', () => {
    const r = importContactsJSON('{"id":"mor"}')
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => /array/.test(e))).toBe(true)
  })
  it('rejects items with invalid shape', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 42 }]))
    expect(r.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
  })
  it('rejects items whose enabled phoneE164 fails E.164 validation', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: 'not-a-number' }]))
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => /E\.164/.test(e))).toBe(true)
  })
  it('rejects items whose whatsappE164 fails E.164 validation', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE, whatsappE164: 'oops' }]))
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => /whatsappE164/.test(e))).toBe(true)
  })
  it('rejects duplicate ids', () => {
    const r = importContactsJSON(JSON.stringify([
      { id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE },
      { id: 'mor', enabled: false, phoneE164: '' },
    ]))
    expect(r.ok).toBe(false)
    expect(r.errors.some(e => /duplicate/i.test(e))).toBe(true)
  })
  it('accepts a single valid enabled contact', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]))
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.contacts.length).toBe(1)
    expect(r.contacts[0]?.id).toBe('mor')
  })
  it('accepts a disabled contact with empty phone', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'mor', enabled: false, phoneE164: '' }]))
    expect(r.ok).toBe(true)
    expect(r.contacts.length).toBe(1)
  })
})

describe('exportContactsJSON', () => {
  it('produces JSON parseable back into the same shape', () => {
    const inp: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    const json = exportContactsJSON(inp)
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]?.id).toBe('mor')
    expect(parsed[0]?.enabled).toBe(true)
  })
  it('produces [] for empty input', () => {
    expect(exportContactsJSON([])).toBe('[]')
  })
})

describe('maskPhonePreview', () => {
  it('returns Hebrew empty marker for empty input', () => {
    expect(maskPhonePreview('')).toBe('(ריק)')
    expect(maskPhonePreview(undefined)).toBe('(ריק)')
  })
  it('keeps only the first 3 digits visible and masks the rest with asterisks', () => {
    const masked = maskPhonePreview(TEST_FAKE_PHONE)
    // Starts with +<3 digits>, then asterisks for the remaining digits.
    expect(/^\+\d{3}\*+$/.test(masked)).toBe(true)
    // Mask must NOT contain any digit beyond the first 3.
    const digitsInMask = masked.replace(/\D/g, '')
    expect(digitsInMask.length).toBe(3)
  })
  it('mask never echoes the full number in cleartext', () => {
    const fullDigits = TEST_FAKE_PHONE.replace(/\D/g, '')
    const masked = maskPhonePreview(TEST_FAKE_PHONE)
    expect(masked.includes(fullDigits)).toBe(false)
  })
})

describe('upsertLocalContact (per-contact save)', () => {
  it('saves a single enabled contact when phone is valid E.164', () => {
    const s = new MemoryStorage()
    const r = upsertLocalContact({ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    const out = getLocalContacts(s)
    expect(out.length).toBe(1)
    expect(out[0]?.id).toBe('mor')
    expect(out[0]?.enabled).toBe(true)
  })

  it('rejects an enabled contact whose phone fails E.164 validation', () => {
    const s = new MemoryStorage()
    const r = upsertLocalContact({ id: 'mor', enabled: true, phoneE164: 'not-a-number' }, s)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /E\.164/.test(e))).toBe(true)
    expect(getLocalContacts(s)).toEqual([])
  })

  it('accepts a disabled contact with empty phone (operator can stage a row)', () => {
    const s = new MemoryStorage()
    const r = upsertLocalContact({ id: 'mor', enabled: false, phoneE164: '' }, s)
    expect(r.ok).toBe(true)
    expect(getLocalContacts(s).length).toBe(1)
  })

  it('replaces an existing entry by id (upsert semantics)', () => {
    const s = new MemoryStorage()
    upsertLocalContact({ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    upsertLocalContact({ id: 'mor', enabled: false, phoneE164: '' }, s)
    const out = getLocalContacts(s)
    expect(out.length).toBe(1)
    expect(out[0]?.enabled).toBe(false)
    expect(out[0]?.phoneE164).toBe('')
  })

  it('does not affect other contacts when saving one', () => {
    const s = new MemoryStorage()
    upsertLocalContact({ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    upsertLocalContact({ id: 'leo', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    const ids = getLocalContacts(s).map((c) => c.id).sort()
    expect(ids).toEqual(['leo', 'mor'])
  })
})

describe('removeLocalContact (per-contact clear)', () => {
  it('removes only the matching id, leaving others intact', () => {
    const s = new MemoryStorage()
    upsertLocalContact({ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    upsertLocalContact({ id: 'leo', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    removeLocalContact('mor', s)
    const ids = getLocalContacts(s).map((c) => c.id)
    expect(ids).toEqual(['leo'])
  })

  it('is a no-op when the id is missing', () => {
    const s = new MemoryStorage()
    upsertLocalContact({ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }, s)
    removeLocalContact('does-not-exist', s)
    expect(getLocalContacts(s).length).toBe(1)
  })
})

describe('FamilyContactsSetup operator UI (source contract)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const PROJECT_ROOT = path.resolve(__dirname, '../../..')
  const setupSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx'), 'utf8')

  it('renders per-contact rows with phone input + enabled toggle + save + clear', () => {
    expect(setupSrc.includes("data-testid={`setup-row-${person.id}`}")).toBe(true)
    expect(setupSrc.includes("data-testid={`setup-phone-${person.id}`}")).toBe(true)
    expect(setupSrc.includes("data-testid={`setup-enabled-${person.id}`}")).toBe(true)
    expect(setupSrc.includes("data-testid={`setup-save-${person.id}`}")).toBe(true)
    expect(setupSrc.includes("data-testid={`setup-clear-${person.id}`}")).toBe(true)
  })

  it('uses upsertLocalContact and removeLocalContact for per-contact save/clear', () => {
    expect(setupSrc.includes('upsertLocalContact')).toBe(true)
    expect(setupSrc.includes('removeLocalContact')).toBe(true)
  })

  it('keeps JSON UI under a collapsed <details> "מתקדם" section', () => {
    expect(setupSrc.includes('<details')).toBe(true)
    expect(setupSrc.includes('מתקדם')).toBe(true)
    expect(setupSrc.includes('setup-adv-import')).toBe(true)
    expect(setupSrc.includes('setup-adv-export')).toBe(true)
  })

  it('renders the build version label v0.3.1-abuwhatsapp-bubbles', () => {
    expect(setupSrc.includes('setup-build-version')).toBe(true)
    expect(setupSrc.includes('APP_VERSION.version')).toBe(true)
  })
})
