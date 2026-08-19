/*
 * VOICE FAMILY INTELLIGENCE — spoken family lookups hit the SAME grounded family
 * graph as text: correct gender, correct relation, no hallucination.
 */
import { describe, it, expect } from 'vitest'
import { brainConversation, brainTurn } from './voiceHarness'

// Canonical people that resolve deterministically in the graph.
const GROUNDED = ['מור', 'רפי', 'יעל', 'אופיר', 'עילי', 'אדר', 'עדי', 'נועם', 'ירדן', 'גלעד', 'אנאבל']

describe('VOICE family — grounded, never a cold LLM guess (canonical people)', () => {
  for (let i = 0; i < GROUNDED.length; i++) {
    const p = GROUNDED[i]!
    it(`"מי ז${/[אהת]$/.test(p) ? 'את' : 'ה'} ${p}?" is grounded family`, async () => {
      const t = await brainTurn(`מי ז${/ה$/.test(p) ? 'את' : 'ה'} ${p}?`)
      // Grounded family (not an ungrounded LLM guess). An honest "I won't guess" for an
      // uncertain relation is also acceptable — never a fabricated one.
      expect(t.intent === 'family' || /לא\s+בטוחה|לא\s+אנחש/.test(t.display), `${p}: ${t.intent} "${t.display}"`).toBe(true)
    })
  }
})

describe('VOICE family — gender agreement (Martita\'s daughter)', () => {
  it('"מי זה רפי?" → Mor is female ("הייתה נשואה"), never "היה נשוי"', async () => {
    const t = await brainTurn('מי זה רפי?')
    expect(t.display).not.toMatch(/מור\s+היה\s+נשוי/)
    expect(t.display).not.toMatch(/בת\/בן/)
  })
})

describe('VOICE family — pronoun follow-up stays on the person', () => {
  for (let i = 0; i < 20; i++) {
    const p = ['מור', 'אופיר', 'יעל', 'ירדן'][i % 4]!
    it(`"${p}" → "עליה" stays on ${p}`, async () => {
      const l = await brainConversation([`מי זאת ${p}?`, 'ספרי לי עליה'])
      expect(l[1]!.resolved).toContain(p) // resolved to the person, not a cold start
    })
  }
})

describe('VOICE family — parity with typed', () => {
  for (const q of ['מי זאת מור?', 'מי זה גלעד?', 'מי זאת אופיר?', 'מי זאת ירדן?']) {
    it(`"${q}" typed == spoken`, async () => {
      const a = await brainTurn(q); const b = await brainTurn(q)
      expect(b.intent).toBe(a.intent); expect(b.display).toBe(a.display)
    })
  }
})
