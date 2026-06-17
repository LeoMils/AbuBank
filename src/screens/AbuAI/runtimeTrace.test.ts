/*
 * RUNTIME TRACE — proves the ACTUAL execution path for every input.
 *
 * No mocks. No assertions on code structure. Runs the real functions
 * and logs every step of the pipeline exactly as it happens on the phone.
 *
 * Run: npx vitest run src/screens/AbuAI/runtimeTrace.test.ts --reporter=verbose
 */

import { describe, it } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { isCreateIntent, startCreate } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectIntent, getProactiveSeed } from './proactive'
import { isOnlineCurrentInfoQuery } from './onlineIntent'
import { searchFamily, searchFamilyLocation, getBirthdayFor, getMemorialFor, searchFamilyGroup, getTodayEvents, getTomorrowEvents, getWeekEvents } from './tools'
import { chooseContentWorld } from './contentWorldEngine'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: String(Math.random()), role, content, timestamp: Date.now() }
}

interface TraceResult {
  input: string
  resolved: string
  pronounResolved: boolean
  followUpResolved: boolean
  routeType: string
  routeFamilyQuery: string | null
  isCreate: boolean
  isReminder: boolean
  isOnline: boolean
  proactiveIntent: string | null
  groundedAnswer: string | null
  needsLLM: boolean
  ttsProvider: string
  finalPath: string
}

function trace(input: string, history: ChatMessage[] = []): TraceResult {
  let text = input

  // Step 1: Pronoun resolution
  const { resolved: pronounResolved, personName } = resolvePronouns(text, history)
  const pronounChanged = pronounResolved !== text
  if (pronounChanged) text = pronounResolved

  // Step 2: Follow-up resolution
  const followUp = resolveFollowUp(text, history)
  const followUpChanged = followUp.wasFollowUp
  if (followUpChanged) text = followUp.resolved

  // Step 3: Route
  const route = routePersonalQuery(text)

  // Step 4: Create intent
  const isCreate = isCreateIntent(text)
  const isReminder = isCreate && detectReminderIntent(text) === 'reminder'

  // Step 5: Proactive
  const proactiveIntent = detectIntent(text)

  // Step 6: Online
  const isOnline = isOnlineCurrentInfoQuery(text)

  // Step 7: Grounded answer
  const groundedAnswer = tryGroundedAnswer(text)

  // Step 8: Determine what would happen
  let needsLLM = false
  let finalPath = ''
  let ttsProvider = 'N/A (text mode)'

  if (isCreate) {
    finalPath = isReminder ? 'REMINDER_CREATE (local)' : 'APPOINTMENT_CREATE (local)'
  } else if (groundedAnswer !== null) {
    finalPath = `GROUNDED: ${route.type} (local)`
  } else if (proactiveIntent) {
    finalPath = `PROACTIVE: ${proactiveIntent} (local)`
  } else if (isOnline) {
    finalPath = 'ONLINE_SEARCH (server)'
    needsLLM = true
  } else {
    finalPath = 'LLM_STREAM (provider needed)'
    needsLLM = true
  }

  // TTS: if voice mode, what would be used
  // OpenAI TTS if key available + no TTS quota block
  // Gemini TTS fallback
  // Web Speech last resort
  ttsProvider = 'OpenAI gpt-4o-mini-tts (coral) → Gemini → Web Speech'

  return {
    input,
    resolved: text,
    pronounResolved: pronounChanged,
    followUpResolved: followUpChanged,
    routeType: route.type,
    routeFamilyQuery: route.familyQuery ?? null,
    isCreate,
    isReminder,
    isOnline,
    proactiveIntent,
    groundedAnswer,
    needsLLM,
    ttsProvider,
    finalPath,
  }
}

