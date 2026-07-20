/*
 * P6 · no-fabrication hard law. An LLM answer may never assert a specific appointment
 * (the "1 באוקטובר" class); the guard neutralizes it to an honest calendar deferral.
 * Ordinary prose + historical dates pass untouched, and the deterministic calendar
 * engine is trusted.
 */
import { describe, it, expect } from 'vitest'
import { guardNoFabricatedCalendar } from './noFabricationGuard'
import { runFullTurn, type FullTurnTools } from './runtimeFullTurn'
import { IDLE_RUNTIME, type RuntimeContext } from './cognitiveRuntime'

describe('P6 · guardNoFabricatedCalendar (unit)', () => {
  it('scrubs a fabricated appointment from an LLM answer', () => {
    const r = guardNoFabricatedCalendar('יש לך פגישה עם הרופא ב-1 באוקטובר בשלוש', 'llm')
    expect(r.scrubbed).toBe(true)
    expect(r.text).not.toMatch(/אוקטובר/)
    expect(r.text).toContain('יומן')
  })
  it('scrubs a fabricated "ביום שלישי בשעה 3" appointment claim', () => {
    expect(guardNoFabricatedCalendar('קבעתי לך תור ביום שלישי בשעה 3', 'llm').scrubbed).toBe(true)
  })
  it('a HISTORICAL date in prose is NOT scrubbed (no appointment frame)', () => {
    const r = guardNoFabricatedCalendar('המהפכה הצרפתית פרצה ב-1789.', 'llm')
    expect(r.scrubbed).toBe(false)
    expect(r.text).toContain('1789')
  })
  it('the DETERMINISTIC calendar engine is trusted (never scrubbed)', () => {
    const r = guardNoFabricatedCalendar('יש לך פגישה עם מור מחר בשעה 15:00.', 'deterministic')
    expect(r.scrubbed).toBe(false)
  })
  it('warm chit-chat with no appointment claim passes', () => {
    expect(guardNoFabricatedCalendar('איזה כיף לשמוע ממך! ספרי לי עוד.', 'llm').scrubbed).toBe(false)
  })
})

describe('P6 · live — a fabricated appointment from the LLM never reaches the answer', () => {
  const ctx: RuntimeContext = { messages: [], now: new Date('2026-07-20T09:00:00Z') }
  it('an LLM that invents an appointment is neutralized to an honest deferral', async () => {
    const tools: FullTurnTools = {
      llm: async () => 'יש לך פגישה עם הרופא ב-1 באוקטובר בשלוש.', // hallucinated calendar claim
      online: async () => ({ ok: false, answer: '', reason: 'unused' }),
    }
    // A general (non-calendar) prompt routes to the LLM; its fabricated appointment must be scrubbed.
    const r = await runFullTurn(IDLE_RUNTIME, 'ספרי לי משהו', ctx, tools)
    expect(r.display).not.toMatch(/אוקטובר/)
  })
})
