/*
 * Regression: top-scorer is a current-info (online) query (Cycle 14, RED-first)
 * ════════════════════════════════════════════════════════════════════════════
 * Device failures: "who is the top scorer" was not answered, and a follow-up
 * "ומי מלך השערים?" after a sports answer fell to the LLM. The sports online detector
 * required explicit context (מונדיאל/כדורגל/…) and did not recognize "מלך השערים" (top
 * scorer) or "מי הבקיע" (who scored) on their own — so a bare top-scorer question was
 * answered from model memory instead of a real retrieval.
 *
 * Drives the REAL controller (instrumented online tool). Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const calls: string[] = []
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_SHOULD_NOT_ANSWER_A_LIVE_SPORTS_QUESTION]',
  online: async (q: string) => { calls.push(q); return { ok: true, answer: `[ONLINE:${q}]` } },
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  calls.length = 0
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim(), calls: [...calls] }
}

describe('top-scorer is answered by live retrieval, not model memory', () => {
  it('"מי מלך השערים?" (no explicit sport word) → online', async () => {
    const r = await ask('מי מלך השערים?')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('online')
  })

  it('"ומי מלך השערים?" (as a follow-up form) → online', async () => {
    const r = await ask('ומי מלך השערים?')
    expect(r.source).not.toBe('llm')
    expect(r.intent).toBe('online')
  })

  it('a two-turn sports flow: "מי ניצח אתמול?" then "ומי מלך השערים?" both go online', async () => {
    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מי ניצח במשחק אתמול?', ctx(), TOOLS)
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'ומי מלך השערים?', ctx(), TOOLS)
    expect(t1.source).toBe('online')
    expect(t2.source).toBe('online')
  })
})
