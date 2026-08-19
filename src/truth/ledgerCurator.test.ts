/*
 * LEDGER CURATOR — nightly tidy-up proof (Constitution §3).
 * Proves: a planted DUPLICATE and a SUPERSEDED fact are cleaned with one-line Hebrew
 * actions; NO fact is deleted (the relation survives, the latest value wins); the whole
 * curation is UNDOABLE.
 */
import { describe, it, expect } from 'vitest'
import { LedgerService, memoryStore } from './ledgerService'
import { curateLog } from './ledgerCurator'
import type { Ledger, LedgerPerson } from './familyLaws'

const P = (id: string, extra: Partial<LedgerPerson> = {}): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [], ...extra })
const seed = (...ppl: LedgerPerson[]): (() => Ledger) => () => new Map(ppl.map((p) => [p.id, p]))

describe('LEDGER CURATOR — cleans a planted duplicate + superseded fact, nothing deleted', () => {
  it('dedupes an identical fact and supersedes an old value, with undoable one-line actions', () => {
    const svc = new LedgerService(memoryStore(), seed(P('דני'), P('רותי'), P('מור')))
    svc.write({ op: 'addSpouse', a: 'דני', b: 'רותי' }, 1)
    svc.write({ op: 'addSpouse', a: 'דני', b: 'רותי' }, 2)          // PLANTED duplicate
    svc.write({ op: 'setBirthdate', id: 'מור', birthdate: '1955-04-08' }, 3)
    svc.write({ op: 'setBirthdate', id: 'מור', birthdate: '1955-05-10' }, 4) // SUPERSEDES the old
    expect(svc.getLog()).toHaveLength(4)

    const r = svc.curate()
    const kinds = r.actions.map((a) => a.kind)
    expect(kinds).toContain('dedupe')
    expect(kinds).toContain('supersede')
    for (const a of r.actions) expect(a.line.includes('\n')).toBe(false) // one line each

    // The FACTS survive: the marriage is still there, the LATEST birthdate wins.
    expect(svc.ledger().get('דני')!.spouses).toContain('רותי')
    expect(svc.ledger().get('מור')!.birthdate).toBe('1955-05-10')
    expect(svc.getLog().length).toBeLessThan(4) // the duplicate/old value were folded away

    // Undoable — restore the pre-curation log exactly.
    expect(svc.undoCuration()).toBe(true)
    expect(svc.getLog()).toHaveLength(4)
    expect(svc.ledger().get('מור')!.birthdate).toBe('1955-05-10') // replay still yields latest
  })

  it('reorders an out-of-order log chronologically', () => {
    const svc = new LedgerService(memoryStore(), seed(P('א'), P('ב'), P('ג')))
    svc.write({ op: 'addSpouse', a: 'א', b: 'ב' }, 100)
    svc.write({ op: 'setBirthdate', id: 'ג', birthdate: '1960-01-01' }, 50) // earlier timestamp, later write
    const r = svc.curate()
    expect(r.actions.some((a) => a.kind === 'reorder')).toBe(true)
    expect(svc.getLog()[0]!.at).toBeLessThanOrEqual(svc.getLog()[1]!.at)
  })

  it('curateLog is pure — an already-clean log yields no actions', () => {
    const clean = [{ at: 1, line: 'x', change: { op: 'addSpouse' as const, a: 'א', b: 'ב' }, source: 't' }]
    expect(curateLog(clean).actions).toHaveLength(0)
  })
})
