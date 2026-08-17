/*
 * criticalJourneys.test.ts — cross-surface journeys tied to proven capabilities. (§42/B10)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { evidenceSurvivesChange } from '../../scripts/change-impact-lib.mjs'

const journeys = () => JSON.parse(readFileSync(resolve('docs/engineering-os/qa/CRITICAL_JOURNEYS.json'), 'utf8')).journeys
const claimCaps = () => new Set(JSON.parse(readFileSync(resolve('docs/engineering-os/qa/REQUIRED_CLAIM_SET.json'), 'utf8')).claims.map((c: { capability: string }) => c.capability))

describe('critical user journeys (§42/B10)', () => {
  it('has journeys and each has ordered steps + capabilities', () => {
    const js = journeys()
    expect(js.length).toBeGreaterThan(0)
    for (const j of js) {
      expect(j.steps.length, j.id).toBeGreaterThan(1)
      expect(j.capabilities.length, j.id).toBeGreaterThan(0)
    }
  })

  it('every capability a journey exercises is an admitted Required-Claim-Set capability', () => {
    const caps = claimCaps()
    for (const j of journeys()) for (const c of j.capabilities) expect(caps.has(c), `${j.id} → ${c}`).toBe(true)
  })

  it('a relevant runtime change invalidates the journey proof (change-impact link)', () => {
    // Changing the voice pipeline must invalidate the voice journey (via its stt-tts-roundtrip capability).
    const voiceJourney = journeys().find((j: { id: string }) => j.id === 'voice-tool-action-interruption-recovery')
    const anyAffected = voiceJourney.capabilities.some((c: string) => !evidenceSurvivesChange(c, ['src/services/voice.ts']).reuse)
    expect(anyAffected).toBe(true)
  })
})
