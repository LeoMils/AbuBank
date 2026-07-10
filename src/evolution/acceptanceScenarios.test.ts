/*
 * Evolution OS — end-to-end acceptance scenarios (Section 24).
 * Ties the modules together the way the mandate requires: a verified failure
 * becomes a first-divergence, a failure family, and an inert Improvement Bundle —
 * with unrelated facts preserved as controls.
 */
import { describe, it, expect } from 'vitest'
import { firstDivergence, earliestLayer, type DivergenceObservation } from './failureTaxonomy'
import { generalize, type FailureSeed } from './generalization'
import { buildBundle, candidateClassesForLayer } from './improvementBundle'

describe('Scenario C — voice/text divergence: identify the FIRST divergence', () => {
  it('picks the earliest failing layer, not the visible symptom', () => {
    // Same request; voice mangled the name at STT, everything downstream inherited it.
    const observations: DivergenceObservation[] = [
      { layer: 'response_reasoning', expected: 'Ofir is the granddaughter', actual: 'Ofer is the grandson', evidence: 'final answer' },
      { layer: 'entity_resolution', expected: 'entity=Ofir(f)', actual: 'entity=Ofer(m)', evidence: 'resolver output' },
      { layer: 'speech_to_text', expected: 'אופיר', actual: 'אופר', evidence: 'stt transcript' },
    ]
    const fd = firstDivergence(observations)!
    expect(fd.layer).toBe('speech_to_text')          // earliest, not response_reasoning
    expect(fd.laterMasked.map(o => o.layer)).toContain('entity_resolution')
  })
  it('earliestLayer respects causal precedence', () => {
    expect(earliestLayer(['response_reasoning', 'routing', 'speech_to_text'])).toBe('speech_to_text')
  })
})

describe('Scenario A/G chain — verified failure → family → bundle, controls preserved', () => {
  const seed: FailureSeed = {
    familyId: 'fam:ofir-gender',
    input: 'מי אופיר',
    expectation: 'answer with FEMALE forms (Ofir is the granddaughter)',
    language: 'he',
    modality: 'voice',
    entity: { name: 'אופיר', aliases: ['אופירי'], gender: 'female' },
    invariants: [{ input: 'מי עילי', expectation: 'Eili is the grandson (male) — unchanged' }],
  }

  it('generalizes into a diverse family with must_fix cases and preserved controls', () => {
    const fam = generalize(seed)
    const mustFix = fam.cases.filter(c => c.polarity === 'must_fix')
    const controls = fam.cases.filter(c => c.polarity === 'must_preserve')
    expect(mustFix.length).toBeGreaterThanOrEqual(4)             // seed + modality + alias + stt + pronoun + adversarial
    expect(controls.length).toBe(1)                              // the Eili invariant
    expect(fam.affectedDimensions).toContain('followup_pronoun') // gender continuity is covered
    expect(fam.cases.some(c => c.dimension === 'adversarial')).toBe(true)
  })

  it('builds an inert Improvement Bundle pointing at the right intervention classes', () => {
    const fam = generalize(seed)
    const bundle = buildBundle({
      bundleId: 'b1', title: 'Ofir gender/identity', domain: 'family', severity: 'P1',
      frequencyEstimate: 3, confidence: 0.8, family: fam, firstDivergenceLayer: 'entity_resolution',
      signals: [{ kind: 'user_correction', category: 'explicit', strength: 'gold', turnId: 't1', sessionId: 's', confidence: 0.9, polarity: 'failure', evidence: 'x' }],
      representativeTraceRefs: ['trace-1'], controlTraceRefs: ['trace-2'], createdAt: '2026-07-10T00:00:00Z',
      hypotheses: [{ hypothesis: 'resolver ignores gender token', status: 'SUPPORTED', supportingEvidenceRefs: ['trace-1'], contradictingEvidenceRefs: [], falsificationTest: 'feed clean name, expect female forms' }],
    })
    expect(bundle.requiredRegressions.length).toBeGreaterThanOrEqual(4)
    expect(bundle.counterexampleRefs.length).toBe(1)                       // the control travels with the bundle
    expect(bundle.candidateInterventionClasses).toEqual(candidateClassesForLayer('entity_resolution'))
    expect(bundle.provenance.redactionStatus).toBe('redacted')
    // Inert: fully JSON round-trippable, no live references.
    expect(() => JSON.parse(JSON.stringify(bundle))).not.toThrow()
  })
})
