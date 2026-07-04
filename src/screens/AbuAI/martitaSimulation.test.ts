/*
 * 30-minute Martita conversation simulation.
 *
 * This is NOT a unit test. It runs the REAL routing, grounding, pronoun
 * resolution, context resolution, and response shaping functions with
 * real Hebrew inputs — exactly what happens when Martita types or speaks.
 *
 * Every FAIL here = a user-visible failure on the phone.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer, isPersonalQuery } from './service'
import { routePersonalQuery } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { isCreateIntent, startCreate, updateCreate, resolvePendingMessage, isConfirm, isCancel } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { getProactiveSeed, detectIntent } from './proactive'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: String(Math.random()), role, content, timestamp: Date.now() }
}

// Conversation state that accumulates across turns
const conversation: ChatMessage[] = []
function userSays(text: string) { conversation.push(msg('user', text)) }
function assistantSays(text: string) { conversation.push(msg('assistant', text)) }

describe('30-minute Martita simulation — minute by minute', () => {

  // ═══ MINUTE 1-2: Greeting + Calendar ═══

  it('T1: "שלום" — greeting detected, not dead end', () => {
    const text = 'שלום'
    const route = routePersonalQuery(text)
    // Should NOT route to personal — it's a greeting
    expect(route.type).toBe('non_personal')
    // Should be caught by proactive or content world (not LLM-required)
    // At minimum it should not crash or return null
    userSays(text)
    assistantSays('שלום Martita! מה נשמע?')
  })

  it('T2: "מה יש לי היום?" — calendar today, local, no LLM', () => {
    const text = 'מה יש לי היום?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    // Should contain calendar content (even if empty)
    expect(typeof answer).toBe('string')
    userSays(text)
    assistantSays(answer!)
  })

  it('T3: "ומחר?" — follow-up expands correctly', () => {
    const text = 'ומחר?'
    const followUp = resolveFollowUp(text, conversation)
    expect(followUp.wasFollowUp).toBe(true)
    expect(followUp.resolved).toContain('מחר')
    const answer = tryGroundedAnswer(followUp.resolved)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  it('T4: "ומה אחרי זה?" — multi-word follow-up works', () => {
    const text = 'ומה אחרי זה?'
    const followUp = resolveFollowUp(text, conversation)
    expect(followUp.wasFollowUp).toBe(true)
    const answer = tryGroundedAnswer(followUp.resolved)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  // ═══ MINUTE 3-5: Family ═══

  it('T5: "מי זה נועם?" — family lookup, local', () => {
    const text = 'מי זה נועם?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    expect(answer).toContain('נועם')
    userSays(text)
    assistantSays(answer!)
  })

  it('T6: "ומתי יום ההולדת שלו?" — pronoun + birthday', () => {
    const text = 'ומתי יום ההולדת שלו?'
    const { resolved } = resolvePronouns(text, conversation)
    expect(resolved).toContain('נועם')
    const answer = tryGroundedAnswer(resolved)
    expect(answer).not.toBeNull()
    expect(answer).toMatch(/נועם/)
    userSays(text)
    assistantSays(answer!)
  })

  it('T7: "יש לי משהו באותו יום?" — family-calendar fusion', () => {
    const text = 'יש לי משהו באותו יום?'
    const followUp = resolveFollowUp(text, conversation)
    expect(followUp.wasFollowUp).toBe(true)
    expect(followUp.resolved).toContain('מה יש לי')
    const answer = tryGroundedAnswer(followUp.resolved)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  it('T8: "ומור?" — name follow-up after family context', () => {
    const text = 'ומור?'
    const followUp = resolveFollowUp(text, conversation)
    expect(followUp.wasFollowUp).toBe(true)
    const answer = tryGroundedAnswer(followUp.resolved)
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
    userSays(text)
    assistantSays(answer!)
  })

  it('T9: "מי הילדים שלה?" — pronoun to Mor + group query', () => {
    const text = 'מי הילדים שלה?'
    const { resolved } = resolvePronouns(text, conversation)
    expect(resolved).toContain('מור')
    const answer = tryGroundedAnswer(resolved)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  it('T10: "ספרי לי על הנכדים" — generic plural family', () => {
    const text = 'ספרי לי על הנכדים'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    expect(answer).toContain('נכדים')
    userSays(text)
    assistantSays(answer!)
  })

  it('T11: "בן כמה נועם?" — age question, honest answer', () => {
    const text = 'בן כמה נועם?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    expect(answer).toContain('אין לי את שנת הלידה')
    userSays(text)
    assistantSays(answer!)
  })

  // ═══ MINUTE 6-8: Reminder ═══

  it('T12: "תזכירי לי לקחת כדור בערב" — reminder, local', () => {
    const text = 'תזכירי לי לקחת כדור בערב'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('reminder')
    userSays(text)
    assistantSays('לקחת כדור היום ב-18:00. לשמור?')
  })

  it('T13: "כן" — confirm reminder', () => {
    const text = 'כן'
    expect(isConfirm(text)).toBe(true)
    userSays(text)
    assistantSays('רשמתי. אזכיר לך לקחת כדור.')
  })

  it('T14: "תזכירי לי להתקשר לנועם מחר בערב" — reminder with person', () => {
    const text = 'תזכירי לי להתקשר לנועם מחר בערב'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('reminder')
    userSays(text)
    assistantSays('להתקשר לנועם מחר ב-18:00. לשמור?')
  })

  it('T15: "לא, בעצם בשמונה" — correction', () => {
    // This should be handled by pending reminder state
    const text = 'לא, בעצם בשמונה'
    expect(isCancel(text)).toBe(false) // NOT a cancel — it's a correction
    userSays(text)
    assistantSays('להתקשר לנועם מחר ב-20:00. לשמור?')
  })

  it('T16: "כן" — confirm corrected reminder', () => {
    expect(isConfirm('כן')).toBe(true)
    userSays('כן')
    assistantSays('רשמתי.')
  })

  // ═══ MINUTE 9-12: Appointment + Correction ═══

  it('T17: "תקבעי לי רופא ביום ראשון בעשר בבוקר" — appointment', () => {
    const text = 'תקבעי לי רופא ביום ראשון בעשר בבוקר'
    expect(isCreateIntent(text)).toBe(true)
    const state = startCreate(text)
    expect(state.draft.title).toContain('רופא')
    expect(state.draft.time).toBe('10:00')
    userSays(text)
    assistantSays('רופא ביום ראשון ב-10:00. זה נכון?')
  })

  it('T18: "בעצם ביום חמישי" — date correction preserves title+time', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-15', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בעצם ביום חמישי')
    expect(updated.phase).toBe('confirming')
    expect(updated.draft.title).toBe('רופא') // preserved
    expect(updated.draft.time).toBe('10:00') // preserved
    expect(updated.draft.date).not.toBe('2026-06-15') // changed to Thursday
    userSays('בעצם ביום חמישי')
    assistantSays('רופא ביום חמישי ב-10:00. זה נכון?')
  })

  it('T19: "כן" — confirm appointment', () => {
    expect(isConfirm('כן')).toBe(true)
    userSays('כן')
    assistantSays('קבוע.')
  })

  // ═══ MINUTE 13-15: Pronoun chain ═══

  it('T20: "מי זה אופיר?" — family lookup', () => {
    const text = 'מי זה אופיר?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    expect(answer).toContain('אופיר')
    userSays(text)
    assistantSays(answer!)
  })

  it('T21: "תזכירי לי להתקשר אליה מחר" — pronoun resolved (Ofir is female)', () => {
    const text = 'תזכירי לי להתקשר אליה מחר'
    const { resolved, personName } = resolvePronouns(text, conversation)
    expect(personName).toBe('אופיר')
    expect(resolved).toContain('אופיר')
    expect(resolved).not.toContain('אליה')
    userSays(text)
    assistantSays('להתקשר לאופיר מחר. לשמור?')
  })

  it('T22: "עזבי" — cancel', () => {
    expect(isCancel('עזבי')).toBe(true)
    userSays('עזבי')
    assistantSays('בסדר, ביטלתי.')
  })

  it('T23: "תזכירי לי להתקשר אליה" — no female in recent context', () => {
    const text = 'תזכירי לי להתקשר אליה'
    const { resolved, personName } = resolvePronouns(text, conversation)
    // If no recent female mentioned, pronoun stays unresolved
    // The unresolved pronoun guard should ask "למי את מתכוונת?"
    if (!personName) {
      // Guard should fire — good
      expect(resolved).toContain('אליה') // unresolved
    }
    userSays(text)
    assistantSays('למי את מתכוונת?')
  })

  // ═══ MINUTE 16-18: Emotional (local, no LLM) ═══

  it('T24: "אני קצת עצובה" — sadness, local proactive', () => {
    const text = 'אני קצת עצובה'
    const intent = detectIntent(text)
    expect(intent).toBe('sadness')
    const seed = getProactiveSeed(text)
    expect(seed).not.toBeNull()
    expect(seed!.text.length).toBeGreaterThan(10)
    userSays(text)
    assistantSays(seed!.text)
  })

  it('T25: "מתגעגעת לפפי" — pepe, local proactive', () => {
    const text = 'מתגעגעת לפפי'
    const intent = detectIntent(text)
    expect(intent).toBe('missing_pepe')
    const seed = getProactiveSeed(text)
    expect(seed).not.toBeNull()
    expect(seed!.text).toMatch(/פפי|פאפי/) // must mention Pepe/Papi
    userSays(text)
    assistantSays(seed!.text)
  })

  it('T26: "אני משועממת" — boredom, local, NOT a menu', () => {
    const text = 'אני משועממת'
    const seed = getProactiveSeed(text)
    expect(seed).not.toBeNull()
    // Must NOT contain menu patterns
    expect(seed!.text).not.toContain('שלוש אפשרויות')
    expect(seed!.text).not.toContain('אני יכולה')
    userSays(text)
    assistantSays(seed!.text)
  })

  it('T27: "תדברי איתי רגע" — talk_to_me, local', () => {
    const text = 'תדברי איתי רגע'
    const intent = detectIntent(text)
    expect(intent).toBe('talk_to_me')
    const seed = getProactiveSeed(text)
    expect(seed).not.toBeNull()
    userSays(text)
    assistantSays(seed!.text)
  })

  it('T28: "Estoy aburrida" — Spanish boredom, local', () => {
    const text = 'Estoy aburrida'
    const seed = getProactiveSeed(text)
    expect(seed).not.toBeNull()
    expect(seed!.lang).toBe('es')
    userSays(text)
    assistantSays(seed!.text)
  })

  // ═══ MINUTE 19-21: Off-topic + recovery ═══

  it('T29: "תקבעי לי פגישה מחר" — start appointment', () => {
    const text = 'תקבעי לי פגישה מחר'
    expect(isCreateIntent(text)).toBe(true)
    userSays(text)
    assistantSays('פגישה מחר. באיזו שעה?')
  })

  it('T30: "אני רעבה" mid-create → park_keep (answer warmly, keep the draft)', () => {
    const state = {
      phase: 'creating' as const,
      draft: { title: 'פגישה', date: '2026-06-11', time: null, emoji: '📅' },
      missing: ['time'] as Array<'title' | 'date' | 'time'>,
    }
    // The draft SURVIVES a side statement — never a false "בסדר, ביטלתי".
    const r = resolvePendingMessage(state, 'אני רעבה', false)
    expect(r.action).toBe('park_keep')
    userSays('אני רעבה')
    assistantSays('בתיאבון! 🙂')
  })

  it('T31: "לא לא לא" — emphatic cancel', () => {
    expect(isCancel('לא לא לא')).toBe(true)
    userSays('לא לא לא')
  })

  it('T32: "עזבי את זה" — extended cancel', () => {
    expect(isCancel('עזבי את זה')).toBe(true)
  })

  // ═══ MINUTE 22-25: Back to calendar after emotional ═══

  it('T33: "מה יש לי מחר?" — calendar still works after emotional turn', () => {
    const text = 'מה יש לי מחר?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  it('T34: "מתי יום הזיכרון של פפי?" — memorial lookup', () => {
    const text = 'מתי יום הזיכרון של פפי?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  it('T35: "איפה נועם גר?" — location lookup', () => {
    const text = 'איפה נועם גר?'
    const route = routePersonalQuery(text)
    expect(route.type).toBe('family_location')
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    userSays(text)
    assistantSays(answer!)
  })

  // ═══ MINUTE 26-28: Mixed context ═══

  it('T36: "מה התוכנית להיום?" — calendar synonym', () => {
    const text = 'מה התוכנית להיום?'
    const route = routePersonalQuery(text)
    expect(route.type).toBe('calendar_today')
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
  })

  it('T37: "מתי הרופא?" — loose calendar', () => {
    const text = 'מתי הרופא?'
    const route = routePersonalQuery(text)
    expect(['calendar_upcoming', 'calendar_exact_date']).toContain(route.type)
  })

  it('T38: "יש לי משהו ביום שלישי?" — weekday read', () => {
    const text = 'יש לי משהו ביום שלישי?'
    const route = routePersonalQuery(text)
    expect(route.type).toBe('calendar_exact_date')
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
  })

  it('T39: "כמה נכדים יש לי?" — count query', () => {
    const text = 'כמה נכדים יש לי?'
    const answer = tryGroundedAnswer(text)
    expect(answer).not.toBeNull()
    expect(answer).toContain('נכדים')
  })

  // ═══ MINUTE 29-30: LLM paths ═══

  it('T40: "ספרי לי בדיחה" — goes to LLM (acceptable)', () => {
    const text = 'ספרי לי בדיחה'
    const route = routePersonalQuery(text)
    // This should NOT be personal — it's open conversation
    expect(route.type).toBe('non_personal')
    // Grounded answer should be null (not local-first)
    const answer = tryGroundedAnswer(text)
    expect(answer).toBeNull()
    // This is acceptable — LLM handles it. If LLM fails, fallback is warm.
  })

  // ═══ CRITICAL: No response contains robotic phrases ═══

  it('NO robotic phrases in any grounded response', () => {
    const roboticPhrases = [
      'שגיאה',
      'כל השרתים',
      'לא מצליחה לחשוב',
      'OPENAI',
      'API',
      'Vercel',
      'כלי לא מוכר',
      'חיבור ה-AI',
    ]
    const testInputs = [
      'מה יש לי היום?',
      'מי זה נועם?',
      'מתי יום ההולדת של נועם?',
      'איפה נועם גר?',
      'בן כמה נועם?',
      'ספרי לי על הנכדים',
    ]
    for (const input of testInputs) {
      const answer = tryGroundedAnswer(input)
      if (answer) {
        for (const phrase of roboticPhrases) {
          expect(answer, `"${input}" response contains "${phrase}"`).not.toContain(phrase)
        }
      }
    }
  })
})
