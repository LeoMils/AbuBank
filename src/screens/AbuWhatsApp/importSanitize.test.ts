import { describe, it, expect } from 'vitest'
import { importContactsJSON, sanitizeImportText, describeImportText } from './familyContactsStorage'

// The DATA is valid; only invisible/typographic artifacts differ (mobile paste).
const SMART = '﻿[{ “id”: “mor”, “enabled”: true, “phoneE164”: “+972500000001” }]'
const BIDI = '[{"id":"mor"‏,"enabled":true,"phoneE164":"+972500000001"‬}]'
const NBSP = '[{"id": "mor", "enabled":true,"phoneE164":"+972500000001"}]'
const CLEAN = '[{"id":"mor","enabled":true,"phoneE164":"+972500000001"}]'

describe('import sanitation — valid JSON with mobile-paste artifacts still imports', () => {
  it('smart quotes + BOM parse and import (data unchanged)', () => {
    const r = importContactsJSON(SMART)
    expect(r.ok, r.errors.join(' | ')).toBe(true)
    expect(r.contacts).toHaveLength(1)
    expect(r.contacts[0]!.id).toBe('mor')
    expect(r.contacts[0]!.phoneE164).toBe('+972500000001') // number untouched
  })
  it('RTL bidi control marks are stripped and it imports', () => {
    expect(importContactsJSON(BIDI).ok).toBe(true)
  })
  it('non-breaking spaces are normalized and it imports', () => {
    expect(importContactsJSON(NBSP).ok).toBe(true)
  })
  it('clean JSON is unaffected', () => {
    expect(importContactsJSON(CLEAN).ok).toBe(true)
  })
})

describe('exact parse error is surfaced (not a generic message)', () => {
  it('a genuinely malformed body returns the real JSON.parse exception', () => {
    const r = importContactsJSON('[{ id: mor }]') // unquoted → real syntax error
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/^JSON parse error: /)
    expect(r.errors[0]).not.toBe('JSON parse error') // must include the reason
  })
})

describe('describeImportText — operator debug diagnostics', () => {
  it('reports length, previews, notes and parse status after cleaning', () => {
    const d = describeImportText(SMART)
    expect(d.rawLength).toBe(SMART.length)
    expect(d.parseError).toBeNull()          // valid after sanitation
    expect(d.notes.length).toBeGreaterThan(0) // reported what was fixed (BOM/quotes)
    expect(typeof d.first100).toBe('string')
  })
  it('surfaces the exact parse error for malformed input', () => {
    const d = describeImportText('[{ id: mor }]')
    expect(d.parseError).toBeTruthy()
    expect(d.parseError).not.toBe('JSON parse error')
  })
})

describe('sanitizeImportText leaves clean text byte-identical', () => {
  it('no-op on already-clean JSON', () => {
    expect(sanitizeImportText(CLEAN).text).toBe(CLEAN)
    expect(sanitizeImportText(CLEAN).notes).toHaveLength(0)
  })
})
