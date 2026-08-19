/*
 * DYNAMIC-REACHABILITY DETECTOR CALIBRATION (Stage 3C §4, §7). DR1–DR7 spec-derived.
 * These run against ISOLATED fixtures (the DETECTOR_CALIBRATION_TARGET) — NO deployment
 * is mutated. They prove the reconciliation detector's sensitivity, specificity and
 * restoration, and that the SAME core (reconcile) is used for calibration and real runs
 * (path-equivalence). Only after this may the detector's real-RC output be trusted.
 */
import { describe, it, expect } from 'vitest'
import { reconcile, reconcileCapability, type CapabilityReconInput } from './dynamicReachability'

const cap = (o: Partial<CapabilityReconInput> & { id: string }): CapabilityReconInput =>
  ({ inStatic: true, observedReachable: false, ...o })

describe('dynamic-reachability calibration DR1–DR7 (isolated target)', () => {
  it('DR1 · static + observed reachable → STATIC_AND_DYNAMIC_CONFIRMED (in universe)', () => {
    const r = reconcileCapability(cap({ id: 'AbuAI', observedReachable: true }))
    expect(r.state).toBe('STATIC_AND_DYNAMIC_CONFIRMED'); expect(r.inCanonicalUniverse).toBe(true)
  })
  it('DR2 · SEED a dynamic-only capability (observed, not static) → DYNAMIC_ONLY_CAPABILITY_OMISSION, enters universe', () => {
    const r = reconcileCapability(cap({ id: 'seeded_dynamic_route', inStatic: false, observedReachable: true }))
    expect(r.state).toBe('DYNAMIC_ONLY_CAPABILITY_OMISSION'); expect(r.inCanonicalUniverse).toBe(true)
  })
  it('DR3 · SEED a state-dependent static cap whose state was NOT exercised → STATE_COVERAGE_INCOMPLETE (NOT internal), stays in universe', () => {
    const r = reconcileCapability(cap({ id: 'auth_only_surface', enablingStateExercised: false }))
    expect(r.state).toBe('STATE_COVERAGE_INCOMPLETE'); expect(r.inCanonicalUniverse).toBe(true)
  })
  it('DR4 · a legitimate internal helper WITH proof → INTERNAL_WITH_PROOF, excluded (not promoted)', () => {
    const r = reconcileCapability(cap({ id: 'internal_util', enablingStateExercised: true, internalProof: 'no user entry point; called only by services' }))
    expect(r.state).toBe('INTERNAL_WITH_PROOF'); expect(r.inCanonicalUniverse).toBe(false)
  })
  it('DR5 · exercised static cap, still not observed, no proof/explanation → UNKNOWN (conflict), conservatively in universe', () => {
    const r = reconcileCapability(cap({ id: 'ghost', enablingStateExercised: true }))
    expect(r.state).toBe('UNKNOWN'); expect(r.inCanonicalUniverse).toBe(true)
  })
  it('DR6 · exercised static cap not observed but WITH valid explanation → STATIC_ONLY_WITH_VALID_EXPLANATION, in universe', () => {
    const r = reconcileCapability(cap({ id: 'ear_gated', enablingStateExercised: true, validExplanation: 'ships OFF awaiting owner ear (device-gated flag)' }))
    expect(r.state).toBe('STATIC_ONLY_WITH_VALID_EXPLANATION'); expect(r.inCanonicalUniverse).toBe(true)
  })
  it('DR7 · RESTORATION — removing the seeded controlled cases returns a clean, canonical-proven report', () => {
    const clean = reconcile([
      cap({ id: 'AbuAI', observedReachable: true }),
      cap({ id: 'read_calendar', observedReachable: true }),
    ])
    expect(clean.canonicalProven).toBe(true)
    expect(clean.blockers).toEqual([])
    expect(clean.distribution.DYNAMIC_ONLY_CAPABILITY_OMISSION).toBe(0)
  })
})

describe('dynamic-reachability — aggregate gate (o-capability PROVEN criteria)', () => {
  it('SENSITIVITY · any omission / unknown / incomplete-coverage blocks canonical-proven', () => {
    const r = reconcile([
      cap({ id: 'AbuAI', observedReachable: true }),
      cap({ id: 'seeded', inStatic: false, observedReachable: true }), // omission
    ])
    expect(r.canonicalProven).toBe(false)
    expect(r.blockers.some((b) => b.code === 'DYNAMIC_ONLY_CAPABILITY_OMISSION')).toBe(true)
  })
  it('SPECIFICITY · a fully-confirmed set with a proven-internal helper is canonical-proven and excludes the helper', () => {
    const r = reconcile([
      cap({ id: 'AbuAI', observedReachable: true }),
      cap({ id: 'internal_util', enablingStateExercised: true, internalProof: 'no user entry point' }),
    ])
    expect(r.canonicalProven).toBe(true)
    expect(r.canonicalUniverse).toEqual(['AbuAI'])
  })
  it('NON-VACUITY / PATH-EQUIVALENCE · reconcile() delegates to the SAME reconcileCapability core', () => {
    const input = cap({ id: 'x', observedReachable: true })
    expect(reconcile([input]).results[0]).toEqual(reconcileCapability(input))
  })
})
