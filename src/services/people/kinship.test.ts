/*
 * kinship.test.ts — derived Hebrew kinship over the ONE people model (CODE/TEST).
 * Proves the three named on-device failures + every derived kinship type + the M3
 * invariants. All derivation, no stored kinship.
 */
import { describe, it, expect } from 'vitest'
import { loadPeople, resolvePersonId, personById } from './peopleModel'
import { relationshipOf, relativesOfKind } from './kinship'

const people = loadPeople()
const rel = (x: string, y: string) => relationshipOf(x, y, people)

describe('the three named on-device failures now work', () => {
  it('Leo is the UNCLE (דוד) of Mor\'s children', () => {
    expect(rel('leo', 'ofir')).toMatchObject({ kind: 'uncle_aunt', he: 'דוד' })
    expect(rel('leo', 'eili')).toMatchObject({ kind: 'uncle_aunt', he: 'דוד' })
  })
  it('Gilad is the BROTHER-IN-LAW (גיס) of Eili (Ili)', () => {
    expect(rel('gilad', 'eili')).toMatchObject({ kind: 'sibling_in_law', he: 'גיס' })
  })
  it('Yarden is the DAUGHTER-IN-LAW (כלה) of Rafi', () => {
    expect(rel('yarden', 'raphi')).toMatchObject({ kind: 'child_in_law', he: 'כלה' })
  })
})

describe('every derived kinship type, gendered', () => {
  it('sibling אח/אחות', () => {
    expect(rel('leo', 'mor')).toMatchObject({ kind: 'sibling', he: 'אח' })
    expect(rel('mor', 'leo')).toMatchObject({ kind: 'sibling', he: 'אחות' })
  })
  it('aunt דודה (Mor is aunt of Leo\'s children)', () => {
    expect(rel('mor', 'adi')).toMatchObject({ kind: 'uncle_aunt', he: 'דודה' })
  })
  it('nephew/niece אחיין/אחיינית', () => {
    expect(rel('adi', 'mor')).toMatchObject({ kind: 'nephew_niece', he: 'אחיין' })
  })
  it('cousin בן דוד/בת דודה (Leo\'s kids × Mor\'s kids)', () => {
    expect(rel('adi', 'ofir')).toMatchObject({ kind: 'cousin', he: 'בן דוד' })
    expect(rel('ofir', 'adi')).toMatchObject({ kind: 'cousin', he: 'בת דודה' })
  })
  it('grandparent/grandchild סבתא/נכדה', () => {
    expect(rel('martita', 'ofir')).toMatchObject({ kind: 'grandparent', he: 'סבתא' })
    expect(rel('ofir', 'martita')).toMatchObject({ kind: 'grandchild', he: 'נכדה' })
  })
  it('great-grandchild נין/נינה', () => {
    expect(rel('anabel', 'martita')).toMatchObject({ kind: 'great_grandchild', he: 'נינה' })
  })
  it('son-in-law חתן (Gilad → Mor)', () => {
    expect(rel('gilad', 'mor')).toMatchObject({ kind: 'child_in_law', he: 'חתן' })
  })
  it('father-in-law חם (Rafi → Yarden)', () => {
    expect(rel('raphi', 'yarden')).toMatchObject({ kind: 'parent_in_law', he: 'חם' })
  })
  it('co-in-laws מחותנים derive when both parents are known (synthetic)', () => {
    const synth = { family: { children: [
      { canonical_name: 'A', hebrew_name: 'א', relationship: 'son', children: ['ג'] },
      { canonical_name: 'B', hebrew_name: 'ב', relationship: 'daughter', children: ['ד'] },
      { canonical_name: 'C', hebrew_name: 'ג', relationship: 'son', spouse: 'ד' },
      { canonical_name: 'D', hebrew_name: 'ד', relationship: 'daughter', spouse: 'ג' },
    ] } }
    const p = loadPeople(synth)
    // A's child (ג) married B's child (ד) ⇒ A and B are מחותנים
    expect(relationshipOf('a', 'b', p)?.kind).toBe('co_in_law')
  })
})

describe('relativesOfKind — X\'s relatives of a type', () => {
  it('Martita\'s grandchildren (נכדים) are Mor\'s + Leo\'s children', () => {
    const grands = relativesOfKind('martita', 'grandchild', people).sort()
    expect(grands).toEqual(['adar', 'adi', 'ayalon', 'eili', 'noam', 'ofir'].sort())
  })
})

describe('M3 invariants', () => {
  it('aliases resolve to EXACTLY one person; Hebrew spellings preserved verbatim', () => {
    expect(resolvePersonId('הדר')).toBe('adar')      // alias
    expect(resolvePersonId('לאו')).toBe('leo')
    expect(resolvePersonId('eilon')).toBe('ayalon')  // Latin alias added earlier
    expect(personById('adar')!.hebrewName).toBe('אדר')
    expect(personById('martita')!.hebrewName).toBe('מרטיטה')
  })
  it('unknown stays unknown — unrelated people have no relationship, and it is never guessed', () => {
    expect(resolvePersonId('מישהו שלא קיים')).toBeNull()
    expect(rel('mirta', 'ofir')).toBeNull() // a friend is not a relative
  })
  it('death does NOT remove genealogy — Papi is still a grandparent', () => {
    expect(personById('papi')!.deceased).toBe(true)
    expect(rel('papi', 'ofir')).toMatchObject({ kind: 'grandparent' })
  })
  it('former_spouse vs partner: the FORMER spouse (Rafi) is a co-parent; the PARTNER (Yael) is NOT', () => {
    expect(rel('raphi', 'ofir')).toMatchObject({ kind: 'parent' })   // ex-spouse = co-parent
    expect(rel('yael', 'ofir')).toBeNull()                            // partner implies nothing about parenthood
    expect(personById('mor')!.formerSpouses).toContain('raphi')
    expect(personById('mor')!.partners).toContain('yael')
  })
  it('gender is set where known and only ever from the allowed set (never a guessed value)', () => {
    // Mirta now carries an explicit gender (the master family update populated friends'
    // genders where known) — a stated fact, not a guess.
    expect(personById('mirta')!.gender).toBe('female')
    expect(personById('leo')!.gender).toBe('male')
    expect(personById('mor')!.gender).toBe('female')
    // The invariant: gender is ALWAYS one of the three valid values — never an invented one.
    for (const p of loadPeople()) expect(['male', 'female', 'unknown']).toContain(p.gender)
  })
  it('temporal facts carry their date', () => {
    expect(personById('mor')!.birthday).toBe('08-10')
  })
})
