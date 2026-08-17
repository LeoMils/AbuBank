/*
 * stochasticCompleteness.test.ts — proof of the stochastic completeness oracle. (C6 / §14 / B11)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Every stochastic-exposed required claim must resolve (SAMPLING_REQUIRED w/ full policy, or
 * DETERMINISTICALLY_CLOSED w/ proof). The §14 attack: a model-dependent claim with no resolution must
 * BLOCK (UNSAMPLED>0). Uses the REAL claim set + plan; mutations are hermetic.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling of the CLI; shared verbatim, no types.
import { deriveStochasticState, classifyClaimStochastic } from '../../scripts/stochastic-completeness-lib.mjs'

const claimSet = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/REQUIRED_CLAIM_SET.json'), 'utf8')).claims
const plan = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/STOCHASTIC_PLAN.json'), 'utf8'))

describe('Stochastic Completeness Oracle (C6/§14)', () => {
  it('the real plan resolves EVERY stochastic-exposed claim (UNSAMPLED=0)', () => {
    const s = deriveStochasticState(claimSet(), plan())
    expect(s.unsampled).toEqual([])
    expect(s.UNSAMPLED_REQUIRED_CLAIMS).toBe(0)
    expect(s.STOCHASTIC_EXPOSED_CLAIMS_TOTAL).toBeGreaterThan(0)
    expect(s.ok).toBe(true)
  })

  it('THE §14 ATTACK: a model-dependent claim with no resolution → UNSAMPLED>0, BLOCK', () => {
    const cs = [...claimSet(), { id: 'new-voice-claim', capability: 'whatsapp-message-generation', risk: 'high' }]
    // capability is stochastic, but plan has no resolution for the new id → must be flagged.
    const s = deriveStochasticState(cs, plan())
    expect(s.unsampled).toContain('new-voice-claim')
    expect(s.ok).toBe(false)
  })

  it('MUTATION: SAMPLING_REQUIRED without a complete policy (missing N/threshold) → UNSAMPLED', () => {
    const p = plan()
    p.resolutions.calendar = { mode: 'SAMPLING_REQUIRED' } // stripped of N/threshold/rules
    const s = deriveStochasticState(claimSet(), p)
    expect(s.unsampled).toContain('calendar')
    expect(s.ok).toBe(false)
  })

  it('MUTATION: DETERMINISTICALLY_CLOSED without proof → UNSAMPLED', () => {
    const p = plan()
    p.resolutions['historical-corpus'] = { mode: 'DETERMINISTICALLY_CLOSED_WITH_PROOF' } // no deterministicProof
    const s = deriveStochasticState(claimSet(), p)
    expect(s.unsampled).toContain('historical-corpus')
    expect(s.ok).toBe(false)
  })

  it('classifier marks provider/model claims stochastic and pure-static claims not', () => {
    expect(classifyClaimStochastic({ capability: 'whatsapp-message-generation' })).toBe(true)
    expect(classifyClaimStochastic({ capability: 'deployed-secret-safety' })).toBe(false)
  })
})
