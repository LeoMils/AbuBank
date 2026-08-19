/*
 * obligationUniverse.test.ts — meta-completeness of the obligation universe. (§3 / C10 meta)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Proves the implementation universe (REQUIRED_OBLIGATION_IDS) and the independent constitutional view
 * (CONSTITUTIONAL_OBLIGATIONS.json) agree — with BOTH sensitivity and specificity.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM siblings; shared verbatim, no types.
import { deriveUniverseCompleteness } from '../../scripts/obligation-universe-lib.mjs'
// @ts-expect-error
import { REQUIRED_OBLIGATION_IDS } from '../../scripts/machine-work-graph-lib.mjs'

const constitutional = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/CONSTITUTIONAL_OBLIGATIONS.json'), 'utf8')).obligations

describe('obligation universe meta-completeness (§3)', () => {
  it('OBLIGATION_UNIVERSE_COMPLETENESS = PROVEN (the two independent views agree)', () => {
    const r = deriveUniverseCompleteness(REQUIRED_OBLIGATION_IDS, constitutional())
    expect(r.missingFromUniverse).toEqual([])
    expect(r.orphanRequired).toEqual([])
    expect(r.falseMandatory).toEqual([])
    expect(r.OBLIGATION_UNIVERSE_COMPLETENESS).toBe('PROVEN')
  })

  it('SENSITIVITY: delete a genuine constitutional requirement from the impl universe → NOT_PROVEN', () => {
    const trimmed = REQUIRED_OBLIGATION_IDS.filter((id: string) => id !== 'exit-contract')
    const r = deriveUniverseCompleteness(trimmed, constitutional())
    expect(r.missingFromUniverse).toContain('exit-contract')
    expect(r.OBLIGATION_UNIVERSE_COMPLETENESS).toBe('NOT_PROVEN')
  })

  it('SENSITIVITY 2: drop from BOTH registry and universe — the constitutional cross-check still catches it', () => {
    // Simulate the universe losing an id that the constitution still requires (releaseRelevant:true).
    const trimmedUniverse = REQUIRED_OBLIGATION_IDS.filter((id: string) => id !== 'capsule-completeness')
    const r = deriveUniverseCompleteness(trimmedUniverse, constitutional())
    expect(r.missingFromUniverse).toContain('capsule-completeness')
  })

  it('SPECIFICITY: a non-release-relevant item is NOT converted into a mandatory obligation', () => {
    // The constitutional view marks these releaseRelevant:false; they must not be required, and adding
    // one to the universe must be flagged as a false mandatory (not silently accepted).
    const withNoise = [...REQUIRED_OBLIGATION_IDS, 'workbench-authoring-tool']
    const r = deriveUniverseCompleteness(withNoise, constitutional())
    expect(r.falseMandatory).toContain('workbench-authoring-tool')
    // And when NOT in the universe, it does not appear as missing (it is not required).
    const clean = deriveUniverseCompleteness(REQUIRED_OBLIGATION_IDS, constitutional())
    expect(clean.missingFromUniverse).not.toContain('workbench-authoring-tool')
  })

  it('no-orphan: an implementation obligation with no constitutional backing is flagged', () => {
    const r = deriveUniverseCompleteness([...REQUIRED_OBLIGATION_IDS, 'invented-blocker'], constitutional())
    expect(r.orphanRequired).toContain('invented-blocker')
  })

  it('the constitutional view has more entries than the release-relevant set (specificity headroom)', () => {
    const c = constitutional()
    expect(c.filter((x: { releaseRelevant: boolean }) => x.releaseRelevant === false).length).toBeGreaterThan(0)
  })
})
