/*
 * Regression: deterministic unit conversions (Cycle 22, RED-first)
 * ═══════════════════════════════════════════════════════════════
 * Wide-probe gap: everyday unit conversions ("3 קילומטר במטרים", "חצי קילו בגרם",
 * "30 מעלות צלזיוס בפרנהייט") fell to the LLM. These are deterministic (fixed factors)
 * and belong in the math reasoner. A price ("כמה עולה חלב") is NOT a conversion.
 *
 * Drives the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_CONVERT_UNITS]', online: async (q: string) => ({ ok: true, answer: `[ONLINE:${q}]` }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('unit conversions are computed deterministically', () => {
  it('"כמה זה 3 קילומטר במטרים?" → 3000', async () => {
    const r = await ask('כמה זה 3 קילומטר במטרים?')
    expect(r.intent).toBe('math'); expect(r.source).not.toBe('llm'); expect(r.display).toContain('3000')
  })
  it('"כמה זה חצי קילו בגרם?" → 500', async () => {
    expect((await ask('כמה זה חצי קילו בגרם?')).display).toContain('500')
  })
  it('"כמה זה 2 מטר בסנטימטר?" → 200', async () => {
    expect((await ask('כמה זה 2 מטר בסנטימטר?')).display).toContain('200')
  })
  it('"כמה זה 2 ליטר במיליליטר?" → 2000', async () => {
    expect((await ask('כמה זה 2 ליטר במיליליטר?')).display).toContain('2000')
  })
  it('"כמה זה 30 מעלות צלזיוס בפרנהייט?" → 86', async () => {
    const r = await ask('כמה זה 30 מעלות צלזיוס בפרנהייט?')
    expect(r.source).not.toBe('llm'); expect(r.display).toContain('86')
  })
  it('"כמה זה 212 פרנהייט בצלזיוס?" → 100', async () => {
    expect((await ask('כמה זה 212 פרנהייט בצלזיוס?')).display).toContain('100')
  })
})

describe('a price question is NOT a unit conversion', () => {
  it('"כמה עולה חלב?" is not intent=math', async () => {
    expect((await ask('כמה עולה חלב?')).intent).not.toBe('math')
  })
})
