/*
 * familyInLawClass.test.ts — the SPOUSE-OF-DESCENDANT in-law CLASS (§ Yarden escape, structural).
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * The device escape "מי זאת ירדן" declined because a grandchild's spouse was represented only
 * relative to their partner ("אשת עילי"), never first-class relative to Martita — unlike a direct
 * grandchild ("הנכדה שלך"). This proves the CLASS fix (keyed on the relationship enum, not the name):
 * both a granddaughter-in-law (ירדן→עילי) AND a grandson-in-law (גלעד→אופיר) now resolve to Martita
 * on BOTH resolution paths (the text tool `shapeFamilyAnswer` and the canonical `describeRelation`),
 * with correct Hebrew gender wording, and WITHOUT inventing a blood relation. Direct relations and the
 * depth-1 in-law (son-in-law) are unchanged.
 */
import { describe, it, expect } from 'vitest'
import { searchFamily } from './tools'
import { shapeFamilyAnswer } from './responseShaper'
import { describeRelation } from './familyGraph'
import { whoIs } from '../../services/people/peopleLookup'

const member = (name: string) => searchFamily(name).members[0]!

describe('spouse-of-descendant in-law — text tool (shapeFamilyAnswer) states the MARTITA relation', () => {
  it('granddaughter-in-law (ירדן) is "אשת <grandson> הנכד שלך" — not just "אשת עילי"', () => {
    const a = shapeFamilyAnswer(member('ירדן'))
    expect(a).toContain('עילי')          // her partner
    expect(a).toContain('הנכד שלך')      // ← first-class tie to Martita (your grandson's wife)
    expect(a).toContain('אשת')           // female in-law wording
  })
  it('grandson-in-law (גלעד) is "בעל <granddaughter> הנכדה שלך" — the male mirror', () => {
    const a = shapeFamilyAnswer(member('גלעד'))
    expect(a).toContain('אופיר')
    expect(a).toContain('הנכדה שלך')     // your granddaughter's husband
    expect(a).toContain('בעל')           // male in-law wording
  })
  it('a DIRECT grandchild is unchanged (no regression)', () => {
    expect(shapeFamilyAnswer(member('אופיר'))).toContain('הנכדה שלך')
    expect(shapeFamilyAnswer(member('עילי'))).toContain('הנכד שלך')
  })
})

describe('spouse-of-descendant in-law — canonical two-name reasoning (describeRelation)', () => {
  it('describeRelation(ירדן, מרטיטה) RESOLVES (was null) — via her grandson husband, gendered', () => {
    const r = describeRelation('ירדן', 'מרטיטה', 'he')
    expect(r).not.toBeNull()
    expect(r!).toContain('עילי')
    expect(r!).toContain('הנכד')         // Eili is Martita's grandson
    expect(r!).toContain('נשואה')        // female → נשואה (not נשוי)
    // NO invented blood relation: she is NOT claimed to be Martita's own granddaughter.
    expect(r!).not.toMatch(/ירדן\s+הנכדה של מרטיטה/)
  })
  it('describeRelation(גלעד, מרטיטה) RESOLVES — male mirror via his granddaughter partner', () => {
    const r = describeRelation('גלעד', 'מרטיטה', 'he')
    expect(r).not.toBeNull()
    expect(r!).toContain('אופיר')
    expect(r!).toContain('הנכדה')        // Ofir is Martita's granddaughter
  })
  it('depth-1 in-law is unchanged: describeRelation(רפי, מרטיטה) still resolves via parent-of-spouse', () => {
    const r = describeRelation('רפי', 'מרטיטה', 'he')
    expect(r).not.toBeNull()
    expect(r!).toContain('מור')          // through Mor (Martita's daughter)
  })
  it('NO INVENTION: an unknown person yields null — never a fabricated tie (truth contract)', () => {
    expect(describeRelation('ירדן', 'מישהו שלא קיים בכלל', 'he')).toBeNull()
    // (ירדן↔רפי is NOT null — that is a REAL tie: Rafi is Eili's father, Eili married Yarden →
    //  daughter-in-law/father-in-law. The resolver reporting it is correct, not invention.)
  })
})

describe('realtime path parity (peopleLookup.whoIs) already first-class — must stay so', () => {
  it('whoIs(ירדן) and whoIs(גלעד) state the Martita relation', () => {
    const y = whoIs('ירדן'); const g = whoIs('גלעד')
    expect(y.status === 'ok' && /נכד/.test(y.relationToMartita ?? '')).toBe(true)
    expect(g.status === 'ok' && /נכד/.test(g.relationToMartita ?? '')).toBe(true)
  })
})
