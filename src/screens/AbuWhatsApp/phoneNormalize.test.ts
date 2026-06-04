/*
 * Phone normalization + import validation tests.
 * Proves Israeli local numbers are normalized, import works,
 * and no real phone numbers exist in committed source.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { normalizeIsraeliPhone, isValidPhoneE164 } from './familyQuickFaces'
import { importContactsJSON, upsertLocalContact, getLocalContacts, clearLocalContacts } from './familyContactsStorage'

import { beforeEach } from 'vitest'

// In-memory localStorage mock — must be on both globalThis and window
const mockStore = new Map<string, string>()
const mockStorage = {
  getItem: (k: string) => mockStore.get(k) ?? null,
  setItem: (k: string, v: string) => { mockStore.set(k, String(v)) },
  removeItem: (k: string) => { mockStore.delete(k) },
  clear: () => { mockStore.clear() },
  key: (i: number) => Array.from(mockStore.keys())[i] ?? null,
  get length() { return mockStore.size },
} as Storage

if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage
}
// Vitest uses jsdom-like environment; ensure window.localStorage exists
try { if (typeof window !== 'undefined' && !window.localStorage) Object.defineProperty(window, 'localStorage', { value: mockStorage }) } catch {}

beforeEach(() => {
  mockStore.clear()
})

describe('normalizeIsraeliPhone', () => {
  it('"0541111111" → "+972541111111"', () => {
    expect(normalizeIsraeliPhone('0541111111')).toBe('+972541111111')
  })

  it('"054-111-1111" → "+972541111111" (strips dashes)', () => {
    expect(normalizeIsraeliPhone('054-111-1111')).toBe('+972541111111')
  })

  it('"+972541111111" → "+972541111111" (already E.164)', () => {
    expect(normalizeIsraeliPhone('+972541111111')).toBe('+972541111111')
  })

  it('"0502222222" → "+972502222222"', () => {
    expect(normalizeIsraeliPhone('0502222222')).toBe('+972502222222')
  })

  it('empty string → empty string', () => {
    expect(normalizeIsraeliPhone('')).toBe('')
  })

  it('non-Israeli number passes through', () => {
    expect(normalizeIsraeliPhone('+1555')).toBe('+1555')
  })
})

describe('import JSON with Israeli local numbers', () => {
  it('import normalizes local Israeli phones to E.164', () => {
    const json = JSON.stringify([
      { id: 'yael', enabled: true, phoneE164: '0541111111' },
    ])
    const result = importContactsJSON(json)
    expect(result.ok).toBe(true)
    expect(result.contacts[0]!.phoneE164).toBe('+972541111111')
  })

  it('import accepts already-E.164 phones', () => {
    const json = JSON.stringify([
      { id: 'mor', enabled: true, phoneE164: '+972501234567' },
    ])
    const result = importContactsJSON(json)
    expect(result.ok).toBe(true)
    expect(result.contacts[0]!.phoneE164).toBe('+972501234567')
  })

  it('import rejects invalid phone for enabled contact', () => {
    const json = JSON.stringify([
      { id: 'mor', enabled: true, phoneE164: '123' },
    ])
    const result = importContactsJSON(json)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('import allows empty phone for disabled contact', () => {
    const json = JSON.stringify([
      { id: 'ari', enabled: false, phoneE164: '' },
    ])
    const result = importContactsJSON(json)
    expect(result.ok).toBe(true)
  })

  it('Yael can be imported with her phone', () => {
    const json = JSON.stringify([
      { id: 'yael', enabled: true, phoneE164: '0541111111' },
    ])
    const result = importContactsJSON(json)
    expect(result.ok).toBe(true)
    expect(result.contacts[0]!.id).toBe('yael')
    expect(result.contacts[0]!.phoneE164).toBe('+972541111111')
  })
})

describe('upsertLocalContact normalizes phones', () => {
  it('local Israeli phone is normalized on upsert', () => {
    const result = upsertLocalContact({ id: 'yael', enabled: true, phoneE164: '0541111111' }, mockStorage)
    expect(result.ok).toBe(true)
    const saved = getLocalContacts(mockStorage)
    expect(saved.find(c => c.id === 'yael')?.phoneE164).toBe('+972541111111')
  })

  it('existing contacts not wiped by single upsert', () => {
    upsertLocalContact({ id: 'mor', enabled: true, phoneE164: '+972501234567' }, mockStorage)
    upsertLocalContact({ id: 'yael', enabled: true, phoneE164: '0541111111' }, mockStorage)
    const saved = getLocalContacts(mockStorage)
    expect(saved.length).toBe(2)
    expect(saved.find(c => c.id === 'mor')?.phoneE164).toBe('+972501234567')
    expect(saved.find(c => c.id === 'yael')?.phoneE164).toBe('+972541111111')
  })
})

describe('no real phone numbers in committed source', () => {
  it('familyContacts.private.ts has no real phone numbers', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'familyContacts.private.ts'), 'utf8')
    const phoneMatches = src.match(/phoneE164:\s*'(\+972\d+)'/g)
    expect(phoneMatches).toBeNull()
  })

  it('example template uses dummy numbers only (no real phones)', () => {
    const examplePath = path.resolve(__dirname, '..', '..', '..', 'private', 'family-contacts.example.json')
    if (!fs.existsSync(examplePath)) return // example file is optional
    const parsed = JSON.parse(fs.readFileSync(examplePath, 'utf8')) as Array<{ phoneE164: string }>
    for (const c of parsed) {
      if (c.phoneE164) {
        // All numbers in example must be dummy 05450000XX pattern or empty
        expect(c.phoneE164 === '' || c.phoneE164.startsWith('0545000'),
          `${c.phoneE164} is not a dummy number`).toBe(true)
      }
    }
  })
})
