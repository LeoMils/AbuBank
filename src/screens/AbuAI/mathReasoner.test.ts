/*
 * Regression: deterministic math / percent / tip (Cycle 19, RED-first)
 * ═══════════════════════════════════════════════════════════════════
 * Wide-probe gap: everyday arithmetic ("כמה זה 15 כפול 4?", "20 אחוז מ-200", "15 אחוז
 * טיפ על 240 שקל") fell to the LLM, which is unreliable at math. These are deterministic
 * and must be computed, never guessed. A price question ("כמה עולה חלב") is NOT math and
 * must still route online.
 *
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_DO_MATH]', online: async (q: string) => ({ ok: true, answer: `[ONLINE:${q}]` }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('math is computed deterministically, never the LLM', () => {
  it('"כמה זה 15 כפול 4?" → 60', async () => {
    const r = await ask('כמה זה 15 כפול 4?')
    expect(r.intent).toBe('math'); expect(r.source).not.toBe('llm'); expect(r.display).toContain('60')
  })
  it('"כמה זה 200 חלקי 8?" → 25', async () => {
    expect((await ask('כמה זה 200 חלקי 8?')).display).toContain('25')
  })
  it('"כמה זה 50 ועוד 30?" → 80', async () => {
    expect((await ask('כמה זה 50 ועוד 30?')).display).toContain('80')
  })
  it('"כמה זה 100 פחות 35?" → 65', async () => {
    expect((await ask('כמה זה 100 פחות 35?')).display).toContain('65')
  })
  it('"כמה זה 20 אחוז מ-200?" → 40', async () => {
    const r = await ask('כמה זה 20 אחוז מ-200?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('40')
  })
  it('"כמה זה 15 אחוז טיפ על 240 שקל?" → tip 36, total 276', async () => {
    const r = await ask('כמה זה 15 אחוז טיפ על 240 שקל?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('36'); expect(r.display).toContain('276')
  })
  it('Spanish "¿cuánto es 15 por 4?" → 60', async () => {
    expect((await ask('¿cuánto es 15 por 4?')).display).toContain('60')
  })
})

describe('a price question is NOT math (still routes online, not the calculator)', () => {
  it('"כמה עולה חלב?" is not intent=math', async () => {
    expect((await ask('כמה עולה חלב?')).intent).not.toBe('math')
  })
})
