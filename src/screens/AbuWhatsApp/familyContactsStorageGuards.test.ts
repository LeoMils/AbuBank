/*
 * familyContactsStorageGuards.test.ts — focused restore of the two coverage gaps
 * left when familyContactsStorage.test.ts was deleted from the working tree.
 *
 * These two blocks had NO living equivalent among the surviving sibling tests:
 *   • isLocalFamilyContactShape — the untrusted-data shape guard used at every
 *     import/parse boundary (parsed.filter(isLocalFamilyContactShape)) before a
 *     contact is written to storage. A regression that loosened it would let
 *     malformed contact/phone data into localStorage silently.
 *   • maskPhonePreview "no cleartext leak" — proves the masked preview never
 *     echoes the full phone number (privacy boundary for phone data).
 *
 * The remaining cases from the deleted file are already covered by
 * contactManagement / cloneMigration / contactsImportRecovery and are NOT
 * duplicated here.
 */
import { describe, it, expect } from 'vitest'
import { isLocalFamilyContactShape, maskPhonePreview } from './familyContactsStorage'

// Single synthetic placeholder. Real numbers must never appear in source.
const TEST_FAKE_PHONE = '+972501234567'

describe('isLocalFamilyContactShape (untrusted-data shape guard)', () => {
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

describe('maskPhonePreview (privacy — no cleartext leak)', () => {
  it('mask never echoes the full number in cleartext', () => {
    const fullDigits = TEST_FAKE_PHONE.replace(/\D/g, '')
    const masked = maskPhonePreview(TEST_FAKE_PHONE)
    expect(masked.includes(fullDigits)).toBe(false)
  })
})
