/*
 * Regression: family count queries (Cycle 5 / F6, RED-first)
 * ═════════════════════════════════════════════════════════
 * Probe evidence (docs/INTELLIGENCE_GAP_MAP.md, F6): "כמה נכדים יש למרטיטה?" (how many
 * grandchildren does Martita have) punted to the LLM — there was no count reasoner and
 * the query has only ONE family name, so the routing never reached the graph. A count is
 * deterministic from the graph and must never be guessed.
 *
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_SHOULD_NOT_COUNT_THE_FAMILY]',
  online: async () => ({ ok: true, answer: '' }),
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('Family count queries are answered from the graph (never the LLM)', () => {
  it('"כמה נכדים יש למרטיטה?" → 6 grandchildren, deterministic', async () => {
    const r = await ask('כמה נכדים יש למרטיטה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('6')
    expect(r.display).toContain('אופיר') // a real grandchild, grounded
  })

  it('"כמה נכדים יש לי?" (Martita self) → 6', async () => {
    const r = await ask('כמה נכדים יש לי?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('6')
  })

  it('"כמה ילדים יש למרטיטה?" → 2', async () => {
    const r = await ask('כמה ילדים יש למרטיטה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('2')
  })

  it('"כמה נינים יש למרטיטה?" → 2 great-grandchildren', async () => {
    const r = await ask('כמה נינים יש למרטיטה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('2')
  })
})
