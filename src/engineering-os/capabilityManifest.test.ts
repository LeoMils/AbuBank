/*
 * CAPABILITY-MANIFEST drift/reachability adversarial suite (§14). Sensitivity + specificity.
 */
import { describe, it, expect } from 'vitest'
import { evaluateCapabilityManifest, type ManifestInput, type CapabilitySignal } from './capabilityManifest'

function green(): ManifestInput {
  const signals: CapabilitySignal[] = [
    { id: 'AbuAI', source: 'SCREEN_DIR', type: 'UI_SURFACE' }, { id: 'AbuAI', source: 'SCREEN_ENUM', type: 'UI_SURFACE' }, { id: 'AbuAI', source: 'NAV', type: 'UI_SURFACE' },
    { id: 'Live', source: 'SCREEN_DIR', type: 'VOICE_CHANNEL' }, { id: 'Live', source: 'ROUTE', type: 'VOICE_CHANNEL' },
    { id: 'set_reminder', source: 'TOOL_REGISTRY', type: 'ACTION_CAPABILITY' },
    { id: 'internalHelper', source: 'SCREEN_DIR', type: 'UI_SURFACE' },
  ]
  return {
    signals,
    classifications: {
      AbuAI: { reachability: 'USER_REACHABLE', riskTier: 'high' },
      Live: { reachability: 'USER_REACHABLE', riskTier: 'high' },
      set_reminder: { reachability: 'USER_INVOKABLE', riskTier: 'high' },
      internalHelper: { reachability: 'INTERNAL', exclusionProof: 'no route/nav/deep-link/action; dev-only diagnostics component' },
    },
    dynamicObserved: ['AbuAI', 'Live'],
  }
}
const codes = (i: ManifestInput) => evaluateCapabilityManifest(i).blockers.map((b) => b.code)

describe('capability manifest — green baseline', () => {
  it('a fully-classified manifest with proven exclusion has zero blockers', () => {
    expect(evaluateCapabilityManifest(green()).blockers).toEqual([])
  })
})

describe('capability manifest adversarial (drift + reachability)', () => {
  it('remove a real user capability from static while dynamic still sees it → CAPABILITY_DISCOVERY_OMISSION', () => {
    const i = green(); i.signals = i.signals.filter((s) => s.id !== 'Live') // Live gone from static, still dynamicObserved
    expect(codes(i)).toContain('CAPABILITY_DISCOVERY_OMISSION')
  })
  it('add an internal helper WITHOUT exclusion proof → UNPROVEN_SURFACE_EXCLUSION (sensitivity)', () => {
    const i = green(); delete i.classifications['internalHelper']!.exclusionProof
    expect(codes(i)).toContain('UNPROVEN_SURFACE_EXCLUSION')
  })
  it('a proven internal helper does NOT create a false user-facing requirement (specificity)', () => {
    const i = green() // internalHelper has a proof and is INTERNAL → excluded cleanly, no blocker
    expect(evaluateCapabilityManifest(i).blockers).toEqual([])
  })
  it('reclassify a user capability as INTERNAL without proof → UNPROVEN_SURFACE_EXCLUSION', () => {
    const i = green(); i.classifications['AbuAI'] = { reachability: 'INTERNAL', riskTier: 'high' }
    expect(codes(i)).toContain('UNPROVEN_SURFACE_EXCLUSION')
  })
  it('a high-risk UNKNOWN capability may not shrink the denominator → CAPABILITY_UNKNOWN_HIGH_RISK', () => {
    const i = green(); i.classifications['set_reminder'] = { reachability: 'UNKNOWN', riskTier: 'high' }
    expect(codes(i)).toContain('CAPABILITY_UNKNOWN_HIGH_RISK')
  })
  it('sources disagreeing on capability TYPE → CAPABILITY_SOURCE_CONFLICT', () => {
    const i = green(); i.signals.push({ id: 'AbuAI', source: 'TOOL_REGISTRY', type: 'ACTION_CAPABILITY' })
    expect(codes(i)).toContain('CAPABILITY_SOURCE_CONFLICT')
  })
})
