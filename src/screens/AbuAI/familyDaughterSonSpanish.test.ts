/*
 * Regression: singular daughter/son queries + Spanish identity (Cycle 3, RED-first)
 * ════════════════════════════════════════════════════════════════════════════════
 * Probe evidence (docs/INTELLIGENCE_GAP_MAP.md):
 *   F3 "מי הבת של מרטיטה?" (who is Martita's daughter) → LLM, because the family
 *      relation engine only knew PLURAL children (ילדים/בנים), never singular בת/בן.
 *   F4 "¿quién es Ofir?" (Spanish) → "No estoy segura…" fallback, because the resolver's
 *      Spanish "quién es X" regex was anchored with ^ and the leading "¿" broke it,
 *      even though the SAME query routed to the family domain. Hebrew "מי זה אופיר" worked.
 *
 * Drives the REAL controller (typed path). Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_SHOULD_NOT_ANSWER_A_GRAPH_QUESTION]',
  online: async () => ({ ok: true, answer: '' }),
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('Singular daughter/son resolve from the graph (not the LLM)', () => {
  it('"מי הבת של מרטיטה?" → מור (daughter), never Leo, deterministic', async () => {
    const r = await ask('מי הבת של מרטיטה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('מור')
    expect(r.display).not.toContain('לאו')
  })

  it('"מי הבן של מרטיטה?" → לאו (son), never Mor, deterministic', async () => {
    const r = await ask('מי הבן של מרטיטה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('לאו')
    expect(r.display).not.toContain('מור')
  })
})

describe('Spanish identity "¿quién es X?" is grounded, not the unknown fallback', () => {
  it('"¿quién es Ofir?" → grounded family answer, never "No estoy segura"', async () => {
    const r = await ask('¿quién es Ofir?')
    expect(r.source).not.toBe('llm')
    expect(r.display).not.toMatch(/No estoy segura|לא בטוחה בקשר/u)
    expect(r.display.toLowerCase()).toMatch(/ofir|אופיר/u)
  })

  it('Hebrew "מי זה אופיר?" still works (no regression)', async () => {
    const r = await ask('מי זה אופיר?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('אופיר')
  })
})
