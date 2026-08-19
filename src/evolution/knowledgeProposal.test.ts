import { describe, it, expect } from 'vitest'
import { proposeFromCorrection, mayAutoApply, type KnownFact, type CorrectionInput } from './knowledgeProposal'

const now = '2026-07-10T10:00:00Z'
function correction(over: Partial<CorrectionInput> = {}): CorrectionInput {
  return { proposalId: 'p1', subject: 'Ofir', predicate: 'gender', object: 'female',
    utterance: 'אופיר היא הנכדה, נקבה', timestamp: now, turnId: 't1', ...over }
}

describe('Scenario A — explicit family correction becomes a scoped proposal', () => {
  it('does not silently overwrite; keeps previousValue and provenance', () => {
    const existing: KnownFact[] = [{ subject: 'Ofir', predicate: 'gender', object: 'male', trusted: false }]
    const p = proposeFromCorrection(correction(), existing)
    expect(p.scope).toBe('personal')          // never global
    expect(p.previousValue).toBe('male')       // prior value preserved, not discarded
    expect(p.provenance.utterance).toContain('אופיר')
    expect(p.conflictStatus).toBe('conflict')  // differs from an untrusted existing value
    expect(mayAutoApply(p)).toBe(false)        // conflict → waits for confirmation
  })
  it('corroborates when it agrees with an existing value', () => {
    const existing: KnownFact[] = [{ subject: 'Ofir', predicate: 'gender', object: 'female', trusted: true }]
    const p = proposeFromCorrection(correction(), existing)
    expect(p.conflictStatus).toBe('confirmed')
    expect(p.confidence).toBe('high')
  })
})

describe('Scenario E — correction conflicting with TRUSTED knowledge is quarantined', () => {
  it('quarantines instead of corrupting the graph', () => {
    const existing: KnownFact[] = [{ subject: 'Ofir', predicate: 'relation', object: 'granddaughter', trusted: true }]
    const p = proposeFromCorrection(correction({ predicate: 'relation', object: 'grandson' }), existing)
    expect(p.conflictStatus).toBe('quarantined')
    expect(p.requiresConfirmation).toBe(true)
    expect(mayAutoApply(p)).toBe(false)
    expect(p.previousValue).toBe('granddaughter') // trusted value untouched
  })
})

describe('scope + authorization guards', () => {
  it('a temporary correction is session-scoped only', () => {
    const p = proposeFromCorrection(correction({ temporary: true }), [])
    expect(p.scope).toBe('session')
    expect(p.effectiveDate).toBe(now)
  })
  it('correcting another person leaves authorization unverified', () => {
    const p = proposeFromCorrection(correction({ targetsOtherPerson: true }), [])
    expect(p.authorizationStatus).toBe('unknown')
    expect(mayAutoApply(p)).toBe(false)
  })
  it('a suspected joke is held for confirmation', () => {
    const p = proposeFromCorrection(correction({ jokeSuspected: true }), [])
    expect(p.confidence).toBe('low')
    expect(p.requiresConfirmation).toBe(true)
  })
})
