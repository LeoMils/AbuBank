/*
 * Regression: "in N days/weeks/hours" arithmetic (Cycle 9, RED-first)
 * ══════════════════════════════════════════════════════════════════
 * Probe-2 evidence: dateReasoner handled fixed offset WORDS (אתמול/מחר/שלשום/מחרתיים)
 * but not ARITHMETIC — "בעוד שלושה ימים" returned TODAY (confidently wrong), "בעוד שבוע"
 * fell to the LLM, and "מה השעה בעוד שעתיים" returned the current time (10:00, not 12:00).
 * All are deterministic from ctx.now.
 *
 * Drives the REAL controller. now = Wed 2026-07-15 10:00. Evidence class: CODE.
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_SHOULD_NOT_DO_DATE_ARITHMETIC]',
  online: async () => ({ ok: true, answer: '' }),
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })
async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('relative date arithmetic ("בעוד N …") — deterministic from ctx.now', () => {
  it('"איזה תאריך יהיה בעוד שלושה ימים?" → 18 ביולי, NOT today', async () => {
    const r = await ask('איזה תאריך יהיה בעוד שלושה ימים?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('18 ביולי')
    expect(r.display).not.toContain('15 ביולי')
  })

  it('"איזה יום יהיה בעוד שבוע?" → Wednesday 22 ביולי (not LLM)', async () => {
    const r = await ask('איזה יום יהיה בעוד שבוע?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('22 ביולי')
    expect(r.display).toContain('רביעי')
  })

  it('"איזה תאריך יהיה בעוד שבועיים?" → 29 ביולי', async () => {
    const r = await ask('איזה תאריך יהיה בעוד שבועיים?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('29 ביולי')
  })

  it('"בעוד יומיים" → 17 ביולי', async () => {
    const r = await ask('איזה תאריך יהיה בעוד יומיים?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('17 ביולי')
  })
})

describe('relative time arithmetic ("בעוד N שעות") — from the clock', () => {
  it('"מה השעה בעוד שעתיים?" → 12:00 (now 10:00)', async () => {
    const r = await ask('מה השעה בעוד שעתיים?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('12:00')
    expect(r.display).not.toContain('10:00')
  })

  it('"מה השעה בעוד שלוש שעות?" → 13:00', async () => {
    const r = await ask('מה השעה בעוד שלוש שעות?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('13:00')
  })
})
