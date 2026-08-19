/*
 * Regression: relative-date + next-holiday reasoning (Cycle 1, RED-first)
 * ══════════════════════════════════════════════════════════════════════
 * First divergence (probe evidence, docs/INTELLIGENCE_GAP_MAP.md):
 *   dateReasoner() always answered with `now`, ignoring אתמול/שלשום/מחר/מחרתיים,
 *   and DATE_QUERY_RE only recognized today/date phrasings — so "what was
 *   yesterday's date" returned TODAY (confidently wrong), and "what day was
 *   yesterday" fell through to the LLM (which has no clock). No next-holiday
 *   reasoner existed → "מתי החג הבא" hallucinated (the Independence-Day incident).
 *
 * These drive the REAL ExecutiveCognitiveController.handleTurn (typed path).
 * Evidence class: CODE (deterministic given ctx.now).
 */
import { describe, it, expect } from 'vitest'
import { ExecutiveCognitiveController } from './executiveCognitiveController'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import type { FullTurnTools } from './runtimeFullTurn'

// Wednesday 2026-07-15 10:00. yesterday=Tue 07-14, שלשום=Mon 07-13, tomorrow=Thu 07-16.
const NOW = new Date(2026, 6, 15, 10, 0, 0)
const TOOLS: FullTurnTools = {
  llm: async () => '[LLM_SHOULD_NOT_BE_USED_FOR_DATES]',
  online: async () => ({ ok: true, answer: '[ONLINE_SHOULD_NOT_ANSWER_DETERMINISTIC_DATE]' }),
}
const ctx = () => ({ messages: [] as Array<{ role: string; content: string }>, now: NOW })

async function ask(input: string) {
  const r = await ExecutiveCognitiveController.handleTurn(IDLE_RUNTIME, input, ctx(), TOOLS)
  return { intent: r.intent, source: r.source, display: (r.display ?? '').replace(/\s+/g, ' ').trim() }
}

describe('Relative-date reasoning (deterministic, from ctx.now)', () => {
  it('"איזה תאריך היה אתמול?" → yesterday 14 ביולי, NOT today', async () => {
    const r = await ask('איזה תאריך היה אתמול?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('14 ביולי')
    expect(r.display).not.toContain('15 ביולי')
  })

  it('"מה התאריך מחר?" → tomorrow 16 ביולי, NOT today', async () => {
    const r = await ask('מה התאריך מחר?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('16 ביולי')
    expect(r.display).not.toContain('15 ביולי')
  })

  it('"איזה יום היה אתמול?" → deterministic Tuesday (not LLM)', async () => {
    const r = await ask('איזה יום היה אתמול?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('שלישי')
    expect(r.display).toContain('14 ביולי')
  })

  it('"איזה יום יהיה מחר?" → deterministic Thursday (not LLM)', async () => {
    const r = await ask('איזה יום יהיה מחר?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('חמישי')
  })

  it('"איזה יום היה שלשום?" → deterministic Monday 13 ביולי (not LLM)', async () => {
    const r = await ask('איזה יום היה שלשום?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('שני')
    expect(r.display).toContain('13 ביולי')
  })

  it('Spanish "¿qué día fue ayer?" → deterministic yesterday (not LLM)', async () => {
    const r = await ask('¿qué día fue ayer?')
    expect(r.source).not.toBe('llm')
    // martes = Tuesday 2026-07-14
    expect(r.display.toLowerCase()).toContain('martes')
  })
})

describe('Next-holiday reasoning (deterministic table, never hallucinated)', () => {
  it('"מתי החג הבא?" → next holiday after today = ראש השנה 22 בספטמבר 2026 (not LLM)', async () => {
    const r = await ask('מתי החג הבא?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('ראש השנה')
    expect(r.display).toContain('22 בספטמבר')
  })

  it('"מתי פסח הבא?" → next Pesach = 22 במרץ 2027 (deterministic, not LLM/online guess)', async () => {
    const r = await ask('מתי פסח הבא?')
    expect(r.source).not.toBe('llm')
    expect(r.display).toContain('פסח')
    expect(r.display).toContain('2027')
  })
})
