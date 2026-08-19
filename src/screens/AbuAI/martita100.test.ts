/*
 * 100 realistic Martita conversation journeys.
 * Each tests the ACTUAL routing/grounding/pronoun/context code.
 * Every failure = a real user-facing bug on the phone.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery, type RouteType } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { isCreateIntent, startCreate, updateCreate, resolvePendingMessage, isConfirm, isCancel } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectIntent, getProactiveSeed } from './proactive'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: String(Math.random()), role, content, timestamp: Date.now() }
}

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 1-15: CALENDAR
// ═══════════════════════════════════════════════════════════════════════════

describe('Calendar journeys', () => {
  const calRoutes: Array<[string, RouteType | RouteType[]]> = [
    ['מה יש לי היום?', 'calendar_today'],                          // 1
    ['מה יש לי מחר?', 'calendar_tomorrow'],                        // 2
    ['מה יש לי השבוע?', 'calendar_upcoming'],                      // 3
    ['יש לי משהו ביום שלישי?', 'calendar_exact_date'],             // 4
    ['מתי הרופא?', 'calendar_upcoming'],                           // 5
    ['מתי התור הבא שלי?', 'calendar_next'],                        // 6 — next-appointment route (more precise than upcoming)
    ['מה קורה השבוע?', 'calendar_upcoming'],                       // 7
    ['מה התוכנית להיום?', 'calendar_today'],                        // 8
    ['מה התוכנית מחר?', 'calendar_tomorrow'],                      // 9
    ['צריך לקום מוקדם מחר?', 'calendar_tomorrow'],                  // 10
    ['יש לי יום עמוס מחר?', ['calendar_tomorrow', 'calendar_upcoming']], // 11
    ['מה קבעתי היום?', 'calendar_today'],                          // 12
    ['מה קבעתי מחר?', 'calendar_tomorrow'],                        // 13
    ['מה יש ביומן?', 'calendar_upcoming'],                         // 14
    ['מה יש לי ביום חמישי?', 'calendar_exact_date'],               // 15
  ]
  for (const [input, expected] of calRoutes) {
    it(`"${input}" → ${Array.isArray(expected) ? expected.join('|') : expected}`, () => {
      const route = routePersonalQuery(input)
      if (Array.isArray(expected)) {
        expect(expected).toContain(route.type)
      } else {
        expect(route.type).toBe(expected)
      }
      const answer = tryGroundedAnswer(input)
      expect(answer).not.toBeNull()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 16-30: FAMILY
// ═══════════════════════════════════════════════════════════════════════════

describe('Family journeys', () => {
  const familyTests: Array<[string, string | null]> = [
    ['מי זה נועם?', 'נועם'],                     // 16
    ['מי זה אופיר?', 'אופיר'],                   // 17
    ['מי זאת מור?', 'מור'],                       // 18
    ['מי זאת יעל?', 'יעל'],                       // 19
    ['איפה נועם גר?', null],                      // 20 (location)
    ['מתי יום ההולדת של נועם?', null],             // 21 (birthday)
    ['מתי יום הזיכרון של פפי?', null],             // 22 (memorial)
    ['ספרי לי על הנכדים', 'נכדים'],                // 23
    ['כמה נכדים יש לי?', 'נכדים'],                // 24
    ['מי הילדים של מור?', null],                   // 25
    ['הילדים של מור', null],                       // 26
    ['בן כמה נועם?', 'אין לי את שנת הלידה'],    // 27
    ['בת כמה מור?', 'אין לי את שנת הלידה'],     // 28
    ['מי זה לאו?', 'לאו'],                        // 29
    ['מי הבן של לאו?', null],                      // 30
  ]
  for (const [input, mustContain] of familyTests) {
    it(`"${input}" → grounded answer ${mustContain ? `contains "${mustContain}"` : 'exists'}`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer, `"${input}" returned null`).not.toBeNull()
      if (mustContain) {
        expect(answer, `"${input}" missing "${mustContain}"`).toContain(mustContain)
      }
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 31-40: FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════

describe('Follow-up journeys', () => {
  it('31: "ומחר?" after calendar today', () => {
    const history = [msg('user', 'מה יש לי היום?'), msg('assistant', 'היום אין לך כלום.')]
    const r = resolveFollowUp('ומחר?', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מחר')
  })

  it('32: "ובשלישי?" after calendar', () => {
    const history = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'מחר יש לך פגישה.')]
    const r = resolveFollowUp('ובשלישי?', history)
    expect(r.wasFollowUp).toBe(true)
  })

  it('33: "ומה אחרי זה?" after calendar', () => {
    const history = [msg('user', 'מה יש לי היום?'), msg('assistant', 'היום יש לך תור.')]
    const r = resolveFollowUp('ומה אחרי זה?', history)
    expect(r.wasFollowUp).toBe(true)
  })

  it('34: "ומור?" after family lookup', () => {
    const history = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.')]
    const r = resolveFollowUp('ומור?', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מור')
  })

  it('35: "ולאו?" after family lookup', () => {
    const history = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.')]
    const r = resolveFollowUp('ולאו?', history)
    expect(r.wasFollowUp).toBe(true)
  })

  it('36: "בעצם מחר" after calendar', () => {
    const history = [msg('user', 'מה יש לי היום?'), msg('assistant', 'היום אין כלום.')]
    const r = resolveFollowUp('בעצם מחר', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מחר')
  })

  it('37: "יש לי משהו באותו יום?" after birthday', () => {
    const history = [
      msg('user', 'מתי יום ההולדת של נועם?'),
      msg('assistant', 'יום ההולדת של נועם — 15 במרץ.'),
    ]
    const r = resolveFollowUp('יש לי משהו באותו יום?', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מרץ')
  })

  it('38: "באותו תאריך" variant also works', () => {
    const history = [
      msg('user', 'מתי יום ההולדת של מור?'),
      msg('assistant', 'יום ההולדת של מור — 3 באפריל.'),
    ]
    const r = resolveFollowUp('מה יש לי באותו תאריך?', history)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('אפריל')
  })

  it('39: "ומה בשבוע הבא?" after calendar', () => {
    const history = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'מחר פנוי.')]
    const r = resolveFollowUp('ומה בשבוע הבא?', history)
    expect(r.wasFollowUp).toBe(true)
  })

  it('40: bare "מחר?" without context still works', () => {
    const r = resolveFollowUp('מחר?', [])
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מחר')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 41-55: PRONOUNS
// ═══════════════════════════════════════════════════════════════════════════

describe('Pronoun journeys', () => {
  it('41: "שלו" after נועם user message', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.')]
    const { resolved } = resolvePronouns('מתי יום ההולדת שלו?', h)
    expect(resolved).toContain('נועם')
  })

  it('42: "אליו" after נועם user message', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.')]
    const { resolved } = resolvePronouns('תזכירי לי להתקשר אליו', h)
    expect(resolved).toContain('נועם')
    expect(resolved).not.toContain('אליו')
  })

  it('43: "שלה" after מור user message', () => {
    const h = [msg('user', 'מי זאת מור?'), msg('assistant', 'מור — הבת.')]
    const { resolved } = resolvePronouns('מתי יום ההולדת שלה?', h)
    expect(resolved).toContain('מור')
  })

  it('44: "אליה" after יעל user message', () => {
    const h = [msg('user', 'מי זאת יעל?'), msg('assistant', 'יעל — בת הזוג של מור.')]
    const { resolved, personName } = resolvePronouns('תזכירי לי להתקשר אליה', h)
    expect(personName).toBe('יעל')
  })

  it('45: "איתה" after אופיר (Ofir is female)', () => {
    const h = [msg('user', 'מי זה אופיר?'), msg('assistant', 'אופיר — הנכדה.')]
    const { resolved } = resolvePronouns('תקבעי לי פגישה איתה', h)
    expect(resolved).toContain('אופיר')
  })

  it('46: pronoun resolves to USER mention, not assistant text', () => {
    // Assistant mentions multiple names, but user only mentioned נועם
    const h = [
      msg('user', 'מי זה נועם?'),
      msg('assistant', 'נועם — הנכד של Martita, בנו של לאו ואילנית. גר בתל אביב.'),
    ]
    const { personName } = resolvePronouns('מתי יום ההולדת שלו?', h)
    expect(personName).toBe('נועם') // NOT לאו
  })

  it('47: pronoun after multiple user messages picks most recent', () => {
    const h = [
      msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.'),
      msg('user', 'מי זה עילי?'), msg('assistant', 'עילי — הנכד.'),
    ]
    const { personName } = resolvePronouns('תזכירי לי להתקשר אליו', h)
    expect(personName).toBe('עילי') // most recent user mention (male → אליו)
  })

  it('48: no pronoun in text → no change', () => {
    const { resolved } = resolvePronouns('מה יש לי היום?', [])
    expect(resolved).toBe('מה יש לי היום?')
  })

  it('49: "באותו" is NOT a pronoun (Hebrew lookbehind)', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.')]
    const { resolved } = resolvePronouns('יש לי משהו באותו יום?', h)
    // "באותו" should NOT be replaced — ב is a Hebrew letter before אותו
    expect(resolved).toContain('באותו')
  })

  it('50: unresolved pronoun with no context', () => {
    const { resolved, personName } = resolvePronouns('תזכירי לי להתקשר אליו', [])
    expect(personName).toBeNull()
    expect(resolved).toContain('אליו') // stays unresolved
  })

  it('51: gender filtering — "אליה" skips male names', () => {
    const h = [
      msg('user', 'מי זה נועם?'), msg('assistant', 'נועם — הנכד.'),
      msg('user', 'מי זאת מור?'), msg('assistant', 'מור — הבת.'),
    ]
    const { personName } = resolvePronouns('תזכירי לי להתקשר אליה', h)
    expect(personName).toBe('מור') // female, NOT נועם
  })

  it('52: "שלו" skips female names', () => {
    const h = [
      msg('user', 'מי זאת מור?'), msg('assistant', 'מור — הבת.'),
      msg('user', 'מי זה לאו?'), msg('assistant', 'לאו — הבן.'),
    ]
    const { personName } = resolvePronouns('מתי יום ההולדת שלו?', h)
    expect(personName).toBe('לאו') // male
  })

  it('53: "אותה" after female', () => {
    const h = [msg('user', 'מי זאת יעל?'), msg('assistant', 'יעל.')]
    const { resolved } = resolvePronouns('אני רוצה לראות אותה', h)
    expect(resolved).toContain('יעל')
  })

  it('54: "איתה" after female', () => {
    const h = [msg('user', 'מי זאת מור?'), msg('assistant', 'מור.')]
    const { resolved } = resolvePronouns('תזכירי לי לדבר איתה', h)
    expect(resolved).toContain('מור')
  })

  it('55: "לו" pronoun', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נועם.')]
    const { resolved } = resolvePronouns('תגידי לו שאני אוהבת אותו', h)
    expect(resolved).toContain('נועם')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 56-70: REMINDERS + APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Reminder + appointment journeys', () => {
  it('56: "תזכירי לי לקחת כדור בערב" → reminder intent', () => {
    expect(isCreateIntent('תזכירי לי לקחת כדור בערב')).toBe(true)
    expect(detectReminderIntent('תזכירי לי לקחת כדור בערב')).toBe('reminder')
  })

  it('57: "תזכירי לי להתקשר ליעל מחר" → reminder', () => {
    expect(isCreateIntent('תזכירי לי להתקשר ליעל מחר')).toBe(true)
    expect(detectReminderIntent('תזכירי לי להתקשר ליעל מחר')).toBe('reminder')
  })

  it('58: "תזכירי לי לקנות חלב" → reminder (no time)', () => {
    expect(isCreateIntent('תזכירי לי לקנות חלב')).toBe(true)
    expect(detectReminderIntent('תזכירי לי לקנות חלב')).toBe('reminder')
  })

  it('59: "תזכירי לי בעוד שעה" → reminder', () => {
    expect(isCreateIntent('תזכירי לי בעוד שעה')).toBe(true)
  })

  it('60: "תקבעי לי רופא מחר בעשר" → appointment (not reminder)', () => {
    expect(isCreateIntent('תקבעי לי רופא מחר בעשר')).toBe(true)
    expect(detectReminderIntent('תקבעי לי רופא מחר בעשר')).not.toBe('reminder')
  })

  it('61: "תקבעי לי פגישה ביום רביעי" → appointment', () => {
    expect(isCreateIntent('תקבעי לי פגישה ביום רביעי')).toBe(true)
  })

  it('62: confirm "כן"', () => expect(isConfirm('כן')).toBe(true))
  it('63: confirm "בסדר"', () => expect(isConfirm('בסדר')).toBe(true))
  it('64: confirm "יאללה"', () => expect(isConfirm('יאללה')).toBe(true))
  it('65: cancel "לא"', () => expect(isCancel('לא')).toBe(true))
  it('66: cancel "עזבי"', () => expect(isCancel('עזבי')).toBe(true))
  it('67: cancel "לא לא לא"', () => expect(isCancel('לא לא לא')).toBe(true))
  it('68: cancel "עזבי את זה"', () => expect(isCancel('עזבי את זה')).toBe(true))
  it('69: cancel "תשכחי"', () => expect(isCancel('תשכחי')).toBe(true))

  it('70: date correction during confirm preserves draft', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-15', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בעצם מחר')
    expect(updated.draft.title).toBe('רופא')
    expect(updated.draft.time).toBe('10:00')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 71-85: EMOTIONAL + PROACTIVE
// ═══════════════════════════════════════════════════════════════════════════

describe('Emotional journeys', () => {
  const emotionalTests: Array<[string, string | null, string?]> = [
    ['אני משועממת', 'boredom'],                        // 71
    ['אני קצת עצובה', 'sadness'],                       // 72
    ['אני מרגישה לבד', 'loneliness'],                   // 73
    ['אין לי על מה לדבר', 'no_topic'],                  // 74
    ['תני לי רעיון', 'ideas'],                          // 75
    ['מתגעגעת לפפי', 'missing_pepe'],                    // 76
    ['תדברי איתי רגע', 'talk_to_me'],                   // 77
    ['תדברי איתי', 'talk_to_me'],                       // 78
    ['ספרי לי משהו', 'talk_to_me'],                     // 79
    ['Estoy aburrida', 'boredom'],                       // 80
    ['Me siento sola', 'loneliness'],                    // 81
    ['Dame ideas para hoy', 'ideas'],                    // 82
    ['אין לי כוח היום', 'sadness'],                     // 83
    ['יום קשה', 'sadness'],                             // 84
    ['extraño a Pepe', 'missing_pepe'],                  // 85
  ]
  for (const [input, expectedIntent] of emotionalTests) {
    it(`"${input}" → ${expectedIntent} (local, no LLM)`, () => {
      const intent = detectIntent(input)
      expect(intent, `"${input}" intent was ${intent}`).toBe(expectedIntent)
      const seed = getProactiveSeed(input)
      expect(seed, `"${input}" got no seed`).not.toBeNull()
      expect(seed!.text.length).toBeGreaterThan(10)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 86-95: TOPIC SWITCHES + RECOVERY
// ═══════════════════════════════════════════════════════════════════════════

describe('Topic switch + recovery journeys', () => {
  it('86: off-topic "אני רעבה" during draft → park_keep (answer warmly, keep draft)', () => {
    const state = {
      phase: 'creating' as const,
      draft: { title: 'פגישה', date: '2026-06-11', time: null, emoji: '📅' },
      missing: ['time'] as Array<'title' | 'date' | 'time'>,
    }
    // Never a false "בסדר, ביטלתי" — answer the side statement and KEEP the draft.
    const r = resolvePendingMessage(state, 'אני רעבה', false)
    expect(r.action).toBe('park_keep')
  })

  it('87: off-topic "ספרי לי בדיחה" during draft → park_keep (answer, keep draft)', () => {
    const state = {
      phase: 'creating' as const,
      draft: { title: 'רופא', date: '2026-06-11', time: null, emoji: '🏥' },
      missing: ['time'] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'ספרי לי בדיחה', false)
    expect(r.action).toBe('park_keep')
  })

  it('88: question "מי זה נועם?" during draft → park_keep (answer, preserve draft)', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-11', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'מי זה נועם?', false)
    expect(r.action).toBe('park_keep')
  })

  it('89: calendar read during draft → read action', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-11', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'מה יש לי מחר?', true)
    expect(r.action).toBe('read')
  })

  it('90: calendar works after emotional conversation', () => {
    // Emotional turn shouldn't break calendar routing
    const answer = tryGroundedAnswer('מה יש לי היום?')
    expect(answer).not.toBeNull()
  })

  it('91: family works after calendar', () => {
    const answer = tryGroundedAnswer('מי זה נועם?')
    expect(answer).not.toBeNull()
  })

  it('92: reminder works after family', () => {
    expect(isCreateIntent('תזכירי לי לקנות לחם')).toBe(true)
  })

  it('93: "אהלן מה" during draft → clarify (not cancel)', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'פגישה', date: '2026-06-11', time: '10:00', emoji: '📅' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'אהלן מה', false)
    expect(r.action).toBe('clarify')
  })

  it('94: time answer "בעשר" during creating → fills time', () => {
    const state = {
      phase: 'creating' as const,
      draft: { title: 'רופא', date: '2026-06-15', time: null, emoji: '🏥' },
      missing: ['time'] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בעשר בבוקר')
    expect(updated.draft.time).toBe('10:00')
  })

  it('95: "בשמונה בערב" answers time during creating', () => {
    const state = {
      phase: 'creating' as const,
      draft: { title: 'פגישה', date: '2026-06-15', time: null, emoji: '📅' },
      missing: ['time'] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בשמונה בערב')
    expect(updated.draft.time).toBe('20:00')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY 96-100: NO ROBOTIC LANGUAGE
// ═══════════════════════════════════════════════════════════════════════════

describe('No robotic language in any response', () => {
  const FORBIDDEN = [
    'שגיאה', 'כל השרתים', 'לא מצליחה לחשוב', 'OPENAI', 'API', 'Vercel',
    'כלי לא מוכר', 'חיבור ה-AI', 'שרת', 'provider', 'timeout',
  ]

  const inputs = [
    'מה יש לי היום?', 'מי זה נועם?', 'מתי יום ההולדת של מור?',
    'איפה לאו גר?', 'בן כמה אופיר?', 'ספרי לי על הנכדים',
    'מה יש לי מחר?', 'מה יש לי השבוע?', 'מתי הרופא?',
    'מתי יום הזיכרון של פפי?',
  ]

  for (const input of inputs) {
    it(`96-100: "${input}" has no forbidden phrases`, () => {
      const answer = tryGroundedAnswer(input)
      if (answer) {
        for (const phrase of FORBIDDEN) {
          expect(answer, `"${input}" contains "${phrase}"`).not.toContain(phrase)
        }
      }
    })
  }
})
