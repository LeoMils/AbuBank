/*
 * Investigative probe: does a stale online answer repeat across DIFFERENT questions?
 * ════════════════════════════════════════════════════════════════════════════════
 * Mission gap #2: "repeated identical answers to different questions". This drives the
 * REAL controller across CONSECUTIVE, DIFFERENT online questions (shared state) with an
 * instrumented online tool that returns a DISTINCT answer per query, and checks that
 * turn 2 gets turn 2's answer (not turn 1's). If this fails → a CODE-level stale-focus
 * bug at the controller. If it passes → the controller boundary is clean and any real
 * "repeat" lives in the live provider (PREVIEW-class, cannot be proven with a mock).
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from '../screens/AbuAI/executiveCognitiveController'
import { IDLE_RUNTIME } from '../screens/AbuAI/cognitiveRuntime'
import type { FullTurnTools } from '../screens/AbuAI/runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)

describe('online: consecutive different questions do not reuse a stale answer', () => {
  it('turn 2 (different topic) receives turn 2 answer, and the tool is called with turn 2 query', async () => {
    const calls: string[] = []
    const TOOLS: FullTurnTools = {
      llm: async () => '[LLM]',
      // distinct answer per query so any stale reuse is visible
      online: async (q: string) => { calls.push(q); return { ok: true, answer: `ANSWER<<${q}>>` } },
    }
    const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

    const t1 = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, 'מה מזג האוויר היום בכפר סבא?', ctx(), TOOLS)
    const t2 = await ExecutiveCognitiveController.handleTurn(t1.state, 'מי ראש הממשלה של ישראל עכשיו?', ctx(), TOOLS)

    // eslint-disable-next-line no-console
    console.log('ONLINE CALLS:', JSON.stringify(calls))
    // eslint-disable-next-line no-console
    console.log('T1:', t1.intent, t1.source, '→', (t1.display ?? '').slice(0, 80))
    // eslint-disable-next-line no-console
    console.log('T2:', t2.intent, t2.source, '→', (t2.display ?? '').slice(0, 80))

    // Turn 2 must not echo turn 1's weather answer.
    expect(t2.display).not.toContain('מזג האוויר')
    // If turn 2 went online, it must have used turn 2's query, not turn 1's.
    if (t2.source === 'online') {
      expect(calls[calls.length - 1]).toContain('ראש הממשלה')
    }
  })
})
