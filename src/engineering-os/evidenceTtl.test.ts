/*
 * evidenceTtl.test.ts — proof of evidence TTL + external-drift invalidation. (§13/§29/B8)
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { isExpired, driftInvalidated, evidenceValid, TTL_HOURS } from '../../scripts/evidence-ttl-lib.mjs'

describe('Evidence TTL + drift (§13/§29/B8)', () => {
  it('deterministic evidence never time-expires; current-info expires fast', () => {
    expect(isExpired('DETERMINISTIC', 100000)).toBe(false)
    expect(isExpired('CURRENT_INFO', 7)).toBe(true)
    expect(isExpired('CURRENT_INFO', 2)).toBe(false)
  })

  it('provider-backed evidence expires after its TTL', () => {
    expect(isExpired('PROVIDER_BACKED', TTL_HOURS.PROVIDER_BACKED + 1)).toBe(true)
  })

  it('an unknown evidence class is fail-closed (treated expired)', () => {
    expect(isExpired('MYSTERY', 1)).toBe(true)
  })

  it('THE §29 ATTACK: provider/model drift invalidates evidence with NO code commit', () => {
    const d = driftInvalidated({ modelIdentity: 'gpt-realtime-v1' }, { modelIdentity: 'gpt-realtime-v2' })
    expect(d.invalidated).toBe(true)
    expect(d.driftedKeys).toContain('modelIdentity')
  })

  it('no drift + within TTL → valid; drift → invalid even if fresh', () => {
    expect(evidenceValid('PROVIDER_BACKED', 1, { modelIdentity: 'a' }, { modelIdentity: 'a' }).valid).toBe(true)
    expect(evidenceValid('PROVIDER_BACKED', 1, { modelIdentity: 'a' }, { modelIdentity: 'b' }).valid).toBe(false)
  })
})
