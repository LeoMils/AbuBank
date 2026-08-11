/*
 * peopleLookup.test.ts — the one people tool (CODE/TEST). Numbers never appear.
 */
import { describe, it, expect } from 'vitest'
import { whoIs, relationshipBetween, relativesByKind, resolveContactTarget } from './peopleLookup'

describe('who is X', () => {
  it('names a person and how they relate to Martita (aliases resolve)', () => {
    expect(whoIs('לאו')).toMatchObject({ status: 'ok', name: 'לאו', gender: 'male', relationToMartita: 'בן של מרטיטה' })
    expect(whoIs('הדר')).toMatchObject({ status: 'ok', name: 'אדר' }) // alias → one person
  })
  it('unknown person → not_found, never guessed', () => {
    expect(whoIs('גברת כהן מהמכולת')).toEqual({ status: 'not_found' })
  })
})

describe('relationship between X and Y (derived Hebrew)', () => {
  it('the named failures read correctly', () => {
    expect(relationshipBetween('גלעד', 'עילי')).toEqual({ status: 'ok', text: 'גלעד גיס של עילי' })
    expect(relationshipBetween('ירדן', 'רפי')).toEqual({ status: 'ok', text: 'ירדן כלה של רפי' })
    expect(relationshipBetween('לאו', 'אופיר')).toEqual({ status: 'ok', text: 'לאו דוד של אופיר' })
  })
  it('unrelated people → honest unrelated', () => {
    expect(relationshipBetween('מירטה', 'אופיר')).toEqual({ status: 'unrelated' })
  })
})

describe('X\'s relatives of a kind', () => {
  it('Martita\'s grandchildren = six', () => {
    const r = relativesByKind('מרטיטה', 'grandchild')
    expect(r.status).toBe('ok')
    if (r.status === 'ok') expect(r.people).toHaveLength(6)
  })
})

describe('contact by name OR by relationship (id/label only — never a number)', () => {
  it('a direct name resolves', () => {
    expect(resolveContactTarget('מור')).toEqual({ status: 'resolved', id: 'mor', label: 'מור' })
  })
  it('"הבת שלי" resolves relationship → the one daughter (Mor) in a single turn', () => {
    expect(resolveContactTarget('הבת שלי')).toEqual({ status: 'resolved', id: 'mor', label: 'מור' })
  })
  it('"תתקשרי לנכד שלי" → relationship → people; ambiguous (many grandsons) so Abu asks which', () => {
    const r = resolveContactTarget('הנכד שלי')
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') {
      expect(r.candidates.length).toBeGreaterThan(1)
      // the label is a person, and there is NO phone number anywhere in the result
      expect(JSON.stringify(r)).not.toMatch(/\+?\d{7,}/)
    }
  })
  it('an unknown target → not_found', () => {
    expect(resolveContactTarget('הטייס שלי')).toEqual({ status: 'not_found' })
  })
})
