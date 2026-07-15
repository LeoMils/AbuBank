/*
 * Regression: "why …" knowledge question vs. "why …" challenge (Cycle 2, RED-first)
 * ════════════════════════════════════════════════════════════════════════════════
 * First divergence (probe evidence): WHY_RE began with `^למה(?![א-ת])`, matching ANY
 * input that starts with "למה " — so an innocent knowledge question ("למה השמיים
 * כחולים?", why is the sky blue) was classified as a frustration CHALLENGE and answered
 * with an apology ("לא הייתי מספיק ברורה") instead of the actual answer. The broad
 * catch-all is only needed for BARE "למה?"; real challenge phrasings have their own
 * specific alternatives (למה לא קבעת / למה אין לך / למה אצלך …).
 *
 * Drives the REAL ExecutiveCognitiveController for the routing assertions, and the
 * isWhyChallenge predicate directly for the boundary. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import { isWhyChallenge } from './conversationOS'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = {
  llm: async () => 'השמיים נראים כחולים בגלל פיזור של אור השמש באטמוספירה.',
  online: async () => ({ ok: true, answer: '' }),
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('"why" knowledge question is answered, not treated as frustration', () => {
  it('"למה השמיים כחולים?" → general knowledge (LLM), NOT frustration', async () => {
    const r = await ask('למה השמיים כחולים?')
    expect(r.intent).not.toBe('frustration')
    expect(r.source).toBe('llm')
    expect(r.display).not.toMatch(/לא הייתי מספיק ברורה|תגידי לי שוב/u)
  })

  it('"למה יורד גשם?" → general knowledge (LLM), NOT frustration', async () => {
    const r = await ask('למה יורד גשם?')
    expect(r.intent).not.toBe('frustration')
    expect(r.source).toBe('llm')
  })
})

describe('genuine "why" challenges are still detected (no regression)', () => {
  it('bare "למה" is still a challenge', () => {
    expect(isWhyChallenge('למה')).toBe(true)
    expect(isWhyChallenge('למה?')).toBe(true)
  })
  it('specific challenge phrasings stay challenges', () => {
    expect(isWhyChallenge('למה אין לך אפשרות?')).toBe(true)
    expect(isWhyChallenge('למה לא קבעת?')).toBe(true)
    expect(isWhyChallenge('למה לא קבעת')).toBe(true)
    expect(isWhyChallenge('למה אצלך זה אף פעם לא עובד')).toBe(true)
    expect(isWhyChallenge('מה הסיבה')).toBe(true)
  })
  it('a "why <knowledge topic>" question is NOT a challenge', () => {
    expect(isWhyChallenge('למה השמיים כחולים')).toBe(false)
    expect(isWhyChallenge('למה ים המלח מלוח')).toBe(false)
    expect(isWhyChallenge('למה אנחנו חולמים')).toBe(false)
  })
})
