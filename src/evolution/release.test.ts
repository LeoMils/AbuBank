import { describe, it, expect } from 'vitest'
import { evaluateRollback, ReleaseRegistry, DEFAULT_SLO, type LiveMetrics } from './release'

const clean: LiveMetrics = { unsupportedClaimRate: 0, undoRate: 0, p99LatencyMs: 1000, invariantViolationsObserved: [] }

describe('Scenario H — passes offline eval but breaches a live SLO → rollback', () => {
  it('auto-rolls-back on a zero-tolerance invariant', () => {
    const live: LiveMetrics = { ...clean, invariantViolationsObserved: ['fabricated_confirmation'] }
    const d = evaluateRollback(live, DEFAULT_SLO, 'v-good')
    expect(d.action).toBe('auto_rollback')
    if (d.action === 'auto_rollback') expect(d.target).toBe('v-good')
  })
  it('recommends rollback on a threshold breach (human confirms)', () => {
    const live: LiveMetrics = { ...clean, undoRate: 0.2 }
    const d = evaluateRollback(live, DEFAULT_SLO, 'v-good')
    expect(d.action).toBe('recommend_rollback')
  })
  it('holds when metrics are within budget', () => {
    expect(evaluateRollback(clean, DEFAULT_SLO, 'v-good').action).toBe('hold')
  })
})

describe('release registry always retains a known-good predecessor', () => {
  it('rolls back to the known-good version and demotes the current', () => {
    const reg = new ReleaseRegistry()
    reg.register({ versionId: 'v1', artifactKind: 'prompt', stage: 'production', createdAt: 't0', flag: 'f', knownGood: true })
    reg.register({ versionId: 'v2', artifactKind: 'prompt', stage: 'canary', createdAt: 't1', flag: 'f', knownGood: false })
    expect(reg.knownGood()!.versionId).toBe('v1')
    const target = reg.rollback('v1', 't2')
    expect(target!.versionId).toBe('v1')
    expect(reg.current()!.versionId).toBe('v1')
  })
})
