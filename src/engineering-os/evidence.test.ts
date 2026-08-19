import { describe, it, expect } from 'vitest'
import {
  EVIDENCE_CLASSES, ENVIRONMENTS, classRank, environmentClass, isAtLeast,
  validateEvidence, createEvidence, type EngineeringEvidence,
} from './evidence'

const TS = '2026-07-12T00:00:00.000Z'

function ev(partial: Partial<EngineeringEvidence>): EngineeringEvidence {
  return createEvidence({
    capability: 'Calendar', scenario: 's', evidenceClass: 'CODE', environment: 'code',
    expected: 'e', actual: 'a', timestamp: TS, verdict: 'PROVEN', ...partial,
  })
}

describe('evidence classes + environments', () => {
  it('has 6 ordered classes matching 6 environments 1:1', () => {
    expect(EVIDENCE_CLASSES.length).toBe(6)
    expect(ENVIRONMENTS.length).toBe(6)
    expect(classRank('CODE')).toBe(0)
    expect(classRank('PRODUCTION')).toBe(5)
    expect(environmentClass('physical_device')).toBe('PHYSICAL_DEVICE')
  })
  it('isAtLeast compares strength correctly', () => {
    expect(isAtLeast('PRODUCTION', 'CODE')).toBe(true)
    expect(isAtLeast('CODE', 'PREVIEW')).toBe(false)
    expect(isAtLeast('PREVIEW', 'PREVIEW')).toBe(true)
  })
})

describe('validateEvidence — never claim a stronger class than the environment', () => {
  it('accepts a well-formed record', () => {
    expect(validateEvidence(ev({})).ok).toBe(true)
  })
  it('rejects a class stronger than the environment can prove', () => {
    const r = validateEvidence(ev({ evidenceClass: 'PRODUCTION', environment: 'mock', capability: 'Calendar' }))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/exceeds what environment/)
  })
  it('forbids PROVEN Voice below PHYSICAL_DEVICE', () => {
    const r = validateEvidence(ev({ capability: 'Voice', evidenceClass: 'BROWSER', environment: 'browser' }))
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/Voice cannot be PROVEN/)
  })
  it('allows PROVEN Voice at PHYSICAL_DEVICE', () => {
    const r = validateEvidence(ev({ capability: 'Voice', evidenceClass: 'PHYSICAL_DEVICE', environment: 'physical_device' }))
    expect(r.ok).toBe(true)
  })
  it('requires scenario and timestamp', () => {
    expect(validateEvidence(ev({ scenario: '' })).ok).toBe(false)
    expect(validateEvidence(ev({ timestamp: '' })).ok).toBe(false)
  })
})

describe('createEvidence', () => {
  it('defaults verdict to NOT_RUN', () => {
    const e = createEvidence({
      capability: 'Online', scenario: 's', evidenceClass: 'CODE', environment: 'code',
      expected: 'e', actual: 'a', timestamp: TS,
    })
    expect(e.verdict).toBe('NOT_RUN')
  })
})
