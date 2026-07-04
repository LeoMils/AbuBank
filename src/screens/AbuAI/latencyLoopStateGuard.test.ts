/**
 * LATENCY / LOOP / STATE GUARD
 * No repeated greeting, no retry storm, realtime-down skip window, bounded TTS,
 * no stuck/looping states, and a pending calendar never hijacks an unrelated turn.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { startCreate, resolvePendingMessage } from './calendarCreate'
import { recordOnline, IDLE_CONV, handleConversationTurn } from './conversationOS'
import { toSpokenText } from './spokenPersona'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { const s: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} }) })

const IDX = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('latency / loop / state guards (source contracts)', () => {
  it('greeting plays once, then listening — no re-greet loop', () => {
    expect(IDX).toMatch(/await speakVoiceMode\(toSpokenText\(greeting\)\)[\s\S]{0,600}startVoiceListening/)
    // greeting is spoken from a single site
    expect((IDX.match(/toSpokenText\(greeting\)/g) ?? []).length).toBe(1)
  })
  it('realtime is skipped for a 5-minute window when the provider is known down', () => {
    expect(IDX).toContain('abu-openai-quota-failed')
    expect(IDX).toMatch(/300_000/)
    expect(IDX).toMatch(/openaiAvailable\s*=\s*useRealtime/)
  })
  it('latency is instrumented (no blind waits)', () => {
    for (const k of ['TOTAL_TAP_TO_SPEAK_MS', 'TRANSCRIPT_TO_RESPONSE_MS', 'ONLINE_FETCH_MS']) expect(IDX).toContain(k)
  })
  it('streaming voice falls back to a single serial speak (no retry storm)', () => {
    expect((IDX.match(/streamSpeakThrew/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })
  it('an interruption aborts cleanly (AbortController), not a stuck state', () => {
    expect(IDX).toContain('abortControllerRef')
    expect(IDX).toMatch(/ac\.signal\.aborted/)
  })
})

describe('no looping behavior', () => {
  it('spoken output is always bounded to ≤2 sentences', () => {
    const long = 'משפט אחד. משפט שני. משפט שלישי. משפט רביעי. משפט חמישי.'
    expect(toSpokenText(long).split(/[.!?]/).filter(x => x.trim().length > 1).length).toBeLessThanOrEqual(2)
  })
  it('repeated "למה?" never returns the same sentence twice (no generic refusal loop)', () => {
    let st = recordOnline(IDLE_CONV, { query: 'q', topic: null, source: null, ok: false, reason: 'provider_failed', summary: null })
    const said = new Set<string>()
    for (let i = 0; i < 4; i++) { const t = handleConversationTurn(st, 'למה?'); if (t.handled) { expect(said.has(t.speak!)).toBe(false); said.add(t.speak!); st = t.state } }
    expect(said.size).toBeGreaterThanOrEqual(3)
  })
})

describe('pending-state hygiene', () => {
  it('a pending calendar does NOT hijack an unrelated sports/weather/news turn', () => {
    for (const q of ['מי ניצח במשחק', 'מה מזג האוויר בכפר סבא', 'מה החדשות']) {
      const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
      // Answer the side query but KEEP the draft (park_keep), never hijack/confirm it.
      expect(resolvePendingMessage(st, q, false).action).toBe('park_keep')
    }
  })
  it('a confirmation during pending still saves (not parked)', () => {
    const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
    expect(resolvePendingMessage(st, 'כן', false).action).toBe('save')
  })
  it('a location during pending merges (not cancelled/looped)', () => {
    const st = startCreate('תקבעי פגישה עם גבי מחר בשלוש')
    expect(resolvePendingMessage(st, 'בקפה נורדאו', false).action).toBe('update')
  })
})
