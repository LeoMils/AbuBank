/*
 * Regression: national/civic days route to live retrieval, never a wrong date (Cycle 15)
 * ═════════════════════════════════════════════════════════════════════════════════════
 * Device failure: "wrong Independence Day (gave 2024, then a past date)". National/civic
 * days (Independence, Memorial, Holocaust, Jerusalem Day) are NOT in the deterministic
 * religious-holiday table, and their Gregorian date is nidche-adjusted (postponement rules)
 * — so they must be answered by live retrieval, NEVER from model memory and NEVER from the
 * today-returning date_query.
 *
 * Two confirmed RED cases before this cycle:
 *   • "באיזה תאריך יום העצמאות?" → date_query → returned TODAY (confidently wrong).
 *   • "מתי חג העצמאות" / Spanish "día de la independencia" / "יום ירושלים" → LLM.
 *
 * Drives the REAL controller. Evidence class: CODE (routing). Whether the LIVE provider
 * returns the correct date is PREVIEW-class and out of scope here.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_ANSWER_A_CIVIC_DATE]', online: async (q: string) => ({ ok: true, answer: `[ONLINE:${q}]` }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('national/civic days route online, never a wrong/hallucinated date', () => {
  it('"באיזה תאריך יום העצמאות?" → online, NEVER today', async () => {
    const r = await ask('באיזה תאריך יום העצמאות?')
    expect(r.intent).toBe('online')
    expect(r.display).not.toContain('15 ביולי')
  })
  it('"מתי יום העצמאות הבא?" → online', async () => {
    expect((await ask('מתי יום העצמאות הבא?')).intent).toBe('online')
  })
  it('"מתי חג העצמאות?" → online (not LLM)', async () => {
    const r = await ask('מתי חג העצמאות?')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('online')
  })
  it('"מתי יום ירושלים?" → online (not LLM)', async () => {
    const r = await ask('מתי יום ירושלים?')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('online')
  })
  it('Spanish "¿cuándo es el día de la independencia?" → online (not LLM)', async () => {
    const r = await ask('¿cuándo es el día de la independencia?')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('online')
  })
})

describe('deterministic religious holidays + relative dates are NOT hijacked', () => {
  it('"מתי ראש השנה הבא?" stays deterministic (in the table)', async () => {
    const r = await ask('מתי ראש השנה הבא?')
    expect(r.source).toBe('deterministic')
    expect(r.display).toContain('ראש השנה')
  })
  it('"איזה תאריך היה אתמול?" stays a deterministic relative-date answer', async () => {
    const r = await ask('איזה תאריך היה אתמול?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('14 ביולי')
  })
})
