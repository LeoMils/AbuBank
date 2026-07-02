/*
 * Cognitive Runtime v2 — unit locks for the layers that are env-independent
 * (intent planner, date reasoner, verifier, composer, no-LLM-bypass). The full
 * multi-turn behaviour (calendar save round-trip etc.) is proven by
 * src/eval/latestRealIphoneFullRuntimeReplay.test.ts.
 */
import { describe, it, expect } from 'vitest'
import {
  runCognitiveTurn, finalizeExternalAnswer, classifyIntent, dateReasoner,
  verifyAnswer, composeHebrew, detectLang, IDLE_RUNTIME,
} from './cognitiveRuntime'

const NOW = new Date(2026, 6, 2, 9, 0, 0) // 2026-07-02 (Thursday)
const ctx = { messages: [] as Array<{ role: string; content: string }>, now: NOW }

describe('Layer 3 — intent planner (Hebrew-safe, no \\b bugs)', () => {
  it('classifies date/day questions', () => {
    expect(classifyIntent('איזה יום היום', IDLE_RUNTIME)).toBe('date_query')
    expect(classifyIntent('מה התאריך היום', IDLE_RUNTIME)).toBe('date_query')
  })
  it('classifies "מתי יש לי פגישה עם X" as search, not create', () => {
    expect(classifyIntent('מתי יש לי פגישה עם מוטי', IDLE_RUNTIME)).toBe('calendar_search')
  })
  it('routes buses/weather to online', () => {
    expect(classifyIntent('מתי האוטובוס הבא לתל אביב', IDLE_RUNTIME)).toBe('online')
  })
  it('treats an audio complaint as audio_complaint, never as calendar', () => {
    const pending = { ...IDLE_RUNTIME, createState: { ...IDLE_RUNTIME.createState, phase: 'confirming' as const } }
    expect(classifyIntent('אני לא שומע אותך', pending)).toBe('audio_complaint')
  })
})

describe('Layer 5 — date reasoner (real date source, deterministic)', () => {
  it('answers the actual weekday, never invents or asks back', () => {
    const a = dateReasoner('איזה יום היום', NOW)
    expect(a).toContain('יום חמישי')
    expect(a).not.toMatch(/באיזה יום/)
  })
})

describe('Layer 7 — response verifier', () => {
  it('rejects "I can\'t check" when data is available', () => {
    expect(verifyAnswer('אני לא מצליחה לבדוק את זה', { intent: 'online', dataAvailable: true }).ok).toBe(false)
  })
  it('rejects a date query that asks the day back', () => {
    expect(verifyAnswer('באיזה יום את מתכוונת?', { intent: 'date_query', dataAvailable: true }).ok).toBe(false)
  })
  it('rejects broken fragments / URLs and double prepositions', () => {
    expect(verifyAnswer('com]( cbsnews', { intent: 'general', dataAvailable: true }).ok).toBe(false)
    expect(verifyAnswer('הפגישה באצלי בבית', { intent: 'confirmation', dataAvailable: true }).ok).toBe(false)
  })
  it('passes a clean grounded answer', () => {
    expect(verifyAnswer('היום יום חמישי, 2 ביולי 2026.', { intent: 'date_query', dataAvailable: true }).ok).toBe(true)
  })
})

describe('Layer 8/9 — composer + lang', () => {
  it('produces non-empty spoken + display and strips URLs', () => {
    const c = composeHebrew('תראי כאן https://example.com את התשובה')
    expect(c.speak).not.toMatch(/https?:\/\//)
    expect(c.display.length).toBeGreaterThan(0)
  })
  it('detects Spanish', () => {
    expect(detectLang('hola, estoy sola')).toBe('es')
  })
})

describe('no direct LLM bypass — external answers are verified + composed', () => {
  it('finalizeExternalAnswer runs the verifier on LLM output', () => {
    const fin = finalizeExternalAnswer(IDLE_RUNTIME, 'com]( cbsnews broken', { intent: 'general' })
    expect(fin.verifier.ok).toBe(false)
    expect(fin.verifier.violations).toContain('broken_fragment_or_url')
  })
  it('records the answer so continuation can resume it', () => {
    const fin = finalizeExternalAnswer(IDLE_RUNTIME, 'משפט ראשון. משפט שני. משפט שלישי.', { intent: 'general', topic: 'נושא' })
    expect(fin.state.conv.answer?.topic).toBe('נושא')
    const cont = runCognitiveTurn(fin.state, 'תמשיכי', ctx)
    expect(cont.intent).toBe('continuation')
    expect(cont.handled).toBe(true)
    expect(cont.display && cont.display.length).toBeGreaterThan(0)
  })
})
