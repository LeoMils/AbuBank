import { describe, it, expect } from 'vitest'
import {
  RATES, costBefore, costAfter, compareLifecycle, qualityBugCost,
  representative20MinSession, costSessionWithUpstream, IDLE_TAIL_MINUTES,
  type SessionProfile,
} from './aiCostModel'

const P = representative20MinSession()

describe('aiCostModel — rates are a single sane source', () => {
  it('audio output is the dominant rate, FX is positive', () => {
    expect(RATES.audioOutputUsdPerMin).toBeGreaterThan(RATES.audioInputUsdPerMin)
    expect(RATES.usdToIls).toBeGreaterThan(0)
  })
})

describe('aiCostModel — before/after the lifecycle idle-stop', () => {
  it('BEFORE bills the mic upstream for the WHOLE session', () => {
    const b = costBefore(P)
    expect(b.billedUpstreamMinutes).toBe(P.totalMinutes)
    // audio input = 20 min * rate
    expect(b.audioInputUsd).toBeCloseTo(20 * RATES.audioInputUsdPerMin, 4)
  })

  it('AFTER bills upstream only for active speech + a ~12s tail per idle gap', () => {
    const a = costAfter(P)
    const expectedUpstream = P.activeUserMinutes + P.idleGaps * IDLE_TAIL_MINUTES
    expect(a.billedUpstreamMinutes).toBeCloseTo(expectedUpstream, 2)
    expect(a.billedUpstreamMinutes).toBeLessThan(P.totalMinutes)
  })

  it('the lifecycle produces a real, positive saving (₪ and %)', () => {
    const c = compareLifecycle(P)
    expect(c.savingUsd).toBeGreaterThan(0)
    expect(c.savingIls).toBeGreaterThan(0)
    expect(c.savingPct).toBeGreaterThan(0)
    // Sanity: after < before, saving = before - after.
    expect(c.after.totalUsd).toBeLessThan(c.before.totalUsd)
    expect(c.savingUsd).toBeCloseTo(c.before.totalUsd - c.after.totalUsd, 4)
  })

  it('Abu output audio + text are UNCHANGED by the lifecycle (only idle upstream is saved)', () => {
    // Quality must not drop: the saving is purely eliminated idle mic streaming,
    // never Abu speaking less. Output audio + text cost identical before/after.
    const c = compareLifecycle(P)
    expect(c.after.audioOutputUsd).toBe(c.before.audioOutputUsd)
    expect(c.after.textUsd).toBe(c.before.textUsd)
    // The delta is exactly the saved upstream audio-input minutes.
    const savedUpstream = c.before.billedUpstreamMinutes - c.after.billedUpstreamMinutes
    expect(c.savingUsd).toBeCloseTo(savedUpstream * RATES.audioInputUsdPerMin, 4)
  })

  it('pins the representative 20-min headline numbers (report is CODE-proven)', () => {
    const c = compareLifecycle(P)
    // BEFORE: audioIn 20*0.06=1.20 + audioOut 4*0.24=0.96 + text 0.095 = 2.255
    expect(c.before.totalUsd).toBeCloseTo(2.255, 3)
    expect(c.before.totalIls).toBeCloseTo(8.34, 1)
    // AFTER: upstream 6.6 min → audioIn 0.396 + 0.96 + 0.095 = 1.451
    expect(c.after.billedUpstreamMinutes).toBeCloseTo(6.6, 2)
    expect(c.after.totalUsd).toBeCloseTo(1.451, 3)
    // SAVING: 0.804 USD ≈ ₪2.97 ≈ 35.7%
    expect(c.savingUsd).toBeCloseTo(0.804, 3)
    expect(c.savingIls).toBeCloseTo(2.97, 1)
    expect(c.savingPct).toBeCloseTo(35.7, 0)
  })

  it('quality-bug cost pins ~$0.24/session', () => {
    const q = qualityBugCost({ stalls: 4, avgRepeatOutputMinutes: 0.2, avgRepeatUpstreamMinutes: 0.15, repeatedFormulations: 6, tokensPerFormulation: 120 })
    expect(q.usd).toBeCloseTo(0.2424, 3)
  })

  it('a session with NO idle time saves nothing (no false savings)', () => {
    const busy: SessionProfile = { ...P, activeUserMinutes: 20, idleGaps: 0 }
    const c = compareLifecycle(busy)
    expect(c.savingUsd).toBe(0)
    expect(c.savingPct).toBe(0)
  })

  it('costSessionWithUpstream never bills negative upstream', () => {
    const c = costSessionWithUpstream(P, 0)
    expect(c.audioInputUsd).toBe(0)
    expect(c.audioOutputUsd).toBeGreaterThan(0) // Abu still spoke
  })
})

describe('aiCostModel — what the quality bugs cost', () => {
  it('stalls + repeated formulations produce a positive, quantified cost', () => {
    const q = qualityBugCost({
      stalls: 4,
      avgRepeatOutputMinutes: 0.2,
      avgRepeatUpstreamMinutes: 0.15,
      repeatedFormulations: 6,
      tokensPerFormulation: 120,
    })
    expect(q.usd).toBeGreaterThan(0)
    expect(q.ils).toBeCloseTo(q.usd * RATES.usdToIls, 2)
  })

  it('zero bugs cost zero', () => {
    const q = qualityBugCost({ stalls: 0, avgRepeatOutputMinutes: 0, avgRepeatUpstreamMinutes: 0, repeatedFormulations: 0, tokensPerFormulation: 0 })
    expect(q.usd).toBe(0)
  })
})
