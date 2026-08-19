/*
 * EVIDENCE-PRODUCER lineage suite (Stage 3C §12). EP1–EP5.
 * Freshness is COMPUTED from dependency changes, never from a label. A relevant change invalidates
 * the affected evidence; an unrelated change does not invalidate everything.
 */
import { describe, it, expect } from 'vitest'
import { computeFreshness, evaluateProducers, stageProducers, type ProducerRecord } from './evidenceProducers'

const rec: ProducerRecord = { id: 'r', script: 's.ts', output: 'o.json', evidenceClass: 'CODE', freshnessDependsOn: ['src/foo.ts', 'src/bar/'] }

describe('evidence producers — computed freshness', () => {
  it('EP1 · a change to a declared dependency → STALE', () => {
    expect(computeFreshness(rec, ['src/foo.ts'])).toBe('STALE')
  })
  it('EP2 · a change under a dependency prefix → STALE', () => {
    expect(computeFreshness(rec, ['src/bar/baz.ts'])).toBe('STALE')
  })
  it('EP3 · an UNRELATED change does NOT invalidate the artifact (no over-invalidation)', () => {
    expect(computeFreshness(rec, ['docs/readme.md', 'src/unrelated.ts'])).toBe('FRESH')
  })
  it('EP4 · no changes → FRESH (freshness is not a timestamp/label)', () => {
    expect(computeFreshness(rec, [])).toBe('FRESH')
  })
})

describe('evidence producers — stage registry', () => {
  it('EP5 · editing the reconciliation core marks ONLY the reconciliation stale, not every producer', () => {
    const r = evaluateProducers(stageProducers(), ['src/engineering-os/dynamicReachability.ts'])
    const stale = r.records.filter((x) => x.freshness === 'STALE').map((x) => x.id)
    expect(stale).toContain('capability-reconciliation')
    expect(stale).not.toContain('acceptance-denominator')
    expect(r.staleCount).toBeLessThan(r.records.length) // not everything invalidated
  })
})
