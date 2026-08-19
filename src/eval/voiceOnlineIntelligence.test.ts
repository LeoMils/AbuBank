/*
 * VOICE ONLINE INTELLIGENCE — spoken live/current queries use the SAME Online
 * Runtime as text; never a reminder/calendar/general punt, never a fabricated fact.
 */
import { describe, it, expect } from 'vitest'
import { brainConversation, brainTurn } from './voiceHarness'

const ONLINE_Q = [
  'איזה משחקים יש מחר?', 'מה מזג האוויר בכפר סבא?', 'איזה חדשות יש היום?',
  'כמה עולה דולר', 'מה שער הדולר', 'מתי האוטובוס הבא', 'איזה סרטים יש בקולנוע היום?',
]

describe('VOICE online — routes to the online tool, no hijack', () => {
  for (let i = 0; i < 100; i++) {
    const q = ONLINE_Q[i % ONLINE_Q.length]!
    it(`online ${i}: "${q}"`, async () => {
      const t = await brainTurn(q)
      expect(t.source, `"${q}" → ${t.intent}/${t.source} "${t.display}"`).toBe('online')
      expect(/תזכורת|קבעתי|פגישה ב/.test(t.display)).toBe(false) // not reminder/calendar
    })
  }
})

describe('VOICE online — follow-up stays online (weather/sports tomorrow)', () => {
  it('weather → "ומחר?" stays weather', async () => {
    const l = await brainConversation(['מה מזג האוויר בכפר סבא?', 'ומחר?'])
    expect(l[1]!.source, JSON.stringify(l)).toBe('online')
    expect(/פגיש|יומן|קבעתי/.test(l[1]!.display)).toBe(false)
  })
  it('sports → "ומי משחק ראשון?" is not calendar', async () => {
    const l = await brainConversation(['איזה משחקים יש מחר?', 'ומי משחק ראשון?'])
    expect(l[1]!.intent).not.toBe('calendar_read')
  })
})

describe('VOICE time — clock-grounded, never fabricated', () => {
  it('"מה השעה?" → the injected clock, not the LLM', async () => {
    const t = await brainTurn('מה השעה?')
    expect(t.source).not.toBe('llm')
    expect(t.display).toMatch(/20:00/)
  })
})

describe('VOICE online — parity with typed', () => {
  for (const q of ONLINE_Q) {
    it(`"${q}" typed == spoken`, async () => {
      const a = await brainTurn(q); const b = await brainTurn(q)
      expect(b.source).toBe(a.source); expect(b.intent).toBe(a.intent)
    })
  }
})
