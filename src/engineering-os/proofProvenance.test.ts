/*
 * proofProvenance.test.ts — proof of the Proof Provenance Key + safe-reuse rules. (§12/B4)
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { reuseDecision, provenanceKey, FAMILY_DEPENDENCIES } from '../../scripts/proof-provenance-lib.mjs'

const deps = { runtimeSourceSha: '237bef9', deployedBuildId: '0.291.0', harnessSha: 'aaa', providerIdentity: 'openai-gpt-realtime' }

describe('Proof Provenance Key (§12/B4)', () => {
  it('same key → EVIDENCE_REUSED', () => {
    const k = provenanceKey('deployed-acceptance', deps)
    const r = reuseDecision('deployed-acceptance', k, deps)
    expect(r.decision).toBe('EVIDENCE_REUSED')
  })

  it('THE §12 ATTACK: a dependency changed (runtime SHA) even if the obvious file did not → INVALIDATED', () => {
    const k = provenanceKey('deployed-acceptance', deps)
    const r = reuseDecision('deployed-acceptance', k, { ...deps, runtimeSourceSha: 'DIFFERENT' })
    expect(r.decision).toBe('EVIDENCE_INVALIDATED')
    expect(r.reason).toMatch(/changed/)
  })

  it('an unknown dependency (UNKNOWN value) widens scope → INVALIDATED', () => {
    const r = reuseDecision('deployed-acceptance', 'x', { runtimeSourceSha: '237bef9' })
    expect(r.decision).toBe('EVIDENCE_INVALIDATED')
    expect(r.reason).toMatch(/unknown dependency/)
  })

  it('an unknown evidence family widens scope → INVALIDATED', () => {
    expect(reuseDecision('made-up-family', 'x', deps).decision).toBe('EVIDENCE_INVALIDATED')
  })

  it('a deterministic-unit proof only depends on harness SHA (minimum correct set)', () => {
    expect(FAMILY_DEPENDENCIES['deterministic-unit']).toEqual(['harnessSha'])
  })
})
