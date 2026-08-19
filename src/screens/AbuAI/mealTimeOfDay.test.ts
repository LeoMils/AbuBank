/*
 * Regression: meal context disambiguates a bare hour (Cycle 7, RED-first)
 * ══════════════════════════════════════════════════════════════════════
 * Probe evidence (C4): "קבעי ארוחת ערב עם אנבל ביום שישי בשמונה" resolved the bare
 * "בשמונה" to 08:00 (morning) and confirmed "בשמונה בבוקר" — an 8 AM dinner. The bare
 * hour was flagged ambiguous and defaulted to the AM reading because "ארוחת ערב" (dinner)
 * was not a recognized period hint (PERIOD_PM matched only "בערב"/"הערב", not bare "ערב").
 *
 * A meal noun carries the time of day: dinner = evening, breakfast = morning. Drives both
 * the time parser (unit) and the REAL controller (user-facing confirmation). Evidence: CODE.
 */
import { describe, it, expect } from 'vitest'
import { parseHebrewTimeDetailed } from './calendarCreate'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

describe('parseHebrewTimeDetailed — meal context sets the period', () => {
  it('"ארוחת ערב … בשמונה" (dinner) → 20:00, not ambiguous', () => {
    const r = parseHebrewTimeDetailed('ארוחת ערב עם אנבל ביום שישי בשמונה')
    expect(r.time).toBe('20:00')
    expect(r.ambiguous).toBe(false)
  })
  it('"ארוחת בוקר … בשמונה" (breakfast) → 08:00', () => {
    const r = parseHebrewTimeDetailed('ארוחת בוקר בשמונה')
    expect(r.time).toBe('08:00')
  })
  it('a bare "בשמונה" with NO meal/period context stays ambiguous (unchanged)', () => {
    const r = parseHebrewTimeDetailed('פגישה עם דני בשמונה')
    expect(r.ambiguous).toBe(true)
  })
})

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

describe('controller: dinner is scheduled in the evening', () => {
  it('"קבעי ארוחת ערב עם אנבל ביום שישי בשמונה" confirms evening, never 8 AM', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'קבעי ארוחת ערב עם אנבל ביום שישי בשמונה', ctx(), TOOLS)
    const d = (r.display ?? '').replace(/\s+/g, ' ')
    expect(d).not.toContain('בבוקר')
    expect(d).toMatch(/בערב|20:00/u)
  })
})
