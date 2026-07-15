/*
 * Regression: "what time is it in <city>" (Cycle 20, RED-first)
 * ════════════════════════════════════════════════════════════
 * Wide-probe gap: "מה השעה בניו יורק?" returned the LOCAL (Israel) time — confidently wrong.
 * The TIME branch ignored the city. Fixed to compute the time in the city's timezone via
 * Intl.DateTimeFormat({timeZone}); unknown cities fall through to local honestly.
 *
 * Deterministic regardless of the test runner's TZ: both the reasoner and this test format
 * the SAME `now` instant with Intl + an explicit timeZone. Drives the REAL controller. CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM_SHOULD_NOT_GUESS_A_TIMEZONE]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
const at = (zone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(NOW)
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('"what time in <city>" uses the city timezone, not local', () => {
  it('"מה השעה בניו יורק?" → New York time, names the city', async () => {
    const r = await ask('מה השעה בניו יורק?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('ניו יורק')
    expect(r.display).toContain(at('America/New_York'))
  })
  it('"מה השעה בלונדון?" → London time', async () => {
    const r = await ask('מה השעה בלונדון?')
    expect(r.display).toContain('לונדון')
    expect(r.display).toContain(at('Europe/London'))
  })
  it('"מה השעה בארגנטינה?" → Buenos Aires time (family abroad)', async () => {
    const r = await ask('מה השעה בארגנטינה?')
    expect(r.display).toContain(at('America/Argentina/Buenos_Aires'))
  })
  it('Spanish "¿qué hora es en Nueva York?" → Spanish, NY time', async () => {
    const r = await ask('¿qué hora es en Nueva York?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain(at('America/New_York'))
  })
})

describe('local time (no city) is unchanged', () => {
  it('"מה השעה?" → local now, deterministic', async () => {
    const r = await ask('מה השעה?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('10:00')
  })
})
