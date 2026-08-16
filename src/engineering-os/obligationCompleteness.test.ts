/*
 * NEGATIVE-SPACE CONTROL ADVERSARIAL SUITE (Stage 3C §10). NC1–NC7 spec-derived.
 * The critical new capability: detect a control that SHOULD EXIST but is absent.
 */
import { describe, it, expect } from 'vitest'
import { evaluateObligationCompleteness, type ObligationCompletenessInput } from './obligationCompleteness'

function green(): ObligationCompletenessInput {
  return {
    invariants: [
      { id: 'inv1', statement: 'A', version: '1', releaseCritical: true },
      { id: 'inv2', statement: 'B', version: '1', releaseCritical: true },
    ],
    obligations: [
      { id: 'o1', invariantId: 'inv1', requiredCapability: 'cap1', implState: 'IMPLEMENTED_AND_MAPPED', releaseCritical: true, mappedComponent: 'compA', mappedClaim: 'claimA' },
      { id: 'o2', invariantId: 'inv2', requiredCapability: 'cap2', implState: 'IMPLEMENTED_AND_MAPPED', releaseCritical: true, mappedComponent: 'compB', mappedClaim: 'claimB' },
    ],
    decisionPathComponents: ['compA', 'compB'],
  }
}
const codes = (i: ObligationCompletenessInput) => evaluateObligationCompleteness(i).blockers.map((b) => b.code)

describe('obligation completeness — green baseline', () => {
  it('a fully-mapped, all-implemented constitution has zero blockers', () => {
    expect(evaluateObligationCompleteness(green()).blockers).toEqual([])
  })
})

describe('negative-space control adversarial suite NC1–NC7', () => {
  it('NC1 · invariant requires a capability but no component exists → CONTROL_OBLIGATION_UNIMPLEMENTED', () => {
    const i = green(); i.obligations[0]!.implState = 'UNIMPLEMENTED'; delete i.obligations[0]!.mappedComponent; delete i.obligations[0]!.mappedClaim
    expect(codes(i)).toContain('CONTROL_OBLIGATION_UNIMPLEMENTED')
  })
  it('NC2 · implementation removed for an existing obligation → CONTROL_OBLIGATION_UNIMPLEMENTED', () => {
    const i = green(); i.obligations[1]!.implState = 'UNIMPLEMENTED'
    expect(codes(i)).toContain('CONTROL_OBLIGATION_UNIMPLEMENTED')
  })
  it('NC3 · implementation exists but no obligation/claim mapping → CONTROL_PREREQUISITE_UNCOVERED', () => {
    const i = green(); i.obligations[0]!.implState = 'IMPLEMENTED_BUT_UNMAPPED'
    expect(codes(i)).toContain('CONTROL_PREREQUISITE_UNCOVERED')
  })
  it('NC4 · harmless non-release-critical helper obligation → NO false prerequisite (specificity)', () => {
    const i = green(); i.obligations.push({ id: 'oHelper', invariantId: 'inv1', requiredCapability: 'log', implState: 'UNIMPLEMENTED', releaseCritical: false })
    expect(evaluateObligationCompleteness(i).blockers).toEqual([])
  })
  it('NC5 · release obligation marked N/A without proof → INVALID_CONTROL_NA', () => {
    const i = green(); i.obligations[0]!.implState = 'NOT_APPLICABLE_WITH_PROOF'
    expect(codes(i)).toContain('INVALID_CONTROL_NA')
  })
  it('NC6 · a new constitutional invariant with no derived obligation → CONSTITUTIONAL_OBLIGATION_OMITTED', () => {
    const i = green(); i.invariants.push({ id: 'inv3', statement: 'C (new)', version: '1', releaseCritical: true })
    expect(codes(i)).toContain('CONSTITUTIONAL_OBLIGATION_OMITTED')
  })
  it('NC7 · release-decision code outside the declared control model → CONTROL_DECISION_DEPENDENCY_UNDECLARED', () => {
    const i = green(); i.decisionPathComponents.push('undeclaredDecisionComp')
    expect(codes(i)).toContain('CONTROL_DECISION_DEPENDENCY_UNDECLARED')
  })
  it('N/A with proof does not block', () => {
    const i = green(); i.obligations[0]!.implState = 'NOT_APPLICABLE_WITH_PROOF'; i.obligations[0]!.naProof = 'no external retrieval in this candidate'
    expect(evaluateObligationCompleteness(i).blockers).toEqual([])
  })
})
