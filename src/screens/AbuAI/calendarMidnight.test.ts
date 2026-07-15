/*
 * Regression: midnight (בחצות) in a calendar create (Cycle 12, RED-first)
 * ═══════════════════════════════════════════════════════════════════════
 * Device failure (Leo): "פגישה עם אופיר מחר בחצות בקפה אילנה" — the create asked
 * "באיזו שעה?" even though "בחצות" (midnight) was already said, and the no-verb form
 * fell to the LLM entirely. parseHebrewTimeDetailed did not resolve בחצות → 00:00, and
 * בחצות was not a narrative time-cue.
 *
 * Drives the time parser (unit) + the REAL controller. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { parseHebrewTimeDetailed } from './calendarCreate'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

describe('parseHebrewTimeDetailed — midnight/noon words', () => {
  it('"בחצות" → 00:00, not ambiguous', () => {
    const r = parseHebrewTimeDetailed('פגישה עם אופיר מחר בחצות')
    expect(r.time).toBe('00:00')
    expect(r.ambiguous).toBe(false)
  })
  it('"חצות היום" → 12:00 (noon)', () => {
    expect(parseHebrewTimeDetailed('נפגשים בחצות היום').time).toBe('12:00')
  })
})

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = { llm: async () => '[LLM]', online: async () => ({ ok: true, answer: '' }) }
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('controller: midnight create captures person + place + time, never re-asks', () => {
  it('"תקבעי פגישה עם אופיר מחר בחצות בקפה אילנה" → confirm with אופיר + place, not "באיזו שעה"', async () => {
    const r = await ask('תקבעי פגישה עם אופיר מחר בחצות בקפה אילנה')
    expect(r.intent).toBe('calendar_create')
    expect(r.display).not.toContain('באיזו שעה')
    expect(r.display).toContain('אופיר')
    expect(r.display).toContain('אילנה')
    expect(r.display).toMatch(/00:00|חצות/u)
  })

  it('the no-verb form "פגישה עם אופיר מחר בחצות בקפה אילנה" is recognized as a create', async () => {
    const r = await ask('פגישה עם אופיר מחר בחצות בקפה אילנה')
    expect(r.intent).toBe('calendar_create')
    expect(r.source).not.toBe('llm')
  })
})
