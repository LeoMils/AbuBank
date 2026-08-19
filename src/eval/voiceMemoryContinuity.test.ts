/*
 * VOICE MEMORY + CONTINUITY — spoken turns update and read the SAME conversation
 * memory as text: recall, pronoun continuity, calendar read-back after a save.
 */
import { describe, it, expect } from 'vitest'
import { brainConversation } from './voiceHarness'

const last = <T,>(a: T[]) => a[a.length - 1]!

describe('VOICE memory — the mission flow', () => {
  it('family → pronoun → recall → create → read-back all carry context', async () => {
    const l = await brainConversation([
      'מי זאת מור?',
      'ספרי לי עליה',
      'מה אמרת עליה קודם?',
      'תקבעי לי פגישה עם מור מחר בשמונה בערב בקפה אסתר',
      'כן',
      'מתי הפגישה עם מור?',
      'באיזה שעה?',
      'איפה?',
    ])
    const trace = JSON.stringify(l.map((x, i) => `T${i + 1} ${x.say}→[${x.intent}/${x.source}] ${x.display.slice(0, 34)}`))
    // "ספרי לי עליה" resolved to Mor (context retained)
    expect(l[1]!.resolved, trace).toContain('מור')
    // the meeting saved
    expect(l[4]!.sideEffect, trace).toBe('saved_appointment')
    // search finds it, then property follow-ups answer FROM the event, never punt to LLM
    expect(l[5]!.source, trace).not.toBe('llm')            // search
    expect(l[6]!.source, trace).not.toBe('llm')            // "באיזה שעה?"
    expect(last(l).source, trace).not.toBe('llm')          // "איפה?"
    expect(/20:00|שמונה/.test(l[6]!.display), trace).toBe(true)      // time from the event
    expect(/אסתר/.test(last(l).display), trace).toBe(true)          // location from the event
  })
})

describe('VOICE memory — "מה דיברנו קודם?" recalls a real topic', () => {
  for (let i = 0; i < 40; i++) {
    const p = ['מור', 'רפי', 'אופיר', 'ירדן'][i % 4]!
    it(`recall ${i} after ${p} + weather`, async () => {
      const l = await brainConversation([`מי ז${/ה$/.test(p) ? 'את' : 'ה'} ${p}?`, 'מה מזג האוויר בכפר סבא?', 'עזוב', 'מה דיברנו קודם?'])
      expect(/דיברנו על (?:עזוב|תודה|ביי|שלום|לא משנה)/.test(last(l).display), JSON.stringify(l.map(x => x.display))).toBe(false)
    })
  }
})

describe('VOICE memory — "¿Qué hablamos antes?" (Spanish recall) does not crash / punt to nonsense', () => {
  it('Spanish recall after a topic', async () => {
    const l = await brainConversation(['מי זאת מור?', 'מה מזג האוויר בכפר סבא?', '¿Qué hablamos antes?'])
    expect(last(l).display.length).toBeGreaterThan(0)
  })
})
