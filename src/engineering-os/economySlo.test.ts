/*
 * economySlo.test.ts — proof of the pre-declared QA-economy SLO judge. (§16/C8)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { judgeEconomy } from '../../scripts/economy-slo-lib.mjs'

const slo = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/QA_ECONOMY_SLO.json'), 'utf8'))

describe('QA Economy SLO judge (§16/C8)', () => {
  it('all three tiers are pre-declared with wall-clock + provider-call targets', () => {
    const s = slo()
    for (const tier of ['feature', 'rc', 'production']) {
      expect(s.tiers[tier].wallClockMsTarget, tier).toBeGreaterThan(0)
      expect(s.tiers[tier].providerCallTarget, tier).toBeGreaterThanOrEqual(0)
    }
  })

  it('a within-budget feature run MEETS the SLO', () => {
    const r = judgeEconomy(slo(), 'feature', { wallClockMs: 68219, networkAreaCount: 0 })
    expect(r.verdict).toBe('MET')
  })

  it('an over-budget run is MISSED (a finding), not silently passed', () => {
    const r = judgeEconomy(slo(), 'feature', { wallClockMs: 999999, networkAreaCount: 0 })
    expect(r.verdict).toBe('MISSED')
    expect(r.reasons.join(' ')).toMatch(/wall-clock/)
  })

  it('an undeclared tier is NO_SLO (never a silent pass)', () => {
    expect(judgeEconomy(slo(), 'bogus', {}).verdict).toBe('NO_SLO')
  })
})
