/*
 * Regression: "how many days until …" (Cycle 24, RED-first)
 * ════════════════════════════════════════════════════════
 * Wide-probe gap: "כמה זמן עד סוף החודש?" fell to the LLM. "Days until" (end of month /
 * end of week / a holiday) is deterministic from ctx.now + the holiday table.
 *
 * now = Wed 2026-07-15 (July has 31 days; next Saturday = 18 ביולי; Rosh Hashana 2026-09-22).
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_COUNT_DAYS]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('"days until X" is computed deterministically, never the LLM', () => {
  it('"כמה ימים עד סוף החודש?" → 16', async () => {
    const r = await ask('כמה ימים עד סוף החודש?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('16')
  })
  it('"כמה זמן עד סוף החודש?" → 16', async () => {
    expect((await ask('כמה זמן עד סוף החודש?')).display).toContain('16')
  })
  it('"כמה ימים עד סוף השבוע?" → 3 (to Saturday)', async () => {
    const r = await ask('כמה ימים עד סוף השבוע?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('3')
  })
  it('"כמה ימים עד ראש השנה?" → 69, names the holiday', async () => {
    const r = await ask('כמה ימים עד ראש השנה?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('69'); expect(r.display).toContain('ראש השנה')
  })
})
