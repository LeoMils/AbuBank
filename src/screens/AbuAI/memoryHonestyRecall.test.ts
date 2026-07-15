/*
 * Regression: memory honesty + last-question recall (Cycle 16, RED-first)
 * ═══════════════════════════════════════════════════════════════════════
 * Device failures:
 *  • "implied it had memory ('sometimes I miss things') while having none" — a
 *    cross-session memory question ("את זוכרת מה אמרתי לך אתמול?") must be answered
 *    HONESTLY and NEVER imply it remembers past-session conversations.
 *  • "what was my last question" continuity — "מה שאלתי אותך קודם?" should recall the
 *    prior user question from THIS session (working memory), not fall to the LLM.
 *
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_ANSWER_A_MEMORY_QUESTION]', online: async () => ({ ok: true, answer: '' }) }
type Msg = { role: string; content: string }
async function ask(input: string, messages: Msg[] = []) {
  const ctx = { messages, now: NOW }
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx, TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('cross-session memory question is answered honestly, never implies memory', () => {
  it('"את זוכרת מה אמרתי לך אתמול?" → honest (never implies it remembers)', async () => {
    const r = await ask('את זוכרת מה אמרתי לך אתמול?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toMatch(/לא שומרת|לא זוכרת/u)
    // must NOT imply it has/does keep memory
    expect(r.display).not.toMatch(/לפעמים|כן,|אמרת ש/u)
  })

  it('Spanish "¿te acordás de lo que te dije ayer?" → honest Spanish', async () => {
    const r = await ask('¿te acordás de lo que te dije ayer?')
    expect(r.source).not.toBe('llm')
    expect(r.display.toLowerCase()).toMatch(/no guardo|no recuerdo/u)
  })
})

describe('last-question recall from this session', () => {
  it('"מה שאלתי אותך קודם?" → recalls the prior user question (not the LLM)', async () => {
    const history: Msg[] = [
      { role: 'user', content: 'ספרי לי על פריז' },
      { role: 'assistant', content: 'פריז היא בירת צרפת.' },
    ]
    const r = await ask('מה שאלתי אותך קודם?', history)
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('פריז')
  })

  it('with no prior question → honest ("nothing yet"), not the LLM', async () => {
    const r = await ask('מה שאלתי אותך קודם?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toMatch(/עוד לא שאלת|לא שאלת/u)
  })
})
