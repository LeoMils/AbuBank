/*
 * PRODUCTION 200 — 200 real Hebrew inputs through the actual pipeline.
 * Every test runs the REAL routing/grounding/pronoun/proactive functions.
 * Failures here = user-visible bugs on the phone.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { isCreateIntent, isConfirm, isCancel } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectIntent, getProactiveSeed } from './proactive'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: String(Math.random()), role, content, timestamp: Date.now() }
}

// ═══ FAMILY (1-30) ═══
describe('FAMILY — 30 scenarios', () => {
  const cases: Array<[string, string | RegExp | null]> = [
    // Basic lookups
    ['מי זה עדי?', 'עדי'],                    // 1
    ['מי זאת מור?', 'מור'],                   // 2
    ['מי זה נועם?', 'נועם'],                  // 3
    ['מי זה לאו?', 'לאו'],                    // 4
    ['מי זה אופיר?', 'אופיר'],               // 5
    ['מי זאת יעל?', 'יעל'],                   // 6
    ['מי זה איילון?', 'איילון'],              // 7
    ['מי זה עילי?', 'עילי'],                  // 8
    ['מי זה אדר?', 'אדר'],                    // 9
    ['מי זה גלעד?', 'גלעד'],                  // 10
    // Typo tolerance
    ['מי זה אדי?', 'עדי'],                    // 11 — typed אדי, display עדי
    // Birthdays
    ['מתי יום ההולדת של נועם?', 'נועם'],       // 12
    ['מתי יום ההולדת של עדי?', 'עדי'],         // 13
    ['מתי יום ההולדת של מור?', 'מור'],         // 14
    // Memorial
    ['מתי יום הזיכרון של פפי?', 'פפי'],        // 15
    // Location
    ['איפה נועם גר?', 'נועם גר ב'],             // 16 — must be masculine "גר"
    ['איפה עדי גר?', 'עדי גר ב'],              // 17 — must be masculine "גר"
    ['איפה מור גרה?', /מור גרה/],             // 18 — must be feminine "גרה"
    // Group queries
    ['ספרי לי על הנכדים', 'נכדים'],            // 19
    ['כמה נכדים יש לי?', 'נכדים'],            // 20
    ['מי הילדים שלי?', null],                  // 21 — any answer
    ['הילדים של מור', 'מור'],                  // 22
    ['מי הנכדים שלי?', 'נכדים'],              // 23
    // Age (honest)
    ['בן כמה נועם?', 'אין לי את שנת הלידה'], // 24
    ['בת כמה מור?', 'אין לי את שנת הלידה'],  // 25
    ['בן כמה עדי?', 'אין לי את שנת הלידה'],  // 26
    // Relationships
    ['מי זה רפי?', null],                      // 27
    ['מי זאת אילנית?', null],                  // 28
    // Not found
    ['מי זה דניאל?', /לא מכירה|לא יודעת/],    // 29
    // Relationship between
    ['מה הקשר בין מור ללאו?', null],           // 30
  ]
  for (let i = 0; i < cases.length; i++) {
    const [input, check] = cases[i]!
    it(`${i + 1}. "${input}"`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer, `"${input}" returned null`).not.toBeNull()
      if (check instanceof RegExp) {
        expect(answer).toMatch(check)
      } else if (typeof check === 'string') {
        expect(answer).toContain(check)
      }
    })
  }
})

// ═══ CALENDAR (31-50) ═══
describe('CALENDAR — 20 scenarios', () => {
  const cases: Array<[string, string]> = [
    ['מה יש לי היום?', 'calendar_today'],
    ['מה יש לי מחר?', 'calendar_tomorrow'],
    ['מה יש לי השבוע?', 'calendar_upcoming'],
    ['מתי הרופא?', 'calendar_upcoming'],
    ['מתי התור הבא שלי?', 'calendar_next'],
    ['יש לי משהו ביום חמישי?', 'calendar_exact_date'],
    ['מה התוכנית להיום?', 'calendar_today'],
    ['מה קורה השבוע?', 'calendar_upcoming'],
    ['מה קבעתי היום?', 'calendar_today'],
    ['מה קבעתי מחר?', 'calendar_tomorrow'],
    ['מה יש ביומן?', 'calendar_upcoming'],
    ['מה יש לי ביום שלישי?', 'calendar_exact_date'],
    ['מה יש לי ביום ראשון?', 'calendar_exact_date'],
    ['צריך לקום מוקדם מחר?', 'calendar_tomorrow'],
    ['מה התוכנית מחר?', 'calendar_tomorrow'],
    ['יש לי יום עמוס מחר?', 'calendar_'],
    ['מתי הפגישה הבאה שלי?', 'calendar_'],
    ['מה יש אחרי הצהריים?', 'calendar_'],
    // 'יש לי פגישה מחר?' is ambiguous (question vs create) — handled by CALENDAR_HEBREW_LOOSE
    ['אני פנויה מחר?', 'calendar_'],
    ['מה יש לי ביום רביעי?', 'calendar_exact_date'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const [input, routePrefix] = cases[i]!
    it(`${i + 31}. "${input}"`, () => {
      const route = routePersonalQuery(input)
      expect(route.type).toMatch(new RegExp(`^${routePrefix}`))
      const answer = tryGroundedAnswer(input)
      expect(answer).not.toBeNull()
      // Calendar answers must not contain robotic phrases
      expect(answer).not.toContain('שגיאה')
      expect(answer).not.toContain('provider')
    })
  }
})

// ═══ FOLLOW-UPS (51-70) ═══
describe('FOLLOW-UPS — 20 scenarios', () => {
  it('51. "ומחר?" after calendar', () => {
    const h = [msg('user', 'מה יש לי היום?'), msg('assistant', 'לא מצאתי.')]
    expect(resolveFollowUp('ומחר?', h).wasFollowUp).toBe(true)
  })
  it('52. "ובשלישי?" after calendar', () => {
    const h = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'פנוי.')]
    expect(resolveFollowUp('ובשלישי?', h).wasFollowUp).toBe(true)
  })
  it('53. "ומה אחרי זה?" after calendar', () => {
    const h = [msg('user', 'מה יש לי היום?'), msg('assistant', 'תור.')]
    expect(resolveFollowUp('ומה אחרי זה?', h).wasFollowUp).toBe(true)
  })
  it('54. "ומור?" after family', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.')]
    const r = resolveFollowUp('ומור?', h)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מור')
  })
  it('55. "ולאו?" after family', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.')]
    expect(resolveFollowUp('ולאו?', h).wasFollowUp).toBe(true)
  })
  it('56. "בעצם מחר" correction', () => {
    const h = [msg('user', 'מה יש לי היום?'), msg('assistant', 'כלום.')]
    expect(resolveFollowUp('בעצם מחר', h).wasFollowUp).toBe(true)
  })
  it('57. "באותו יום" after birthday', () => {
    const h = [msg('user', 'מתי יום ההולדת של נועם?'), msg('assistant', 'יום ההולדת של נועם — 5 באפריל.')]
    const r = resolveFollowUp('יש לי משהו באותו יום?', h)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('אפריל')
  })
  it('58. "שלו" pronoun after male', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.')]
    expect(resolvePronouns('מתי יום ההולדת שלו?', h).resolved).toContain('נועם')
  })
  it('59. "שלה" pronoun after female', () => {
    const h = [msg('user', 'מי זאת מור?'), msg('assistant', 'הבת.')]
    expect(resolvePronouns('מתי יום ההולדת שלה?', h).resolved).toContain('מור')
  })
  it('60. "אליו" pronoun after male', () => {
    const h = [msg('user', 'מי זה אופיר?'), msg('assistant', 'נכד.')]
    const r = resolvePronouns('תזכירי לי להתקשר אליו', h)
    expect(r.resolved).toContain('אופיר')
  })
  it('61. "אליה" pronoun after female', () => {
    const h = [msg('user', 'מי זאת יעל?'), msg('assistant', 'בת זוג.')]
    expect(resolvePronouns('תזכירי לי להתקשר אליה', h).personName).toBe('יעל')
  })
  it('62. pronoun picks USER mention over assistant text', () => {
    const h = [
      msg('user', 'מי זה נועם?'),
      msg('assistant', 'נועם — נכד של Martita, בנו של לאו ואילנית.'),
    ]
    expect(resolvePronouns('מתי יום ההולדת שלו?', h).personName).toBe('נועם')
  })
  it('63. most recent user mention wins', () => {
    const h = [
      msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.'),
      msg('user', 'מי זה אופיר?'), msg('assistant', 'נכד.'),
    ]
    expect(resolvePronouns('תזכירי לי להתקשר אליו', h).personName).toBe('אופיר')
  })
  it('64. gender filter — אליה skips males', () => {
    const h = [
      msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.'),
      msg('user', 'מי זאת מור?'), msg('assistant', 'הבת.'),
    ]
    expect(resolvePronouns('תזכירי לי להתקשר אליה', h).personName).toBe('מור')
  })
  it('65. "באותו" NOT treated as pronoun', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.')]
    expect(resolvePronouns('יש לי משהו באותו יום?', h).resolved).toContain('באותו')
  })
  it('66. no pronoun → no change', () => {
    expect(resolvePronouns('מה יש לי היום?', []).resolved).toBe('מה יש לי היום?')
  })
  it('67. "ושבוע הבא?" after calendar', () => {
    const h = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'פנוי.')]
    expect(resolveFollowUp('ושבוע הבא?', h).wasFollowUp).toBe(true)
  })
  it('68. "בעצם בשלישי" correction', () => {
    const h = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'פנוי.')]
    expect(resolveFollowUp('בעצם בשלישי', h).wasFollowUp).toBe(true)
  })
  it('69. bare "מחר?" without context', () => {
    expect(resolveFollowUp('מחר?', []).wasFollowUp).toBe(true)
  })
  it('70. "ומה בשבוע הבא?" after calendar', () => {
    const h = [msg('user', 'מה יש לי מחר?'), msg('assistant', 'פנוי.')]
    expect(resolveFollowUp('ומה בשבוע הבא?', h).wasFollowUp).toBe(true)
  })
})

// ═══ REMINDERS + APPOINTMENTS (71-100) ═══
describe('REMINDERS + APPOINTMENTS — 30 scenarios', () => {
  // Reminder detection
  const reminders: string[] = [
    'תזכירי לי לקחת כדור בערב',
    'תזכירי לי לקחת כדור בשמונה בערב',
    'תזכירי לי להתקשר ליעל מחר',
    'תזכירי לי לקנות חלב',
    'תזכירי לי בעוד שעה',
    'תזכירי לי מחר בבוקר לצלצל לרופא',
    'תזכירי לי לשתות מים',
    'תזכירי לי לקחת תרופה',
  ]
  for (let i = 0; i < reminders.length; i++) {
    it(`${i + 71}. reminder: "${reminders[i]}"`, () => {
      expect(isCreateIntent(reminders[i]!)).toBe(true)
      expect(detectReminderIntent(reminders[i]!)).toBe('reminder')
    })
  }
  // Appointment detection
  const appointments: string[] = [
    'תקבעי לי רופא בשלישי בעשר',
    'תקבעי לי פגישה מחר אחרי הצהריים',
    'תקבעי לי בדיקת דם בשלישי',
    'תקבעי לי תור לרופא',
    'תרשמי לי פגישה ביום ראשון',
  ]
  for (let i = 0; i < appointments.length; i++) {
    it(`${i + 79}. appointment: "${appointments[i]}"`, () => {
      expect(isCreateIntent(appointments[i]!)).toBe(true)
      expect(detectReminderIntent(appointments[i]!)).not.toBe('reminder')
    })
  }
  // Confirm/cancel
  const confirms = ['כן', 'בסדר', 'יאללה', 'נכון', 'בטח', 'אוקיי', 'מאשרת']
  const cancels = ['לא', 'עזבי', 'לא לא לא', 'עזבי את זה', 'תשכחי', 'לא צריך', 'ביטול']
  for (const c of confirms) {
    it(`confirm: "${c}"`, () => expect(isConfirm(c)).toBe(true))
  }
  for (const c of cancels) {
    it(`cancel: "${c}"`, () => expect(isCancel(c)).toBe(true))
  }
})

// ═══ EMOTIONAL (101-120) ═══
describe('EMOTIONAL — 20 scenarios', () => {
  const cases: Array<[string, string]> = [
    ['אני משועממת', 'boredom'],
    ['אני קצת עצובה', 'sadness'],
    ['אני מרגישה לבד', 'loneliness'],
    ['אין לי על מה לדבר', 'no_topic'],
    ['תני לי רעיון', 'ideas'],
    ['מתגעגעת לפפי', 'missing_pepe'],
    ['תדברי איתי רגע', 'talk_to_me'],
    ['תדברי איתי', 'talk_to_me'],
    ['ספרי לי משהו', 'talk_to_me'],
    ['אין לי כוח היום', 'sadness'],
    ['יום קשה', 'sadness'],
    ['תודה', 'thanks'],
    ['תודה רבה', 'thanks'],
    ['Estoy aburrida', 'boredom'],
    ['Me siento sola', 'loneliness'],
    ['Dame ideas para hoy', 'ideas'],
    ['extraño a Pepe', 'missing_pepe'],
    ['Contame algo', 'talk_to_me'],
    ['gracias', 'thanks'],
    ['לא טוב לי', 'sadness'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const [input, intent] = cases[i]!
    it(`${i + 101}. "${input}" → ${intent}`, () => {
      expect(detectIntent(input)).toBe(intent)
      const seed = getProactiveSeed(input)
      expect(seed).not.toBeNull()
      expect(seed!.text.length).toBeGreaterThan(3)
      // Must not contain robotic phrases
      expect(seed!.text).not.toContain('שלוש אפשרויות')
      expect(seed!.text).not.toContain('אני יכולה')
    })
  }
})

// ═══ LLM-REQUIRED (121-135) ═══
describe('LLM-REQUIRED — 15 scenarios', () => {
  const cases: string[] = [
    'ספרי לי בדיחה',
    'מה דעתך על פוליטיקה?',
    'תסבירי לי מה זה AI',
    'ספרי לי סיפור קצר',
    'מה עושים כשגשם?',
    'למה השמיים כחולים?',
    'מי המציא את הטלפון?',
    'מה זה יחסיות?',
    'מי היה איינשטיין?',
    'תמליצי לי על סרט',
    'מה הבדל בין שמש לירח?',
    'למה ים המלח מלוח?',
    'מה זה DNA?',
    'איך עובד מטוס?',
    'למה אנחנו חולמים?',
  ]
  for (let i = 0; i < cases.length; i++) {
    it(`${i + 121}. "${cases[i]}" → LLM`, () => {
      const answer = tryGroundedAnswer(cases[i]!)
      expect(answer).toBeNull() // correctly falls to LLM
      expect(isCreateIntent(cases[i]!)).toBe(false)
      expect(detectIntent(cases[i]!)).toBeNull()
    })
  }
})

// ═══ NO ROBOTIC PHRASES (136-150) ═══
describe('NO ROBOTIC PHRASES — 15 grounded answers checked', () => {
  const FORBIDDEN = [
    'שגיאה', 'כל השרתים', 'OPENAI', 'API', 'Vercel', 'provider',
    'timeout', 'כלי לא מוכר', 'חיבור ה-AI', 'שרת',
  ]
  const inputs = [
    'מה יש לי היום?', 'מי זה נועם?', 'מתי יום ההולדת של מור?',
    'איפה לאו גר?', 'בן כמה עדי?', 'ספרי לי על הנכדים',
    'מה יש לי מחר?', 'מה יש לי השבוע?', 'מתי הרופא?',
    'מתי יום הזיכרון של פפי?', 'מי הילדים של מור?',
    'כמה נכדים יש לי?', 'מי זה אדי?', 'איפה מור גרה?',
    'מה קורה השבוע?',
  ]
  for (const input of inputs) {
    it(`"${input}" clean`, () => {
      const answer = tryGroundedAnswer(input)
      if (answer) {
        for (const f of FORBIDDEN) {
          expect(answer, `"${input}" contains "${f}"`).not.toContain(f)
        }
      }
    })
  }
})

// ═══ GENDER CORRECTNESS (151-165) ═══
describe('GENDER — 15 scenarios', () => {
  it('151. עדי is male (grandson)', () => {
    const route = routePersonalQuery('מי זה עדי?')
    expect(route.type).toBe('family_lookup')
  })
  it('152. נועם is male (grandson)', () => {
    const a = tryGroundedAnswer('מי זה נועם?')
    expect(a).toContain('נכד')
  })
  it('153. מור is female (daughter)', () => {
    const a = tryGroundedAnswer('מי זאת מור?')
    expect(a).toContain('הבת')
  })
  it('154. איפה נועם גר (masculine)', () => {
    const a = tryGroundedAnswer('איפה נועם גר?')
    expect(a).toContain('נועם גר ב')
    expect(a).not.toContain('נועם גרה')
  })
  it('155. איפה מור גרה (feminine)', () => {
    const a = tryGroundedAnswer('איפה מור גרה?')
    expect(a).toMatch(/מור גרה/)
  })
  it('156. pronoun שלו finds male', () => {
    const h = [msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.')]
    expect(resolvePronouns('שלו', h).personName).toBe('נועם')
  })
  it('157. pronoun שלה finds female', () => {
    const h = [msg('user', 'מי זאת מור?'), msg('assistant', 'הבת.')]
    expect(resolvePronouns('שלה', h).personName).toBe('מור')
  })
  it('158. אליו finds male not female', () => {
    const h = [
      msg('user', 'מי זאת מור?'), msg('assistant', 'הבת.'),
      msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.'),
    ]
    expect(resolvePronouns('אליו', h).personName).toBe('נועם')
  })
  it('159. אליה finds female not male', () => {
    const h = [
      msg('user', 'מי זה נועם?'), msg('assistant', 'נכד.'),
      msg('user', 'מי זאת יעל?'), msg('assistant', 'בת זוג.'),
    ]
    expect(resolvePronouns('אליה', h).personName).toBe('יעל')
  })
  it('160. display name is עדי not אדי', () => {
    const a = tryGroundedAnswer('מי זה אדי?')
    expect(a).toContain('עדי')
    expect(a).not.toMatch(/^אדי/) // answer starts with עדי
  })
  it('161. feminine "תגידי" in proactive', () => {
    const seed = getProactiveSeed('תודה')
    expect(seed).not.toBeNull()
    if (seed!.text.includes('תגיד')) {
      expect(seed!.text).toContain('תגידי') // feminine
    }
  })
  it('162. location answer uses correct gender for עדי (male)', () => {
    const a = tryGroundedAnswer('איפה עדי גר?')
    expect(a).toContain('עדי גר ב')
  })
  it('163. location answer uses correct gender for יעל (female)', () => {
    const a = tryGroundedAnswer('איפה יעל גרה?')
    if (a && !a.includes('אין לי מידע')) {
      expect(a).toMatch(/יעל גרה/)
    }
  })
  it('164. family answer for מור mentions הבת', () => {
    const a = tryGroundedAnswer('מי זאת מור?')
    expect(a).toContain('הבת')
  })
  it('165. family answer for לאו mentions הבן', () => {
    const a = tryGroundedAnswer('מי זה לאו?')
    expect(a).toContain('הבן')
  })
})

// ═══ EDGE CASES (166-200) ═══
describe('EDGE CASES — 35 scenarios', () => {
  // Empty calendar
  it('166. empty calendar today', () => {
    const a = tryGroundedAnswer('מה יש לי היום?')
    expect(a).toContain('חופשי')
    expect(a).not.toContain('שגיאה')
  })
  it('167. empty calendar tomorrow', () => {
    const a = tryGroundedAnswer('מה יש לי מחר?')
    expect(a).toContain('אין כלום')
  })
  it('168. empty calendar week', () => {
    const a = tryGroundedAnswer('מה יש לי השבוע?')
    expect(a).toContain('שקט')
  })
  // Unknown person
  it('169. unknown person', () => {
    const a = tryGroundedAnswer('מי זה שמעון?')
    expect(a).toMatch(/לא מכירה|לא יודעת/)
  })
  // Create intent detection
  it('170. "יש לי תור מחר" is a calendar read, not create', () => {
    // "יש לי תור" can trigger create intent detection due to schedule clues,
    // but the router should route it as calendar read, not create.
    const route = routePersonalQuery('יש לי תור מחר?')
    // It's OK if isCreateIntent fires — the router handles it correctly
    expect(route.type).toMatch(/^calendar_/)
  })
  it('171. "תרשמי לי" IS create', () => {
    expect(isCreateIntent('תרשמי לי פגישה')).toBe(true)
  })
  it('172. "תוסיפי לי" IS create', () => {
    expect(isCreateIntent('תוסיפי לי תור')).toBe(true)
  })
  // Online detection
  it('173. "מה מזג האוויר" goes online', () => {
    const a = tryGroundedAnswer('מה מזג האוויר?')
    expect(a).toBeNull() // not grounded — goes to online
  })
  it('174. "מה בחדשות" goes online', () => {
    const a = tryGroundedAnswer('מה בחדשות?')
    expect(a).toBeNull()
  })
  // Proactive edge
  it('175. "משעמם לי" = boredom', () => {
    expect(detectIntent('משעמם לי')).toBe('boredom')
  })
  it('176. "בודדה" = loneliness', () => {
    expect(detectIntent('אני בודדה')).toBe('loneliness')
  })
  it('177. "מה אפשר לעשות היום" = ideas', () => {
    expect(detectIntent('מה אפשר לעשות היום')).toBe('ideas')
  })
  // Route specifics
  it('178. "מה יש ב-5 במאי" = calendar_exact_date', () => {
    const r = routePersonalQuery('מה יש לי ב-5 במאי?')
    expect(r.type).toBe('calendar_exact_date')
  })
  it('179. "מה יש באפריל" = calendar_month', () => {
    const r = routePersonalQuery('למי יש יום הולדת באפריל?')
    expect(r.type).toBe('calendar_month')
  })
  it('180. "תתקשרי ללאו" = contact_action', () => {
    const r = routePersonalQuery('תתקשרי ללאו')
    expect(r.type).toBe('contact_action')
  })
  // Cancel variations
  it('181. "לא לזה התכוונתי" = cancel', () => {
    expect(isCancel('לא לזה התכוונתי')).toBe(true)
  })
  it('182. "תעזבי" = cancel', () => {
    expect(isCancel('תעזבי')).toBe(true)
  })
  it('183. "חבל" = cancel', () => {
    expect(isCancel('חבל')).toBe(true)
  })
  // Confirm edge
  it('184. "תאשרי" = confirm', () => {
    expect(isConfirm('תאשרי')).toBe(true)
  })
  it('185. "ברור" = confirm', () => {
    expect(isConfirm('ברור')).toBe(true)
  })
  // Spanish emotional
  it('186. "Estoy triste" = sadness', () => {
    expect(detectIntent('Estoy triste')).toBe('sadness')
  })
  it('187. "Hablame" = talk_to_me', () => {
    expect(detectIntent('Hablame')).toBe('talk_to_me')
  })
  it('188. "extraño a Pepe" = missing_pepe', () => {
    expect(detectIntent('extraño a Pepe')).toBe('missing_pepe')
  })
  // Mixed
  it('189. Spanish family "Quién es Mor" = family', () => {
    const r = routePersonalQuery('Quién es Mor?')
    expect(r.type).toBe('family_lookup')
  })
  it('190. English family "Who is Noam" = family', () => {
    const r = routePersonalQuery('Who is Noam?')
    expect(r.type).toBe('family_lookup')
  })
  // Memorial
  it('191. "מתי האזכרה של פפי" = memorial', () => {
    const r = routePersonalQuery('מתי האזכרה של פפי?')
    expect(r.type).toBe('memorial_lookup')
  })
  // Weekday
  it('192. "מה יש לי בחמישי" = calendar_exact_date', () => {
    const r = routePersonalQuery('מה יש לי בחמישי?')
    expect(r.type).toBe('calendar_exact_date')
  })
  // Birthday month
  it('193. "למי יש יום הולדת במרץ" = calendar_month', () => {
    const r = routePersonalQuery('למי יש יום הולדת במרץ?')
    expect(r.type).toBe('calendar_month')
  })
  // Past calendar
  it('194. "מה היה לי אתמול" = calendar_exact_date', () => {
    const r = routePersonalQuery('מה היה לי אתמול?')
    expect(r.type).toBe('calendar_exact_date')
  })
  // Relationship between
  it('195. "מה הקשר בין מור ללאו" = relationship', () => {
    const r = routePersonalQuery('מה הקשר בין מור ללאו?')
    expect(r.type).toBe('family_relationship_between')
  })
  // Not-create guards
  it('196. "ספרי לי על איטליה" = non_personal (not family)', () => {
    const r = routePersonalQuery('ספרי לי על איטליה')
    expect(r.type).toBe('non_personal')
  })
  it('197. "מה זה בינה מלאכותית" = non_personal', () => {
    const r = routePersonalQuery('מה זה בינה מלאכותית')
    expect(r.type).toBe('non_personal')
  })
  // Calendar loose
  it('198. "מתי יש לי רופא" = calendar', () => {
    const r = routePersonalQuery('מתי יש לי רופא?')
    expect(r.type).toMatch(/^calendar_/)
  })
  it('199. "אני פנויה השבוע?" = calendar', () => {
    const r = routePersonalQuery('אני פנויה השבוע?')
    expect(r.type).toMatch(/^calendar_/)
  })
  it('200. "מה עשיתי אתמול" = calendar past', () => {
    const r = routePersonalQuery('מה עשיתי אתמול?')
    expect(r.type).toBe('calendar_exact_date')
  })
})
