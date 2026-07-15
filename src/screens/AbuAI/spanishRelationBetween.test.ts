/*
 * Regression: Spanish "relation between X and Y" (Cycle 13, RED-first)
 * ═══════════════════════════════════════════════════════════════════
 * Device-triage gap FAM-ES-BETWEEN: "¿qué relación hay entre Anabel y Leo?" fell to the
 * LLM, though the Hebrew "מה הקשר בין אנבל ללאו" resolves deterministically. Spanish
 * relation-between was neither routed to the family domain nor parsed.
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

describe('Spanish relation-between resolves from the graph (not the LLM)', () => {
  it('"¿qué relación hay entre Anabel y Leo?" → deterministic, references the pair', async () => {
    const r = await ask('¿qué relación hay entre Anabel y Leo?')
    expect(r.source).not.toBe('llm')
    expect(r.display).not.toContain('[LLM')
    expect(r.display).toMatch(/Leo|Anabel/u)
  })

  it('"¿qué relación hay entre Mor y Ofir?" → deterministic (Spanish)', async () => {
    const r = await ask('¿qué relación hay entre Mor y Ofir?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toMatch(/Mor|Ofir|madre|hija/u)
  })

  it('Hebrew "מה הקשר בין אנבל ללאו?" still works (no regression)', async () => {
    const r = await ask('מה הקשר בין אנבל ללאו?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toMatch(/לאו|אנאבל|אנבל/u)
  })
})
