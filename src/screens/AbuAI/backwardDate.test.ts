/*
 * Regression: backward date arithmetic ("לפני שבוע") (Cycle 21, RED-first)
 * ═══════════════════════════════════════════════════════════════════════
 * Wide-probe gap: "איזה יום היה לפני שבוע?" fell to the LLM. dateReasoner did FORWARD
 * arithmetic ("בעוד N ימים/שבוע") but not BACKWARD ("לפני N ימים/שבוע/שבועיים/יומיים") —
 * deterministic from ctx.now.
 *
 * now = Wed 2026-07-15. Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_DO_DATE_ARITHMETIC]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('backward date arithmetic ("לפני N …") — deterministic from ctx.now', () => {
  it('"איזה יום היה לפני שבוע?" → Wed 8 ביולי, not LLM', async () => {
    const r = await ask('איזה יום היה לפני שבוע?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('8 ביולי')
    expect(r.display).toContain('רביעי')
    expect(r.display).not.toContain('15 ביולי')
  })
  it('"איזה תאריך היה לפני שבועיים?" → 1 ביולי', async () => {
    const r = await ask('איזה תאריך היה לפני שבועיים?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('1 ביולי')
  })
  it('"איזה יום היה לפני יומיים?" → Mon 13 ביולי', async () => {
    const r = await ask('איזה יום היה לפני יומיים?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('13 ביולי'); expect(r.display).toContain('שני')
  })
  it('"איזה תאריך היה לפני 3 ימים?" → 12 ביולי', async () => {
    const r = await ask('איזה תאריך היה לפני 3 ימים?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('12 ביולי')
  })
})

describe('forward arithmetic still works (no regression)', () => {
  it('"איזה תאריך יהיה בעוד שבוע?" → 22 ביולי', async () => {
    expect((await ask('איזה תאריך יהיה בעוד שבוע?')).display).toContain('22 ביולי')
  })
})