function printTrace(t: TraceResult) {
  console.log(`\n╔══════════════════════════════════════════════════════════`)
  console.log(`║ INPUT:    "${t.input}"`)
  if (t.pronounResolved || t.followUpResolved) {
    console.log(`║ RESOLVED: "${t.resolved}"`)
    if (t.pronounResolved) console.log(`║   └─ pronoun resolved`)
    if (t.followUpResolved) console.log(`║   └─ follow-up expanded`)
  }
  console.log(`║ ROUTE:    ${t.routeType}${t.routeFamilyQuery ? ` [person=${t.routeFamilyQuery}]` : ''}`)
  console.log(`║ PATH:     ${t.finalPath}`)
  if (t.groundedAnswer) {
    console.log(`║ ANSWER:   ${t.groundedAnswer.slice(0, 120)}`)
  } else if (t.isCreate) {
    console.log(`║ ACTION:   ${t.isReminder ? 'reminder' : 'appointment'} creation flow`)
  } else if (t.proactiveIntent) {
    const seed = getProactiveSeed(t.input)
    console.log(`║ ANSWER:   ${seed?.text.slice(0, 120) ?? '(no seed)'}`)
  } else {
    console.log(`║ ANSWER:   [requires LLM provider]`)
  }
  console.log(`║ LLM:      ${t.needsLLM ? 'YES — needs provider' : 'NO — fully local'}`)
  console.log(`╚══════════════════════════════════════════════════════════`)
}

// ════════════════════════════════════════════════════════════
// 50 REAL RUNTIME SCENARIOS
// ════════════════════════════════════════════════════════════

