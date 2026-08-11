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

  // ── device defect 3: a descriptive phrase anchored on a NAMED person never guesses ──
  it('"הבת של רפי" resolves against RAFI (not Martita, not his in-law) or is not_found', () => {
    const r = resolveContactTarget('הבת של רפי')
    if (r.status === 'resolved') {
      expect(r.id).not.toBe('mor')     // the old bug: fell back to Martita's daughter
      expect(r.id).not.toBe('yarden')  // ירדן is his כלה (daughter-in-law), NOT his daughter
      const rr = relativesByKind('רפי', 'child')
      const rafiChildren = rr.status === 'ok' ? rr.people : []
      expect(rafiChildren).toContain(r.label) // must be an ACTUAL child of Rafi
    } else {
      expect(r.status).toBe('not_found') // Rafi has no daughter in the graph → honest miss
    }
  })
  it('"הבת של רפי" is NEVER Rafi\'s former spouse (the reported wrong answer)', () => {
    const r = resolveContactTarget('הבת של רפי')
    // relationshipBetween proves ירדן is only his כלה; whatever resolves must be his child.
    if (r.status === 'resolved') {
      const rel = relationshipBetween(r.label, 'רפי')
      expect(rel).toEqual({ status: 'ok', text: `${r.label} בת של רפי` })
    }
  })
  it('a descriptive phrase with an UNKNOWN named anchor is not_found, never a guess', () => {
    expect(resolveContactTarget('הבת של גברת כהן מהמכולת')).toEqual({ status: 'not_found' })
  })
  it('whoIs on a descriptive phrase with an unknown anchor is not_found', () => {
    expect(whoIs('הבן של גברת כהן מהמכולת')).toEqual({ status: 'not_found' })
  })
  it('a real person named like a kinship word (דוד/David) stays the person, not "my uncle"', () => {
    // Direct-name match must win over descriptive parsing for a kinship-homograph name.
    const r = resolveContactTarget('דוד')
    if (r.status === 'resolved') expect(r.label).toBe('דוד')
  })

  // ── device defect 6: reaching a DECEASED person is never a callable contact ──
  it('"פפי" (deceased) is NEVER a reachable contact — status deceased, no id to call', () => {
    const r = resolveContactTarget('פפי')
    expect(r.status).toBe('deceased')
    expect(JSON.stringify(r)).not.toContain('"id"') // no contact id handed out to call/message
  })
  it('but פפי is STILL knowable — whoIs describes him (remembering is not reaching)', () => {
    expect(whoIs('פפי')).toMatchObject({ status: 'ok', name: 'פפי' })
  })
})
