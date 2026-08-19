/*
 * PRODUCTION PROOF — real inputs, real outputs, no mocks.
 *
 * This file runs the ACTUAL functions with ACTUAL Hebrew inputs
 * and PRINTS the ACTUAL responses Martita would see.
 *
 * Run with: npx vitest run src/screens/AbuAI/productionProof.test.ts
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { detectIntent, getProactiveSeed } from './proactive'
import { isCreateIntent } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: '1', role, content, timestamp: Date.now() }
}

// ════════════════════════════════════════════════════════════
// 1. FAMILY AUDIT — actual responses
// ════════════════════════════════════════════════════════════

describe('FAMILY AUDIT — real answers', () => {
  const queries = [
    'מי זה אדי?',
    'מי זאת מור?',
    'מי זה נועם?',
    'מי זה לאו?',
    'מי זה אופיר?',
    'מי זאת יעל?',
    'מתי יום ההולדת של נועם?',
    'מתי יום הזיכרון של פפי?',
    'איפה נועם גר?',
    'ספרי לי על הנכדים',
    'הילדים של מור',
    'בן כמה נועם?',
  ]

  for (const q of queries) {
    it(`"${q}"`, () => {
      const route = routePersonalQuery(q)
      const answer = tryGroundedAnswer(q)
      console.log(`\n  INPUT:  ${q}`)
      console.log(`  ROUTE:  ${route.type}`)
      console.log(`  ANSWER: ${answer}`)
      expect(answer, `"${q}" must have a local answer`).not.toBeNull()
      expect(answer!.length).toBeGreaterThan(5)
    })
  }
})

// ════════════════════════════════════════════════════════════
// 2. CALENDAR AUDIT — actual responses
// ════════════════════════════════════════════════════════════

describe('CALENDAR AUDIT — real answers', () => {
  const queries = [
    'מה יש לי היום?',
    'מה יש לי מחר?',
    'מה יש לי השבוע?',
    'מתי הרופא?',
    'יש לי משהו ביום חמישי?',
    'מה התוכנית להיום?',
    'מה קורה השבוע?',
  ]

  for (const q of queries) {
    it(`"${q}"`, () => {
      const route = routePersonalQuery(q)
      const answer = tryGroundedAnswer(q)
      console.log(`\n  INPUT:  ${q}`)
      console.log(`  ROUTE:  ${route.type}`)
      console.log(`  ANSWER: ${answer}`)
      expect(answer, `"${q}" must have a local answer`).not.toBeNull()
      // Calendar answers are either events or "לא מצאתי"
      expect(route.type).toMatch(/^calendar_/)
    })
  }
})

// ════════════════════════════════════════════════════════════
// 3. EMOTIONAL — actual responses (local, no LLM)
// ════════════════════════════════════════════════════════════

describe('EMOTIONAL AUDIT — real answers', () => {
  const queries = [
    'אני משועממת',
    'אני קצת עצובה',
    'מתגעגעת לפפי',
    'תדברי איתי רגע',
    'אני מרגישה לבד',
    'Estoy aburrida',
  ]

  for (const q of queries) {
    it(`"${q}"`, () => {
      const intent = detectIntent(q)
      const seed = getProactiveSeed(q)
      console.log(`\n  INPUT:  ${q}`)
      console.log(`  INTENT: ${intent}`)
      console.log(`  ANSWER: ${seed?.text}`)
      expect(seed, `"${q}" must get a local seed`).not.toBeNull()
    })
  }
})

// ════════════════════════════════════════════════════════════
// 4. ROUTING — what needs LLM vs what's local
// ════════════════════════════════════════════════════════════

describe('ROUTING AUDIT — local vs LLM', () => {
  const local = [
    'מה יש לי היום?', 'מי זה נועם?', 'מתי יום ההולדת של מור?',
    'תזכירי לי לקחת כדור בערב', 'תקבעי לי רופא מחר',
    'אני משועממת', 'מתגעגעת לפפי',
  ]
  const llm = [
    'ספרי לי בדיחה', 'מה דעתך על פוליטיקה?', 'ספרי לי סיפור',
    'מה מזג האוויר?', 'תסבירי לי מה זה AI',
  ]

  for (const q of local) {
    it(`LOCAL: "${q}"`, () => {
      const grounded = tryGroundedAnswer(q)
      const isCreate = isCreateIntent(q)
      const isEmotional = detectIntent(q) !== null
      const isLocal = grounded !== null || isCreate || isEmotional
      console.log(`  ${q} → ${isLocal ? 'LOCAL' : 'LLM'} ${grounded ? `[${grounded.slice(0,50)}...]` : isCreate ? '[CREATE]' : isEmotional ? '[EMOTIONAL]' : ''}`)
      expect(isLocal, `"${q}" should be local`).toBe(true)
    })
  }

  for (const q of llm) {
    it(`LLM: "${q}"`, () => {
      const grounded = tryGroundedAnswer(q)
      const isCreate = isCreateIntent(q)
      const isEmotional = detectIntent(q) !== null
      console.log(`  ${q} → ${grounded ? 'LOCAL (unexpected)' : 'LLM (correct)'}`)
      expect(grounded).toBeNull()
      expect(isCreate).toBe(false)
    })
  }
})

// ════════════════════════════════════════════════════════════
// 5. 30-MINUTE CONVERSATION — continuous flow
// ════════════════════════════════════════════════════════════

describe('30-MINUTE CONVERSATION — continuous', () => {
  const conv: ChatMessage[] = []
  function say(text: string) { conv.push(msg('user', text)) }
  function reply(text: string) { conv.push(msg('assistant', text)) }

  const turns: Array<{ input: string; check: (answer: string | null, resolved: string) => void }> = [
    // Minute 1-3: greeting + calendar
    { input: 'שלום', check: (a) => { /* greeting goes to LLM or content world */ } },
    { input: 'מה יש לי היום?', check: (a) => expect(a).not.toBeNull() },
    { input: 'ומחר?', check: (_, r) => expect(r).toContain('מחר') },
    { input: 'ומה אחרי זה?', check: (_, r) => expect(r).toContain('מה יש לי') },

    // Minute 4-7: family
    { input: 'מי זה נועם?', check: (a) => { expect(a).not.toBeNull(); expect(a).toContain('נועם') } },
    { input: 'ומתי יום ההולדת שלו?', check: (_, r) => expect(r).toContain('נועם') },
    { input: 'ומור?', check: (_, r) => expect(r).toContain('מור') },
    { input: 'מי הילדים שלה?', check: (_, r) => expect(r).toContain('מור') },

    // Minute 8-10: reminder
    { input: 'תזכירי לי לקחת כדור בערב', check: () => expect(isCreateIntent('תזכירי לי לקחת כדור בערב')).toBe(true) },

    // Minute 11-13: appointment + correction
    { input: 'תקבעי לי רופא ביום ראשון בעשר בבוקר', check: () => expect(isCreateIntent('תקבעי לי רופא ביום ראשון בעשר בבוקר')).toBe(true) },

    // Minute 14-16: emotional
    { input: 'אני קצת עצובה היום', check: () => expect(detectIntent('אני קצת עצובה היום')).toBe('sadness') },
    { input: 'מתגעגעת לפפי', check: () => expect(detectIntent('מתגעגעת לפפי')).toBe('missing_pepe') },

    // Minute 17-19: back to calendar
    { input: 'מה יש לי השבוע?', check: (a) => expect(a).not.toBeNull() },

    // Minute 20-22: pronoun chain
    { input: 'מי זה אופיר?', check: (a) => { expect(a).not.toBeNull(); expect(a).toContain('אופיר') } },
    { input: 'תזכירי לי להתקשר אליה מחר', check: (_, r) => expect(r).toContain('אופיר') },

    // Minute 23-25: open conversation (LLM)
    { input: 'ספרי לי בדיחה', check: (a) => expect(a).toBeNull() }, // goes to LLM — correct
    { input: 'מה דעתך על פוליטיקה?', check: (a) => expect(a).toBeNull() }, // goes to LLM

    // Minute 26-28: back to family
    { input: 'ספרי לי על הנכדים', check: (a) => { expect(a).not.toBeNull(); expect(a).toContain('נכדים') } },
    { input: 'בן כמה נועם?', check: (a) => { expect(a).not.toBeNull(); expect(a).toContain('אין לי את שנת הלידה') } },

    // Minute 29-30: birthday fusion
    { input: 'מתי יום ההולדת של מור?', check: (a) => expect(a).not.toBeNull() },
  ]

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!
    it(`Turn ${i + 1}: "${turn.input}"`, () => {
      let text = turn.input

      // Pronoun resolution
      const { resolved } = resolvePronouns(text, conv)
      if (resolved !== text) text = resolved

      // Follow-up resolution
      const followUp = resolveFollowUp(text, conv)
      if (followUp.wasFollowUp) text = followUp.resolved

      // Try grounded answer
      const answer = tryGroundedAnswer(text)

      console.log(`\n  [Turn ${i + 1}] "${turn.input}"`)
      if (text !== turn.input) console.log(`  [Resolved] "${text}"`)
      if (answer) console.log(`  [Answer] ${answer.slice(0, 100)}`)
      else console.log(`  [Route] → LLM (needs provider)`)

      // Add to conversation
      say(turn.input)
      if (answer) reply(answer)
      else reply('[LLM response would go here]')

      turn.check(answer, text)
    })
  }
})
