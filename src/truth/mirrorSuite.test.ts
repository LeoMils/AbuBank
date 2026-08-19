/*
 * METAMORPHIC MIRROR SUITE — proof (b).
 * Proves: a run of 1000+ auto-generated, oracle-free consistency checks passes over the
 * real family engine; AND a deliberately planted asymmetry is caught by MIRRORS ALONE
 * (independent of the write gate).
 */
import { describe, it, expect } from 'vitest'
import { generateRelationMirrors, ledgerSpouseSymmetryMirrors, runMirrors } from './mirrorSuite'
import { seedLedgerFromGraph } from './ledgerSeed'

describe('MIRROR SUITE — 1000+ oracle-free checks pass on the real engine', () => {
  it('generates 1000+ metamorphic mirrors and every one holds', () => {
    const mirrors = generateRelationMirrors(['he', 'es'])
    const run = runMirrors(mirrors)
    // eslint-disable-next-line no-console
    if (run.breaks.length) console.log('MIRROR BREAKS:\n' + run.breaks.slice(0, 20).map((b) => `  [${b.kind}] ${b.id} :: ${b.detail}`).join('\n'))
    expect(run.total).toBeGreaterThanOrEqual(1000)
    expect(run.breaks, `mirror breaks: ${run.breaks.map((b) => b.id).join(', ')}`).toHaveLength(0)
    expect(run.passed).toBe(run.total)
  })

  it('covers BOTH inverse-existence AND paraphrase-alias mirror kinds', () => {
    const kinds = new Set(generateRelationMirrors(['he', 'es']).map((m) => m.kind))
    expect(kinds.has('inverse-existence')).toBe(true)
    expect(kinds.has('paraphrase-alias')).toBe(true)
  })
})

describe('MIRROR SUITE — a planted asymmetry is caught by mirrors ALONE', () => {
  it('a one-directional spouse edge (bypassing the write gate) is flagged', () => {
    const l = seedLedgerFromGraph()
    // A consistent ledger passes the symmetry mirror.
    expect(runMirrors(ledgerSpouseSymmetryMirrors(l)).breaks).toHaveLength(0)
    // Plant a corruption the write gate would never allow: give דני a spouse רותי, but
    // do NOT record the reverse edge on רותי (hand-corrupted, gate bypassed).
    l.set('דני', { id: 'דני', name: 'דני', gender: 'male', parents: [], spouses: ['רותי'], exSpouses: [], aliases: [] })
    l.set('רותי', { id: 'רותי', name: 'רותי', gender: 'female', parents: [], spouses: [], exSpouses: [], aliases: [] })
    const run = runMirrors(ledgerSpouseSymmetryMirrors(l))
    expect(run.breaks.length).toBeGreaterThanOrEqual(1)
    expect(run.breaks[0]!.kind).toBe('symmetry-spouse')
    expect(run.breaks[0]!.id).toContain('דני')
  })
})
