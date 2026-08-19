/*
 * תעודת המשפחה — logic proof: pasted free text parses into per-line proposals, each
 * committed through THE LAWS gate (a contradiction refused with its reason).
 */
import { describe, it, expect } from 'vitest'
import { parseFreeText, commitProposal } from './familyRecordLogic'
import { LedgerService, memoryStore } from '../../truth/ledgerService'
import type { Ledger, LedgerPerson } from '../../truth/familyLaws'

const P = (id: string, extra: Partial<LedgerPerson> = {}): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [], ...extra })

describe('תעודת המשפחה — parse free text into proposals', () => {
  it('one proposal per line; "תזכרי ש…" and a bare sentence parse the same; junk is surfaced', () => {
    const props = parseFreeText('תזכרי שדני גר בתל אביב\nרותי היא אשתו של דני\nשורה בלי עובדה')
    expect(props).toHaveLength(3)
    expect(props[0]!.change).toEqual({ op: 'addFact', id: 'דני', fact: { kind: 'residence', value: 'תל אביב', source: 'conversation', at: 0 } })
    expect(props[1]!.change).toEqual({ op: 'addSpouse', a: 'רותי', b: 'דני' })
    expect(props[2]!.change).toBeNull()
    expect(props[2]!.label).toContain('לא זוהתה עובדה')
  })
})

describe('תעודת המשפחה — commit through THE LAWS gate', () => {
  it('a clean fact commits; a planted contradiction is REFUSED with a reason (nothing stored)', () => {
    const svc = new LedgerService(memoryStore(), () => new Map<string, LedgerPerson>([['אופיר', P('אופיר', { spouses: ['גלעד'] })], ['גלעד', P('גלעד', { spouses: ['אופיר'] })], ['רפי', P('רפי')], ['דני', P('דני')]]))
    const [good] = parseFreeText('דני גר בחיפה')
    const okr = commitProposal(svc, good!.change!, 1)
    expect(okr.accepted).toBe(true)
    expect(okr.line).toContain('רשמתי')
    // Poison: marry אופיר (already married to גלעד) to רפי → refused.
    const [poison] = parseFreeText('אופיר היא אשתו של רפי')
    const before = svc.getLog().length
    const bad = commitProposal(svc, poison!.change!, 2)
    expect(bad.accepted).toBe(false)
    expect(bad.line).toContain('לא רשמתי')
    expect(svc.getLog().length).toBe(before) // nothing stored
  })
})
