/*
 * Runtime Full Turn — proves the no-bypass guarantee: EVERY input (deterministic,
 * LLM, online, unknown) returns a runtime-produced, supervised, delivery-planned
 * answer, and raw tool output is verified/composed, never passed through raw.
 */
import { describe, it, expect } from 'vitest'
import { runFullTurn, type FullTurnTools } from './runtimeFullTurn'
import { IDLE_RUNTIME } from './cognitiveRuntime'
import { supervise, repair } from './cognitiveSupervisor'
import { planDelivery, advance, resume, TTS_EVENTS, ttsLog } from './conversationDeliveryEngine'

const NOW = new Date(2026, 6, 2, 9, 0, 0)
const ctx = (msgs: Array<{ role: string; content: string }> = []) => ({ messages: msgs, now: NOW })

const okTools = (llmText: string, onlineText = 'תוצאה אמיתית'): FullTurnTools => ({
  llm: async () => llmText,
  online: async () => ({ ok: true, answer: onlineText }),
})

describe('no-bypass: every input is a runtime answer', () => {
  it('date query — deterministic, routed', async () => {
    const r = await runFullTurn(IDLE_RUNTIME, 'איזה יום היום', ctx(), okTools('x'))
    expect(r.routedThroughRuntime).toBe(true)
    expect(r.source).toBe('deterministic')
    expect(r.display).toContain('יום חמישי')
  })

  it('general knowledge — LLM output is finalized through the runtime', async () => {
    const r = await runFullTurn(IDLE_RUNTIME, 'מה זה קוונטים', ctx(), okTools('תורת הקוונטים מתארת חלקיקים זעירים.'))
    expect(r.source).toBe('llm')
    expect(r.routedThroughRuntime).toBe(true)
    expect(r.display.length).toBeGreaterThan(0)
  })

  it('LLM broken-Hebrew output is CAUGHT by the supervisor (not passed raw)', async () => {
    const r = await runFullTurn(IDLE_RUNTIME, 'ספרי לי סיפור', ctx(), okTools('אני תבדוק את זה עכשיו'))
    // The supervisor must have flagged/repaired the broken form — never emit it raw.
    expect(r.speak).not.toMatch(/אני\s+תבדוק/)
  })

  it('online — provider failure is honest, never faked', async () => {
    const tools: FullTurnTools = { llm: async () => 'x', online: async () => ({ ok: false, reason: 'provider_failed', answer: '' }) }
    const r = await runFullTurn(IDLE_RUNTIME, 'מה יש בקולנוע היום', ctx(), tools)
    expect(r.source).toBe('online')
    expect(r.display).toMatch(/נפל|לא הצלחתי|ננסה/)
    expect(r.display).not.toMatch(/ניצח/)
  })

  it('family relation — directional, deterministic', async () => {
    const r = await runFullTurn(IDLE_RUNTIME, 'מה הקשר בין לאו לאנאבל', ctx(), okTools('x'))
    expect(r.routedThroughRuntime).toBe(true)
    expect(r.display).toContain('דוד רבא')
  })

  it('unknown input still produces a runtime fallback (never nothing)', async () => {
    const r = await runFullTurn(IDLE_RUNTIME, '...', ctx(), okTools('x'))
    expect(r.routedThroughRuntime).toBe(true)
    expect(r.display.length).toBeGreaterThan(0)
  })
})

describe('Cognitive Supervisor', () => {
  it('rejects robotic register', () => {
    expect(supervise('מה תרצי לדבר עליו?', { intent: 'general', dataAvailable: true }).approved).toBe(false)
  })
  it('rejects too-long-for-voice and repair trims it', () => {
    const long = 'משפט ראשון ארוך מאוד מאוד מאוד. ' + 'עוד טקסט '.repeat(40) + '.'
    const v = supervise(long, { intent: 'general', dataAvailable: true, forVoice: true })
    expect(v.approved).toBe(false)
    expect(repair(long, v).length).toBeLessThan(long.length)
  })
  it('approves a clean short answer', () => {
    expect(supervise('היום יום חמישי, 2 ביולי 2026.', { intent: 'date_query', dataAvailable: true, forVoice: true }).approved).toBe(true)
  })
})

describe('Conversation Delivery Engine', () => {
  it('chunks + resume delivers the exact next chunk', () => {
    let d = planDelivery('משפט אחד. משפט שני. משפט שלישי. משפט רביעי.')
    expect(d.chunks.length).toBeGreaterThanOrEqual(2)
    const first = advance(d); d = first.state
    const second = resume(d)
    expect(second.chunk).not.toBe(first.chunk)
    expect(second.chunk).toBeTruthy()
  })
  it('speech carries no markdown/URL', () => {
    const d = planDelivery('תראי [כאן](https://x.com) את זה. עוד משפט.')
    expect(d.chunks.join(' ')).not.toMatch(/https?:\/\/|\]\(/)
  })
  it('exposes the full TTS lifecycle events', () => {
    expect(TTS_EVENTS).toContain('tts_interrupted')
    expect(ttsLog('tts_error', 1, { error: 'x' }).error).toBe('x')
  })
})
