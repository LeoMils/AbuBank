/*
 * Regression: "next <weekday>" date resolution (Cycle 17, RED-first)
 * ═════════════════════════════════════════════════════════════════
 * Widened-probe gap: "איזה תאריך יום שלישי הבא?" matched date_query and returned TODAY
 * (confidently wrong), and "מתי יום ראשון הבא?" fell to the LLM. dateReasoner handled
 * relative words + arithmetic but not "יום <weekday> הבא" (next weekday) — a deterministic
 * computation from ctx.now.
 *
 * now = Wed 2026-07-15 (getDay=3). Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_COMPUTE_A_WEEKDAY]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('"next <weekday>" resolves deterministically from ctx.now', () => {
  it('"מתי יום ראשון הבא?" → 19 ביולי (Sun), not LLM', async () => {
    const r = await ask('מתי יום ראשון הבא?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('19 ביולי')
  })
  it('"איזה תאריך יום שלישי הבא?" → 21 ביולי, NOT today', async () => {
    const r = await ask('איזה תאריך יום שלישי הבא?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('21 ביולי')
    expect(r.display).not.toContain('15 ביולי')
  })
  it('"מתי יום רביעי הבא?" (today is Wed) → next week 22 ביולי', async () => {
    const r = await ask('מתי יום רביעי הבא?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('22 ביולי')
  })
  it('"מתי שבת הבאה?" → 18 ביולי', async () => {
    const r = await ask('מתי שבת הבאה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('18 ביולי')
  })
})

describe('a calendar create with "ביום <weekday> הבא" is NOT hijacked to a date query', () => {
  it('"תקבעי פגישה עם דני ביום שלישי הבא בעשר בבוקר" stays a create', async () => {
    const r = await ask('תקבעי פגישה עם דני ביום שלישי הבא בעשר בבוקר')
    expect(r.intent).toBe('calendar_create')
  })
})
