/*
 * Regression: parent-of-X + pronoun continuity (Cycle 4, RED-first)
 * ═════════════════════════════════════════════════════════════════
 * Probe evidence (docs/INTELLIGENCE_GAP_MAP.md, M2):
 *   After "מי זה אופיר?" (who is Ofir), the follow-up "ומי אמא שלה?" (and who is her
 *   mother?) returned the unknown fallback. Two sub-gaps:
 *     (a) the relation engine had no singular mother/father rule ("מי אמא של X"), and
 *     (b) there was no working-memory antecedent, so the pronoun "שלה" (her) could not
 *         resolve to the previously-discussed person (Ofir → her mother Mor).
 *
 * Drives the REAL controller with a two-turn conversation (shared state). Evidence: CODE.
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

describe('Singular parent-of-X resolves from the graph', () => {
  it('"מי אמא של אופיר?" → מור, deterministic (not LLM)', async () => {
    const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי אמא של אופיר?', ctx(), TOOLS)
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('מור')
  })
})

describe('Pronoun continuity — "her" resolves to the person just discussed', () => {
  it('"מי זה אופיר?" then "ומי אמא שלה?" → Mor (Ofir\'s mother), never the unknown fallback', async () => {
    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי זה אופיר?', ctx(), TOOLS)
    expect(t1.display).toContain('אופיר')
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'ומי אמא שלה?', ctx(), TOOLS)
    expect(t2.source).not.toBe('llm')
    expect(t2.display).not.toMatch(/לא בטוחה בקשר|No estoy segura/u)
    expect(t2.display).toContain('מור')
  })
})
