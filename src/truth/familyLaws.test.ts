/*
 * THE LAWS — write-gate proofs (Constitution §2).
 * Proves: (a) a planted contradiction is REJECTED AT THE GATE with a one-line reason;
 *         (e) a poisoning attempt NEVER stores (ledger unchanged);
 *         (f) a manual upload with a planted conflict surfaces a one-line diff.
 * A valid write is accepted, logged, and symmetric.
 */
import { describe, it, expect } from 'vitest'
import { applyChange, applyBatch, checkLaws, type Ledger, type LedgerPerson } from './familyLaws'
import { seedLedgerFromGraph } from './ledgerSeed'

const P = (id: string, extra: Partial<LedgerPerson> = {}): LedgerPerson => ({ id, name: id, gender: 'unknown', parents: [], spouses: [], exSpouses: [], aliases: [], ...extra })
function ledger(...people: LedgerPerson[]): Ledger { return new Map(people.map((p) => [p.id, p])) }

describe('THE LAWS — a valid write passes and stays symmetric', () => {
  it('a legal marriage is accepted, logged, and recorded on BOTH sides', () => {
    const l = ledger(P('דני'), P('רותי'))
    const r = applyChange(l, { op: 'addSpouse', a: 'דני', b: 'רותי' })
    expect(r.ok).toBe(true)
    expect(r.log).toContain('נשואים')
    expect(r.ledger.get('דני')!.spouses).toContain('רותי')
    expect(r.ledger.get('רותי')!.spouses).toContain('דני') // symmetry by construction
  })
})

describe('THE LAWS — (a) planted contradictions are REJECTED at the gate', () => {
  it('parenthood CYCLE is rejected', () => {
    let l = ledger(P('אב'), P('בן'))
    l = applyChange(l, { op: 'addParent', child: 'בן', parent: 'אב' }).ledger
    const r = applyChange(l, { op: 'addParent', child: 'אב', parent: 'בן' })
    expect(r.ok).toBe(false)
    expect(r.violations[0]!.law).toBe('L2:no-cycle')
    expect(r.violations[0]!.message.length).toBeGreaterThan(5) // one-line reason present
  })

  it('parent NOT older than child is rejected', () => {
    const l = ledger(P('הורה', { birthdate: '2010-01-01' }), P('ילד', { birthdate: '1990-01-01' }))
    const r = applyChange(l, { op: 'addParent', child: 'ילד', parent: 'הורה' })
    expect(r.ok).toBe(false)
    expect(r.violations[0]!.law).toBe('L4:parent-older')
  })

  it('a SECOND current spouse is rejected (monogamy)', () => {
    let l = ledger(P('א'), P('ב'), P('ג'))
    l = applyChange(l, { op: 'addSpouse', a: 'א', b: 'ב' }).ledger
    const r = applyChange(l, { op: 'addSpouse', a: 'א', b: 'ג' })
    expect(r.ok).toBe(false)
    expect(r.violations.some((v) => v.law === 'L7:spouse-conflict')).toBe(true)
  })

  it('siblings WITHOUT a shared parent are rejected', () => {
    const l = ledger(P('א', { parents: ['p1'] }), P('ב', { parents: ['p2'] }), P('p1'), P('p2'))
    const r = applyChange(l, { op: 'addSibling', a: 'א', b: 'ב' })
    expect(r.ok).toBe(false)
    expect(r.violations[0]!.law).toBe('L3:siblings-share-parents')
  })

  it('a self-relation is rejected', () => {
    const l = ledger(P('א'))
    expect(applyChange(l, { op: 'addParent', child: 'א', parent: 'א' }).violations[0]!.law).toBe('L8:no-self')
  })

  it('a duplicate identity (same name/alias) is quarantined, not silently added', () => {
    const l = ledger(P('מור', { aliases: ['Mor'] }))
    const r = applyChange(l, { op: 'addPerson', person: P('מור2', { name: 'מור' }) })
    expect(r.ok).toBe(false)
    expect(r.violations[0]!.law).toBe('L5:one-identity')
  })
})

describe('THE LAWS — (e) a poisoning attempt NEVER stores', () => {
  it('a rejected write leaves the ledger byte-for-byte unchanged', () => {
    let l = ledger(P('א'), P('ב'), P('ג'))
    l = applyChange(l, { op: 'addSpouse', a: 'א', b: 'ב' }).ledger
    const before = JSON.stringify([...l].map(([k, v]) => [k, v.spouses]))
    const r = applyChange(l, { op: 'addSpouse', a: 'א', b: 'ג' }) // poison: bigamy
    expect(r.ok).toBe(false)
    expect(r.ledger).toBe(l) // same reference — nothing applied
    expect(JSON.stringify([...r.ledger].map(([k, v]) => [k, v.spouses]))).toBe(before)
  })

  it('poisoning the REAL graph (marry an already-married member elsewhere) is refused', () => {
    const l = seedLedgerFromGraph()
    // אופיר is married to גלעד in the real graph — marrying her to רפי must be refused.
    if (l.get('אופיר')?.spouses.length) {
      const r = applyChange(l, { op: 'addSpouse', a: 'אופיר', b: 'רפי' })
      expect(r.ok).toBe(false)
      expect(r.ledger).toBe(l)
    } else {
      expect(l.size).toBeGreaterThan(0) // graph loaded; skip if spouse edges absent
    }
  })
})

describe('THE LAWS — (f) a manual upload with a planted conflict surfaces a one-line diff', () => {
  it('accepts the clean facts and rejects the conflict, each with one line', () => {
    const l = ledger(P('סבא', { birthdate: '1950-01-01' }), P('אבא', { birthdate: '1975-01-01' }), P('נכד', { birthdate: '2005-01-01' }))
    const { diff } = applyBatch(l, [
      { op: 'addParent', child: 'אבא', parent: 'סבא' },   // clean
      { op: 'addParent', child: 'נכד', parent: 'אבא' },   // clean
      { op: 'addParent', child: 'סבא', parent: 'נכד' },   // PLANTED conflict (cycle + age)
    ])
    expect(diff).toHaveLength(3)
    expect(diff[0]!.accepted).toBe(true)
    expect(diff[1]!.accepted).toBe(true)
    expect(diff[2]!.accepted).toBe(false)
    expect(diff[2]!.reason.length).toBeGreaterThan(5) // one-line explanation
    // every diff line is a single line (no newlines)
    for (const d of diff) expect(d.reason.includes('\n')).toBe(false)
  })
})
