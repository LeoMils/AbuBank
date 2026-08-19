/*
 * Regression: "grandchildren of X" (Cycle 23, RED-first)
 * ═════════════════════════════════════════════════════
 * Wide-probe gap: "מי הנכדים של לאו?" fell to the LLM. The family routing matched
 * singular "נכד/נכדה" but not the PLURAL "נכדים/נכדות", and there was no grandchildren-of-X
 * relation rule, though the graph computes them (children-of-children).
 * (Verified in data: Yael is Mor's partner — "בן הזוג של מור → יעל" is correct, not a bug.)
 *
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_ANSWER_A_GRAPH_QUESTION]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('grandchildren-of-X resolve from the graph', () => {
  it('"מי הנכדים של מור?" → אנאבל, ארי (deterministic, not LLM)', async () => {
    const r = await ask('מי הנכדים של מור?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('אנאבל')
    expect(r.display).toContain('ארי')
  })
  it('singular "מי הנכד של מור?" also lists them', async () => {
    const r = await ask('מי הנכד של מור?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('אנאבל')
  })
  it('"מי הנכדים של לאו?" → honest (Leo has none), never fabricates / never the LLM', async () => {
    const r = await ask('מי הנכדים של לאו?')
    expect(r.source).not.toBe('llm')
    expect(r.display).not.toContain('אנאבל')
    expect(r.display).not.toContain('ארי')
  })
})
