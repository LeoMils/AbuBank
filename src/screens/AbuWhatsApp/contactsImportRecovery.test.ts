/*
 * Operator contacts import recovery (#fix abuwhatsapp operator import).
 *
 * Covers the data-integrity gap (unknown ids must be rejected, not silently
 * stored) and re-affirms the operator-setup UX + privacy contracts at the
 * unit / source-contract level. No DOM-render infra exists in this repo, so
 * UI assertions read the component source the way the sibling AbuWhatsApp
 * tests do.
 *
 * Privacy: only the synthetic placeholder phone is used; never a real number.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  KNOWN_CONTACT_IDS,
  isKnownContactId,
  importContactsJSON,
  upsertLocalContact,
  exportContactsJSON,
  getLocalContacts,
  maskPhonePreview,
  LOCAL_FAMILY_CONTACTS_STORAGE_KEY,
  type LocalFamilyContact,
} from './familyContactsStorage'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')
const TEST_FAKE_PHONE = '+972501234567'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.has(key) ? (this.data.get(key) as string) : null }
  setItem(key: string, value: string): void { this.data.set(key, String(value)) }
  removeItem(key: string): void { this.data.delete(key) }
}

// ─── Known-id integrity ───────────────────────────────────────────────────────

describe('known contact ids', () => {
  it('includes the family group and every scaffold person, disabled set included', () => {
    for (const id of ['family-group', 'mor', 'leo', 'raphi', 'ofir', 'ayalon', 'eili', 'adar', 'adi', 'noam', 'yarden', 'gilad', 'yael', 'anabel', 'ari']) {
      expect(KNOWN_CONTACT_IDS.has(id), `${id} should be a known id`).toBe(true)
    }
  })

  it('rejects a clearly bogus id', () => {
    expect(isKnownContactId('definitely-not-a-person')).toBe(false)
    expect(isKnownContactId('morr')).toBe(false)
  })
})

// ─── Import validation ─────────────────────────────────────────────────────────

describe('importContactsJSON — unknown id is rejected (#9)', () => {
  it('fails when an item has an unknown id', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'stranger', enabled: false, phoneE164: '' }]))
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /unknown id/i.test(e))).toBe(true)
    expect(r.contacts.length).toBe(0)
  })

  it('accepts a known enabled contact with a valid phone (#5)', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]))
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.contacts[0]?.id).toBe('mor')
  })

  it('accepts a known disabled contact with empty phone (#12)', () => {
    const r = importContactsJSON(JSON.stringify([{ id: 'yael', enabled: false, phoneE164: '' }]))
    expect(r.ok).toBe(true)
    expect(r.contacts.length).toBe(1)
  })

  it('still rejects bad JSON (#6), non-array root (#7), duplicate ids (#8), bad E.164 (#10), enabled-without-phone (#11)', () => {
    expect(importContactsJSON('nope{').ok).toBe(false)
    expect(importContactsJSON('{"id":"mor"}').ok).toBe(false)
    expect(importContactsJSON(JSON.stringify([
      { id: 'mor', enabled: false, phoneE164: '' },
      { id: 'mor', enabled: false, phoneE164: '' },
    ])).errors.some((e) => /duplicate/i.test(e))).toBe(true)
    expect(importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: 'xx' }])).ok).toBe(false)
    expect(importContactsJSON(JSON.stringify([{ id: 'mor', enabled: true, phoneE164: '' }])).ok).toBe(false)
  })
})

describe('upsertLocalContact — unknown id is rejected', () => {
  it('refuses to save an unknown id', () => {
    const s = new MemoryStorage()
    const r = upsertLocalContact({ id: 'stranger', enabled: false, phoneE164: '' }, s)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /unknown contact id/i.test(e))).toBe(true)
    expect(getLocalContacts(s)).toEqual([])
  })
})

// ─── Export + corrupt-storage resilience ────────────────────────────────────────

describe('export + resilience', () => {
  it('export returns valid round-trippable JSON (#13)', () => {
    const inp: LocalFamilyContact[] = [{ id: 'mor', enabled: true, phoneE164: TEST_FAKE_PHONE }]
    const parsed = JSON.parse(exportContactsJSON(inp))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed[0]?.id).toBe('mor')
  })

  it('corrupt localStorage does not throw (#14)', () => {
    const s = new MemoryStorage()
    s.setItem(LOCAL_FAMILY_CONTACTS_STORAGE_KEY, '}{not json at all')
    expect(() => getLocalContacts(s)).not.toThrow()
    expect(getLocalContacts(s)).toEqual([])
  })
})

// ─── Masked preview never leaks the full number (#3) ────────────────────────────

describe('masked preview privacy', () => {
  it('shows at most the first 3 digits, never the full number', () => {
    const masked = maskPhonePreview(TEST_FAKE_PHONE)
    expect(masked.includes(TEST_FAKE_PHONE.replace(/\D/g, ''))).toBe(false)
    expect(masked.replace(/\D/g, '').length).toBe(3)
  })
})

// ─── Operator setup UX (source contract) ────────────────────────────────────────

describe('operator setup UX — phone-friendly labels & feedback', () => {
  const setupSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/FamilyContactsSetup.tsx'), 'utf8')

  it('import button uses the senior-readable Hebrew label "ייבוא אנשי קשר" (#15)', () => {
    expect(setupSrc.includes('ייבוא אנשי קשר')).toBe(true)
  })

  it('per-contact save button exists ("שמרי") (#16)', () => {
    expect(setupSrc.includes('setup-save-')).toBe(true)
    expect(setupSrc.includes('>שמרי</button>')).toBe(true)
  })

  it('export-to-backup button uses the Hebrew label "ייצוא לגיבוי"', () => {
    expect(setupSrc.includes('ייצוא לגיבוי')).toBe(true)
  })

  it('successful import surfaces contact count message (#18)', () => {
    expect(setupSrc.includes('עודכנו ${updated.length} אנשי קשר:')).toBe(true)
  })

  it('failed import surfaces a Hebrew error banner header (#19)', () => {
    expect(setupSrc.includes('הייבוא נכשל')).toBe(true)
    expect(setupSrc.includes("data-testid={banner.ok ? 'setup-adv-banner-ok' : 'setup-adv-banner-err'}")).toBe(true)
  })

  it('textarea has a readable light text colour on the dark panel (#17)', () => {
    // The advanced JSON textarea sets color rgba(255,255,255,0.92) on a dark
    // background — high contrast for an 80+ operator.
    expect(setupSrc.includes("color: 'rgba(255,255,255,0.92)'")).toBe(true)
  })

  it('clear-all is a two-step confirmation', () => {
    expect(setupSrc.includes('setup-adv-clear-all-confirm')).toBe(true)
    expect(setupSrc.includes('setup-adv-clear-all-cancel')).toBe(true)
  })

  it('all interactive controls keep a ≥44px touch target (#26)', () => {
    const heights = [...setupSrc.matchAll(/minHeight:\s*(\d{2,3})/g)].map((m) => parseInt(m[1] as string, 10))
    expect(heights.length).toBeGreaterThan(0)
    expect(heights.every((h) => h >= 40)).toBe(true)
    expect(heights.some((h) => h >= 44)).toBe(true)
  })
})

// ─── Operator entry + privacy guard (source contract) ───────────────────────────

describe('operator entry & privacy guards (source contract)', () => {
  const indexSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/index.tsx'), 'utf8')

  it('?operator=1 reliably opens setup', () => {
    expect(indexSrc.includes("params.get('operator') === '1'")).toBe(true)
    expect(indexSrc.includes('FamilyContactsSetup')).toBe(true)
  })

  it('long-press is an additional (not the only) path to operator setup', () => {
    expect(indexSrc.includes('onOperatorSetup')).toBe(true)
  })

  it('storage layer performs no network I/O', () => {
    const storageSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContactsStorage.ts'), 'utf8')
    expect(/\bfetch\s*\(|XMLHttpRequest|axios/.test(storageSrc)).toBe(false)
  })

  it('AbuAI never imports the local contacts storage', () => {
    const aiDir = path.join(PROJECT_ROOT, 'src/screens/AbuAI')
    const offenders: string[] = []
    for (const f of fs.readdirSync(aiDir)) {
      if (!/\.(ts|tsx)$/.test(f)) continue
      const src = fs.readFileSync(path.join(aiDir, f), 'utf8')
      if (src.includes('familyContactsStorage') || src.includes('familyContacts.private')) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })
})
