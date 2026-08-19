/**
 * Autonomous Intelligence Gauntlet — 5,000 generated multi-turn conversations
 * through the real pipeline. GREEN only at 0 strict-rule violations.
 *   npx vitest run src/eval/autonomousIntelligenceGauntlet.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runGauntletBatch } from './autonomousIntelligenceGauntlet'

const SCALE = 5000

describe('Autonomous Intelligence Gauntlet', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterAll(() => vi.useRealTimers())
  beforeEach(() => {
    const s: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: (k: string) => { delete s[k] }, clear: () => { for (const k of Object.keys(s)) delete s[k] } })
  })

  it(`${SCALE} multi-turn conversations produce 0 strict-rule violations`, () => {
    const rep = runGauntletBatch(SCALE, 0)
    // eslint-disable-next-line no-console
    console.log(`[AUTONOMOUS] ${rep.conversations} convos · ${rep.turns} turns · ${rep.violations} violations`)
    if (!rep.passed) {
      // eslint-disable-next-line no-console
      console.log('[ROOT CAUSES]\n' + Object.entries(rep.byRule).map(([r, d]) => `  ${r} ×${d.count}\n    ${d.samples.join('\n    ')}`).join('\n'))
    }
    expect(rep.violations).toBe(0)
  })

  // 3 INDEPENDENT adversarial discovery rounds (different seed offsets → different
  // conversations/mutations). All must stay green.
  it.each([100_000, 500_000, 900_000])('adversarial discovery round @offset %i is clean', (offset) => {
    const rep = runGauntletBatch(2000, offset)
    if (!rep.passed) {
      // eslint-disable-next-line no-console
      console.log(`[ROUND @${offset}]\n` + Object.entries(rep.byRule).map(([r, d]) => `  ${r} ×${d.count}: ${d.samples[0]}`).join('\n'))
    }
    expect(rep.violations).toBe(0)
  })
})
