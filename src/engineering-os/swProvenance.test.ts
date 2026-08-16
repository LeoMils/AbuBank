/*
 * SW-PROVENANCE suite (Stage 3C §10). SW1–SW5.
 * The point: never upgrade WARM_SERVES from a read-only check. /sw.js 200 is PREVIEW, not device.
 */
import { describe, it, expect } from 'vitest'
import { evaluateSwProvenance } from './swProvenance'

const readOnlyOk = { swDeployed: true, swBytes: 2758, precacheReferencesCertifiedBundle: true }

describe('sw provenance — read-only hops vs device warm-serve', () => {
  it('SW1 · SW deployed + precache references certified bundle → control current (read-only)', () => {
    const r = evaluateSwProvenance(readOnlyOk)
    expect(r.controlCurrent).toBe(true)
    expect(r.blockers).toEqual([])
  })
  it('SW2 · control current does NOT prove WARM_SERVES without device evidence (no upgrade)', () => {
    const r = evaluateSwProvenance(readOnlyOk)
    expect(r.warmServesProven).toBe(false)
    expect(r.deviceLimits.length).toBeGreaterThan(0)
  })
  it('SW3 · WARM_SERVES proven only with device verification', () => {
    expect(evaluateSwProvenance({ ...readOnlyOk, warmClientVerifiedOnDevice: true }).warmServesProven).toBe(true)
  })
  it('SW4 · /sw.js not served → SW_NOT_DEPLOYED', () => {
    expect(evaluateSwProvenance({ ...readOnlyOk, swDeployed: false }).blockers.some((b) => b.code === 'SW_NOT_DEPLOYED')).toBe(true)
  })
  it('SW5 · precache does not reference the certified bundle → SW_PRECACHE_MISMATCH', () => {
    expect(evaluateSwProvenance({ ...readOnlyOk, precacheReferencesCertifiedBundle: false }).blockers.some((b) => b.code === 'SW_PRECACHE_MISMATCH')).toBe(true)
  })
})
