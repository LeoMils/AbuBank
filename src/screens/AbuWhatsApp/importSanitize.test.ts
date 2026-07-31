import { describe, it, expect } from 'vitest'
import { importContactsJSON, sanitizeImportText, describeImportText, analyzeParseError, sha256Hex } from './familyContactsStorage'

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

// ─── Deep instrumentation — locate a structural error the user cannot see ────
// When raw length === clean length and JSON.parse still fails, the fault is in
// the real content. The debug panel must point the operator at the exact spot.
describe('describeImportText — structural error localization (offset + context)', () => {
  // Missing comma BETWEEN two properties → V8: "Expected ',' or '}' after
  // property value in JSON at position N". This is the "Expected '}'" family
  // the operator reported, with valid-looking first/last 100.
  const MISSING_COMMA = '[{ "id": "mor" "enabled": true, "phoneE164": "+972500000001" }]'

  it('reports the exact offset and the text on both sides of it', () => {
    const d = describeImportText(MISSING_COMMA)
    expect(d.identicalToRaw).toBe(true)          // nothing invisible — real content bug
    expect(d.parseError).toBeTruthy()
    expect(d.parseErrorOffset).not.toBeNull()
    // The parser chokes at the second property token; context must straddle it.
    expect(d.contextBefore + d.contextAfter).toContain('"enabled"')
    expect(d.charAtOffset).not.toBe('')
    // The reported offset indexes the actual character shown.
    if (d.parseErrorOffset !== null) {
      expect(MISSING_COMMA[d.parseErrorOffset]).toBeTypeOf('string')
    }
  })

  it('marks clean, valid JSON as identical with no offset', () => {
    const d = describeImportText(CLEAN)
    expect(d.identicalToRaw).toBe(true)
    expect(d.parseError).toBeNull()
    expect(d.parseErrorOffset).toBeNull()
    expect(d.contextBefore).toBe('')
    expect(d.contextAfter).toBe('')
  })
})

describe('analyzeParseError — parse V8 position/line/column', () => {
  it('extracts offset, line, and column when present', () => {
    const r = analyzeParseError("Expected ',' or '}' after property value in JSON at position 47 (line 3 column 5)")
    expect(r.offset).toBe(47)
    expect(r.line).toBe(3)
    expect(r.column).toBe(5)
  })
  it('extracts a bare position with no line/column', () => {
    const r = analyzeParseError('Unexpected token x in JSON at position 12')
    expect(r.offset).toBe(12)
    expect(r.line).toBeNull()
  })
  it('returns nulls for an unrecognized message', () => {
    expect(analyzeParseError('totally unknown').offset).toBeNull()
  })
})

describe('sha256Hex — byte-for-byte fingerprint of the exact paste', () => {
  it('matches the known SHA-256 of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
  it('differs when a single invisible char is present', async () => {
    const a = await sha256Hex(CLEAN)
    const b = await sha256Hex('﻿' + CLEAN) // a BOM the operator cannot see
    expect(a).not.toBe(b)
  })
})
