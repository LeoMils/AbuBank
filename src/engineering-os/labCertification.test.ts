/*
 * LAB-CERTIFICATION adversarial suite (Stage 3C §11). LC1–LC6.
 * A green result is admissible ONLY from a certified lab; a lab missing any required proof is
 * uncertified; a calibration/real detector additionally needs path-equivalence + blindness.
 */
import { describe, it, expect } from 'vitest'
import { evaluateLabCertifications, isLabCertified, isEvidenceAdmissible, certifiedLabs, type LabCertification } from './labCertification'

const lab = (labId: string, proofs: Partial<LabCertification['proofs']> = {}, requiresPathEquivalence = false): LabCertification =>
  ({ labId, scope: 's', boundVersion: 'v', requiresPathEquivalence, proofs: { sensitivity: true, restoration: true, specificity: true, ...proofs } })

describe('lab certification — required proofs', () => {
  it('LC1 · a lab with sensitivity+restoration+specificity is certified', () => {
    expect(isLabCertified(lab('x')).ok).toBe(true)
  })
  it('LC2 · missing sensitivity → uncertified (an always-pass lab)', () => {
    expect(isLabCertified(lab('x', { sensitivity: false })).ok).toBe(false)
  })
  it('LC3 · missing specificity → uncertified (an always-fail / false-positive lab)', () => {
    expect(isLabCertified(lab('x', { specificity: false })).ok).toBe(false)
  })
  it('LC4 · a calibration/real detector without path-equivalence → uncertified', () => {
    expect(isLabCertified(lab('d', {}, true)).ok).toBe(false)
    expect(isLabCertified(lab('d', { pathEquivalence: true, faultInjectionBlindness: true }, true)).ok).toBe(true)
  })
})

describe('lab certification — admissibility gate', () => {
  it('LC5 · a green result from an UNCERTIFIED lab is inadmissible; from a certified lab, admissible', () => {
    const certs = [lab('good'), lab('bad', { sensitivity: false })]
    expect(isEvidenceAdmissible('good', true, certs)).toBe(true)
    expect(isEvidenceAdmissible('bad', true, certs)).toBe(false)
    expect(isEvidenceAdmissible('unknown', true, certs)).toBe(false)
    expect(isEvidenceAdmissible('good', false, certs)).toBe(false) // a non-green result is not admissible-as-pass
  })
})

describe('lab certification — the stage-3c registry', () => {
  it('LC6 · every registered release-critical lab is certified; the reachability detector proves path-equivalence', () => {
    const r = evaluateLabCertifications(certifiedLabs())
    expect(r.uncertified).toEqual([])
    expect(r.certified).toContain('bundleSecretScan')
    expect(r.certified).toContain('dynamicReachability')
    expect(r.certified.length).toBeGreaterThanOrEqual(10)
  })
})
