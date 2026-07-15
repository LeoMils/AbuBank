/*
 * Regression: sibling queries (Cycle 10, RED-first)
 * ═════════════════════════════════════════════════
 * Probe-2 evidence (FAM-SIB): "מי אח של מור?" (who is Mor's brother) returned the unknown
 * fallback — the relation engine had no sibling rule, though Leo is Mor's brother in the
 * graph. Siblings = the other children of the person's parents.
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

describe('sibling queries resolve from the graph (not the LLM)', () => {
  it('"מי אח של מור?" → לאו (brother), deterministic', async () => {
    const r = await ask('מי אח של מור?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('לאו')
  })

  it('"מי אחות של לאו?" → מור (sister), deterministic', async () => {
    const r = await ask('מי אחות של לאו?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('מור')
  })

  it('"מי אח של לאו?" → NOT Mor (she is his sister, not brother)', async () => {
    const r = await ask('מי אח של לאו?')
    // Leo has no brother in the graph → honest, never fabricate Mor as a "brother".
    expect(r.display).not.toContain('מור')
  })
})
