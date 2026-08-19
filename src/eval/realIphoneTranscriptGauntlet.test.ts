/**
 * Real iPhone Transcript Gauntlet — master regression for Leo's failed session.
 * Every cluster must PASS (100%). If any fails, the transcript failure has
 * regressed. Run: npx vitest run src/eval/realIphoneTranscriptGauntlet.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runGauntlet, gauntletScore } from './realIphoneTranscriptGauntlet'

describe('Real iPhone Transcript Gauntlet', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-06-24T20:00:00')) })
  afterAll(() => vi.useRealTimers())
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem: (k: string) => { delete store[k] }, clear: () => { for (const k of Object.keys(store)) delete store[k] } })
  })

  it('every failure cluster from the transcript passes (100%)', () => {
    const results = runGauntlet()
    const score = gauntletScore(results)
    if (score.failures.length) {
      // eslint-disable-next-line no-console
      console.log('[GAUNTLET FAILURES]', score.failures.map(f => `${f.id}: ${f.title} — ${f.detail}`).join('\n'))
    }
    // eslint-disable-next-line no-console
    console.log(`[GAUNTLET] ${score.passed}/${score.total} = ${score.pct}%`)
    expect(score.pct).toBe(100)
  })

  it('exposes each cluster individually for regression pinpointing', () => {
    for (const c of runGauntlet()) {
      expect(c.pass, `${c.id} ${c.title} — ${c.detail}`).toBe(true)
    }
  })
})
