/*
 * Intelligence gauntlet test — ≥500 scenarios, per-layer thresholds. Scores are
 * the real measured rates; the log prints every layer's actual pct.
 */
import { describe, it, expect } from 'vitest'
import { runIntelligenceGauntlet, type Layer } from './intelligenceHighGreenGauntlet'

const THRESHOLD: Record<Layer, number> = {
  meta: 95, goal: 95, dialogue: 95, family: 98, calendar: 95,
  online: 95, speech: 95, supervisor: 95, contradiction: 95,
}

describe('Intelligence High-Green Gauntlet (Phase 12)', () => {
  it('≥500 scenarios; each layer meets its threshold', () => {
    const { cases, layers } = runIntelligenceGauntlet()
    // eslint-disable-next-line no-console
    console.log(`[INTEL] total=${cases.length}\n` + layers.map(l => `  ${l.layer}: ${l.pct}% (${l.passed}/${l.total}) [need ${THRESHOLD[l.layer]}]`).join('\n'))
    expect(cases.length).toBeGreaterThanOrEqual(500)
    const below = layers.filter(l => l.pct < THRESHOLD[l.layer])
    expect(below.map(l => `${l.layer}:${l.pct}%`)).toEqual([])
  })
})
