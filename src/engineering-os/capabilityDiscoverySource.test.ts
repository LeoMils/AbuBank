/*
 * SOURCE-COMPLETENESS adversarial suite (Stage 3C §4). SC1–SC7 spec-derived.
 * SC1–SC4 : a capability registered through a non-screen/non-tool mechanism must make
 *           its source class DISCOVERED as release-relevant (so absence-of-coverage blocks).
 * SC5     : a harmless internal helper source must NOT create a false user capability.
 * SC6     : removing a release-relevant class from producer coverage → UNCOVERED (sensitivity).
 * SC7     : a new unclassified registration mechanism → UNKNOWN blocker.
 * Plus green baseline (non-vacuity) and the REAL current-repo manifest assertion.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateSourceCompleteness,
  currentDiscoverySourceManifest,
  type DiscoverySourceClass,
  type SourceCompletenessInput,
} from './capabilityDiscoverySource'

const codes = (i: SourceCompletenessInput) => evaluateSourceCompleteness(i).blockers.map((b) => b.code)

/** A fully-covered, all-release-relevant baseline (the producer reads every class). */
function covered(): SourceCompletenessInput {
  return {
    sourceClasses: [
      { id: 'SCREEN_DIR', mechanism: 'screens/*', relevance: 'RELEASE_RELEVANT', coveredByProducer: true },
      { id: 'TOOL_REGISTRY', mechanism: 'liveTools', relevance: 'RELEASE_RELEVANT', coveredByProducer: true },
    ],
  }
}

describe('source-completeness — green baseline (non-vacuity)', () => {
  it('a fully-covered release-relevant source set yields zero blockers and complete=true', () => {
    const r = evaluateSourceCompleteness(covered())
    expect(r.blockers).toEqual([])
    expect(r.complete).toBe(true)
  })
})

describe('source-completeness adversarial SC1–SC7', () => {
  const route: DiscoverySourceClass = { id: 'DEEP_LINK_ROUTE', mechanism: '?x=1 route', relevance: 'RELEASE_RELEVANT', coveredByProducer: false }

  it('SC1 · a route-based capability class absent from producer coverage → UNCOVERED', () => {
    const i = covered(); i.sourceClasses.push(route)
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
  })
  it('SC2 · a deep-link-only class absent from coverage → UNCOVERED', () => {
    const i = covered(); i.sourceClasses.push({ id: 'DEEP_LINK_ONLY', mechanism: '/deep/path', relevance: 'RELEASE_RELEVANT', coveredByProducer: false })
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
  })
  it('SC3 · a registered user action without a UI screen (flag registry) absent → UNCOVERED', () => {
    const i = covered(); i.sourceClasses.push({ id: 'DEVICE_GATED_FLAG', mechanism: 'flag registry', relevance: 'RELEASE_RELEVANT', coveredByProducer: false })
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
  })
  it('SC4 · a background/PWA user-affecting class absent → UNCOVERED (when release-relevant)', () => {
    const i = covered(); i.sourceClasses.push({ id: 'BG_SYNC', mechanism: 'sw background handler', relevance: 'RELEASE_RELEVANT', coveredByProducer: false })
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
  })
  it('SC5 · a harmless internal helper (excluded WITH proof) → NO false capability/blocker (specificity)', () => {
    const i = covered(); i.sourceClasses.push({ id: 'INTERNAL_UTIL', mechanism: 'src/lib/utils', relevance: 'NON_RELEASE_RELEVANT_WITH_PROOF', coveredByProducer: false, exclusionProof: 'pure helpers, no user entry point' })
    expect(evaluateSourceCompleteness(i).blockers).toEqual([])
  })
  it('SC6 · removing a release-relevant class from producer coverage → UNCOVERED (sensitivity)', () => {
    const i = covered(); i.sourceClasses[0]!.coveredByProducer = false
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
  })
  it('SC7 · a new unclassified registration mechanism → UNKNOWN blocker', () => {
    const i = covered(); i.sourceClasses.push({ id: 'NEW_MECH', mechanism: 'freshly appeared registry', relevance: 'UNKNOWN', coveredByProducer: false })
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_SOURCE_UNKNOWN')
  })
  it('SPECIFICITY · an exclusion claimed WITHOUT proof → INVALID_SOURCE_EXCLUSION', () => {
    const i = covered(); i.sourceClasses.push({ id: 'BOGUS_EXCLUDE', mechanism: 'x', relevance: 'NON_RELEASE_RELEVANT_WITH_PROOF', coveredByProducer: false })
    expect(codes(i)).toContain('INVALID_SOURCE_EXCLUSION')
  })
})

describe('source-completeness — the REAL current-repo manifest (0.286)', () => {
  it('proves the static 33 is NOT source-complete: DEVICE_GATED_FLAG, ONLINE_FLAG, DEEP_LINK_ROUTE are uncovered', () => {
    const r = evaluateSourceCompleteness({ sourceClasses: currentDiscoverySourceManifest() })
    expect(r.complete).toBe(false)
    const uncovered = r.blockers.filter((b) => b.code === 'CAPABILITY_DISCOVERY_SOURCE_UNCOVERED')
    expect(uncovered.length).toBe(3)
    // The exclusion-proof classes (API_ROUTE, PWA_MANIFEST, SERVICE_WORKER) must NOT block.
    expect(r.blockers.some((b) => b.code === 'INVALID_SOURCE_EXCLUSION')).toBe(false)
    expect(r.distribution.EXCLUDED_WITH_PROOF).toBe(3)
    expect(r.distribution.COVERED).toBe(3)
  })
})