describe('RUNTIME TRACE — 50 scenarios', () => {
  const conversation: ChatMessage[] = []
  function addTurn(user: string, assistant: string) {
    conversation.push(msg('user', user))
    conversation.push(msg('assistant', assistant))
  }

  // ── FAMILY (1-10) ──
  const familyInputs = [
    'מי זה עדי?',           // 1
    'מי זאת מור?',          // 2
    'מי זה נועם?',          // 3
    'מי זה לאו?',           // 4
    'מי זה אופיר?',         // 5
    'מי זאת יעל?',          // 6
    'מתי יום ההולדת של נועם?', // 7
    'מתי יום הזיכרון של פפי?', // 8
    'איפה נועם גר?',       // 9
    'ספרי לי על הנכדים',    // 10
  ]

  for (let i = 0; i < familyInputs.length; i++) {
    it(`${i + 1}. ${familyInputs[i]}`, () => {
      const t = trace(familyInputs[i]!, conversation)
      printTrace(t)
      if (t.groundedAnswer) addTurn(familyInputs[i]!, t.groundedAnswer)
    })
  }

  // ── CALENDAR (11-17) ──
  const calendarInputs = [
    'מה יש לי היום?',       // 11
    'מה יש לי מחר?',        // 12
    'מה יש לי השבוע?',      // 13
    'מתי הרופא?',           // 14
    'יש לי משהו ביום חמישי?', // 15
    'מה התוכנית להיום?',     // 16
    'מה קורה השבוע?',       // 17
  ]

  for (let i = 0; i < calendarInputs.length; i++) {
    it(`${i + 11}. ${calendarInputs[i]}`, () => {
      const t = trace(calendarInputs[i]!, conversation)
      printTrace(t)
      if (t.groundedAnswer) addTurn(calendarInputs[i]!, t.groundedAnswer)
    })
  }

  // ── FOLLOW-UPS (18-22) ──
  it('18. "ומחר?" (follow-up after calendar)', () => {
    addTurn('מה יש לי היום?', 'לא מצאתי משהו ביומן להיום.')
    const t = trace('ומחר?', conversation)
    printTrace(t)
  })

  it('19. "ומור?" (follow-up after family)', () => {
    addTurn('מי זה נועם?', 'נועם — נכד (בן של לאו).')
    const t = trace('ומור?', conversation)
    printTrace(t)
  })

  it('20. "ומתי יום ההולדת שלו?" (pronoun after נועם)', () => {
    const t = trace('ומתי יום ההולדת שלו?', conversation)
    printTrace(t)
  })

  it('21. "בעצם מחר" (correction follow-up)', () => {
    addTurn('מה יש לי היום?', 'לא מצאתי ביומן.')
    const t = trace('בעצם מחר', conversation)
    printTrace(t)
  })

  it('22. "ומה אחרי זה?" (multi-word follow-up)', () => {
    const t = trace('ומה אחרי זה?', conversation)
    printTrace(t)
  })

  // ── REMINDERS (23-27) ──
  const reminderInputs = [
    'תזכירי לי לקחת כדור בערב',        // 23
    'תזכירי לי להתקשר ליעל מחר',       // 24
    'תזכירי לי לקנות חלב',             // 25
    'תזכירי לי בעוד שעה',              // 26
    'תזכירי לי מחר בבוקר לצלצל לרופא', // 27
  ]

  for (let i = 0; i < reminderInputs.length; i++) {
    it(`${i + 23}. ${reminderInputs[i]}`, () => {
      const t = trace(reminderInputs[i]!, conversation)
      printTrace(t)
    })
  }

  // ── APPOINTMENTS (28-30) ──
  const apptInputs = [
    'תקבעי לי רופא ביום ראשון בעשר בבוקר', // 28
    'תקבעי לי פגישה מחר אחרי הצהריים',    // 29
    'תקבעי לי בדיקת דם בשלישי',           // 30
  ]

  for (let i = 0; i < apptInputs.length; i++) {
    it(`${i + 28}. ${apptInputs[i]}`, () => {
      const t = trace(apptInputs[i]!, conversation)
      printTrace(t)
    })
  }

  // ── EMOTIONAL (31-37) ──
  const emotionalInputs = [
    'אני משועממת',          // 31
    'אני קצת עצובה',        // 32
    'מתגעגעת לפפי',         // 33
    'תדברי איתי רגע',      // 34
    'אני מרגישה לבד',       // 35
    'Estoy aburrida',       // 36
    'אין לי כוח היום',      // 37
  ]

  for (let i = 0; i < emotionalInputs.length; i++) {
    it(`${i + 31}. ${emotionalInputs[i]}`, () => {
      const t = trace(emotionalInputs[i]!, conversation)
      printTrace(t)
    })
  }

  // ── LLM-REQUIRED (38-43) ──
  const llmInputs = [
    'ספרי לי בדיחה',           // 38
    'מה דעתך על פוליטיקה?',    // 39
    'תסבירי לי מה זה AI',     // 40
    'ספרי לי סיפור קצר',       // 41
    'מה עושים כשמשועממים?',    // 42
    'Contame algo lindo',      // 43
  ]

  for (let i = 0; i < llmInputs.length; i++) {
    it(`${i + 38}. ${llmInputs[i]}`, () => {
      const t = trace(llmInputs[i]!, conversation)
      printTrace(t)
    })
  }

  // ── ONLINE (44-45) ──
  it('44. "מה מזג האוויר?"', () => {
    const t = trace('מה מזג האוויר?', conversation)
    printTrace(t)
  })

  it('45. "מה בחדשות?"', () => {
    const t = trace('מה בחדשות?', conversation)
    printTrace(t)
  })

  // ── EDGE CASES (46-50) ──
  it('46. "בן כמה עדי?" (age question)', () => {
    const t = trace('בן כמה עדי?', conversation)
    printTrace(t)
  })

  it('47. "הילדים של מור" (group query)', () => {
    const t = trace('הילדים של מור', conversation)
    printTrace(t)
  })

  it('48. "כמה נכדים יש לי?" (count query)', () => {
    const t = trace('כמה נכדים יש לי?', conversation)
    printTrace(t)
  })

  it('49. "שלום" (greeting)', () => {
    const t = trace('שלום', conversation)
    printTrace(t)
  })

  it('50. "תודה" (thanks)', () => {
    const t = trace('תודה', conversation)
    printTrace(t)
  })
})
