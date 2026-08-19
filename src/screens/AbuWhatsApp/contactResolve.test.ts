import { describe, it, expect } from 'vitest'
import {
  buildWhatsAppPersonUrl,
  resolveContactForName,
  resolveContactCandidates,
  isRecipientAmbiguous,
} from './familyQuickFaces'
import type { FamilyQuickFace } from './familyContacts.private'
import type { LocalFamilyContact } from './familyContactsStorage'

const adarFace: Extract<FamilyQuickFace, { type: 'person' }> = {
  type: 'person', id: 'adar', displayName: 'אדר', phoneE164: '+972501234567', enabled: true,
}
const localAdar: LocalFamilyContact[] = [{ id: 'adar', enabled: true, phoneE164: '+972501234567' }]

// ════════════════════════════════════════════════════════════════════════════
// WhatsAppChannelAdapter — deep link (prefill only, exact text)
// ════════════════════════════════════════════════════════════════════════════
describe('buildWhatsAppPersonUrl — prefilled text, no auto-send', () => {
  it('is byte-identical to the phone-only contract when no text is given', () => {
    expect(buildWhatsAppPersonUrl(adarFace)).toBe('https://wa.me/972501234567')
  })
  it('appends a URL-encoded ?text= and round-trips the exact reviewed text', () => {
    const text = 'אדר מגיע ב-8:30!! תראה https://a.co & גם ?\nשורה שנייה 🎉'
    const url = buildWhatsAppPersonUrl(adarFace, text)
    expect(url.startsWith('https://wa.me/972501234567?text=')).toBe(true)
    const decoded = decodeURIComponent(url.split('?text=')[1]!)
    expect(decoded).toBe(text) // byte-for-byte after decode (Hebrew, &, ?, emoji, newline)
    expect(url).not.toContain(' ') // spaces encoded, not raw
  })
  it('ignores empty/whitespace text (keeps the plain URL)', () => {
    expect(buildWhatsAppPersonUrl(adarFace, '   ')).toBe('https://wa.me/972501234567')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// RecipientEntityResolver — exact, alias, prefix, fuzzy, ambiguity, none
// ════════════════════════════════════════════════════════════════════════════
describe('resolveContactCandidates', () => {
  it('resolves an exact Hebrew name (confidence 1)', () => {
    const c = resolveContactCandidates('אדר', localAdar)
    expect(c[0]?.face.id).toBe('adar')
    expect(c[0]?.confidence).toBe(1)
    expect(c[0]?.actionable).toBe(true)
  })
  it('resolves a prefixed token ("לאדר")', () => {
    expect(resolveContactCandidates('לאדר', localAdar)[0]?.face.id).toBe('adar')
  })
  it('resolves an alias ("מורי" → מור)', () => {
    expect(resolveContactCandidates('מורי', [])[0]?.face.id).toBe('mor')
  })
  it('tolerates an STT misspelling within edit-distance 1', () => {
    // "אדד" is one substitution from "אדר" → fuzzy match to Adar.
    const c = resolveContactCandidates('אדד', [])
    expect(c[0]?.face.id).toBe('adar')
    expect(c[0]?.evidence).toBe('fuzzy')
  })
  it('returns empty for an unknown name', () => {
    expect(resolveContactCandidates('אלכסנדרה', [])).toHaveLength(0)
    expect(resolveContactCandidates('', [])).toHaveLength(0)
  })
})

describe('isRecipientAmbiguous — never silently guess', () => {
  it('a single exact match is NOT ambiguous', () => {
    expect(isRecipientAmbiguous(resolveContactCandidates('אדר', []))).toBe(false)
  })
  it('a fuzzy-only / low-confidence match IS ambiguous (asks the user)', () => {
    const c = resolveContactCandidates('אדד', [])
    expect(isRecipientAmbiguous(c)).toBe(true)
  })
  it('no candidates is treated as "no match", not ambiguous', () => {
    expect(isRecipientAmbiguous(resolveContactCandidates('אלכסנדרה', []))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// resolveContactForName (confident single result) + no-phone actionability
// ════════════════════════════════════════════════════════════════════════════
describe('resolveContactForName', () => {
  it('returns the confident top match with actionability', () => {
    const r = resolveContactForName('אדר', localAdar)
    expect(r?.face.id).toBe('adar')
    expect(r?.actionable).toBe(true)
  })
  it('marks a contact with no configured phone as not actionable', () => {
    const r = resolveContactForName('אדר', [])
    expect(r).not.toBeNull()
    expect(r!.actionable).toBe(false)
  })
  it('returns null for an ambiguous/fuzzy match (caller must prompt)', () => {
    expect(resolveContactForName('אדד', [])).toBeNull()
  })
  it('returns null for an unknown name', () => {
    expect(resolveContactForName('אלכסנדרה', [])).toBeNull()
  })
})
