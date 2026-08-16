/*
 * CONTROL-COMPLETENESS ADVERSARIAL SUITE (Stage 3C §11).
 * ═════════════════════════════════════════════════════
 * Each case seeds exactly one completeness defect and asserts the spec-derived
 * control state + reason. Specificity (CC3) is as important as sensitivity: a
 * harmless helper must NOT create a false release prerequisite, or engineers route
 * around the mechanism. Expected reasons are derived from the §9–12 SPECIFICATION.
 */
import { describe, it, expect } from 'vitest'
import { evaluateControlCompleteness, type ControlCompletenessInput, type ControlClaim, type ControlComponent } from './controlCompleteness'

function green(): ControlCompletenessInput {
  const components: ControlComponent[] = [
    { id: 'compA', releaseCritical: true, requiredClaim: 'claimA' },
    { id: 'compB', releaseCritical: true, requiredClaim: 'claimB' },
  ]
  const claims: ControlClaim[] = [
    { id: 'claimA', invariant: 'A holds', component: 'compA', releaseCritical: true, state: 'PROVEN', certifiedComponentHash: 'h1', liveComponentHash: 'h1' },
    { id: 'claimB', invariant: 'B holds', component: 'compB', releaseCritical: true, state: 'PROVEN', certifiedComponentHash: 'h2', liveComponentHash: 'h2' },
  ]
  return { components, claims, trustRootComponents: ['compA', 'compB'] }
}
const codes = (i: ControlCompletenessInput) => evaluateControlCompleteness(i).blockers.map((b) => b.code)

describe('control-completeness — green baseline (all detectors silent)', () => {
  it('a fully-mapped, all-PROVEN, trust-root-covered model has zero blockers', () => {
    const r = evaluateControlCompleteness(green())
    expect(r.blockers, JSON.stringify(r.blockers)).toEqual([])
    expect(r.modelIncomplete).toBe(false)
  })
})

describe('control-completeness adversarial suite CC1–CC6', () => {
  it('CC1 · release-critical component with no required claim → CONTROL_PREREQUISITE_UNCOVERED', () => {
    const i = green(); i.components.push({ id: 'compC', releaseCritical: true, requiredClaim: '' })
    expect(codes(i)).toContain('CONTROL_PREREQUISITE_UNCOVERED')
  })
  it('CC2 · mapping removed from an existing release-critical component → CONTROL_PREREQUISITE_UNCOVERED', () => {
    const i = green(); i.components[0]!.requiredClaim = ''
    expect(codes(i)).toContain('CONTROL_PREREQUISITE_UNCOVERED')
  })
  it('CC3 · harmless non-release-critical helper → NO false prerequisite (specificity)', () => {
    const i = green(); i.components.push({ id: 'utilHelper', releaseCritical: false, requiredClaim: '' })
    expect(evaluateControlCompleteness(i).blockers).toEqual([])
  })
  it('CC4 · required claim references a vanished component → ORPHAN_CONTROL_CLAIM', () => {
    const i = green(); i.claims.push({ id: 'claimGhost', invariant: 'x', component: 'goneComp', releaseCritical: true, state: 'PROVEN' })
    expect(codes(i)).toContain('ORPHAN_CONTROL_CLAIM')
  })
  it('CC5 · component changed since certification → CONTROL_EVIDENCE_INVALIDATED', () => {
    const i = green(); i.claims[0]!.liveComponentHash = 'h1-CHANGED'
    expect(codes(i)).toContain('CONTROL_EVIDENCE_INVALIDATED')
  })
  it('CC6 · trust-root component absent from the claim model → CONTROL_DECISION_DEPENDENCY_UNDECLARED', () => {
    const i = green(); i.trustRootComponents.push('undeclaredDecisionComp')
    expect(codes(i)).toContain('CONTROL_DECISION_DEPENDENCY_UNDECLARED')
  })
  it('MODEL_INCOMPLETE · an unproven release-critical control claim blocks → CONTROL_MODEL_INCOMPLETE', () => {
    const i = green(); i.claims[0]!.state = 'NOT_PROVEN'
    const r = evaluateControlCompleteness(i)
    expect(r.modelIncomplete).toBe(true)
    expect(r.blockers.map((b) => b.code)).toContain('CONTROL_MODEL_INCOMPLETE')
  })
  it('NOT_APPLICABLE_WITH_PROOF does not block (justified non-applicability)', () => {
    const i = green(); i.claims[0]!.state = 'NOT_APPLICABLE_WITH_PROOF'
    expect(evaluateControlCompleteness(i).modelIncomplete).toBe(false)
  })
})
