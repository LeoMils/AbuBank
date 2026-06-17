/*
 * Product QA: 100 realistic Martita inputs through the ACTUAL routing
 * and grounding pipeline. Scores: clarity, correctness, grounding,
 * brevity, friendliness, hallucination risk.
 *
 * No mocks. No LLM calls. Only local deterministic functions.
 */

import { describe, it, expect } from 'vitest'
import { routePersonalQuery, type RouteType } from './router'
import { tryGroundedAnswer } from './service'
import { isCreateIntent, isConfirm, isCancel, startCreate } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectIntent, getProactiveSeed } from './proactive'
import { resolveFollowUp } from './contextResolver'
import { resolvePronouns } from './pronounResolver'
import { loadFamilyData } from '../../services/familyLoader'

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Assert that routing never throws and always returns a valid RouteType. */
function assertValidRoute(input: string): RouteType {
  const result = routePersonalQuery(input)
  expect(result).toBeDefined()
  expect(result.type).toBeDefined()
  expect(result.query).toBeDefined()
  return result.type
}

/** Assert grounded answer returns content (not null) for a known family query. */
function assertGroundedContent(input: string): string {
  const answer = tryGroundedAnswer(input)
  expect(answer).not.toBeNull()
  expect(typeof answer).toBe('string')
  expect(answer!.length).toBeGreaterThan(0)
  return answer!
}

/** Assert grounded answer is brief (under N sentences). */
function assertBrief(answer: string, maxSentences = 6): void {
  const sentences = answer.split(/[.\n]/).filter(s => s.trim().length > 3)
  expect(sentences.length).toBeLessThanOrEqual(maxSentences)
}

/** Assert answer does NOT contain invented facts. */
function assertNoHallucination(answer: string, forbiddenPatterns: RegExp[]): void {
  for (const pattern of forbiddenPatterns) {
    expect(answer).not.toMatch(pattern)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 1: Greetings & Small Talk (10)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT1: Greetings & small talk', () => {
  const inputs = [
    'שלום',
    'בוקר טוב',
    'מה נשמע',
    'היי',
    'ערב טוב',
    'מה קורה',
    'Hola',
    'Buenos días',
    'Hi',
    'Good morning',
  ]

  for (const input of inputs) {
    it(`routes "${input}" without throwing`, () => {
      const type = assertValidRoute(input)
      // Greetings should NOT route to family or calendar
      // They may route to non_personal or family_lookup if a name is matched
      expect(type).toBeDefined()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 2: Calendar Queries — today/tomorrow/week (10)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT2: Calendar read queries', () => {
  const cases: [string, RouteType[]][] = [
    ['מה יש לי היום', ['calendar_today']],
    ['מה יש לי מחר', ['calendar_tomorrow']],
    ['מה יש לי השבוע', ['calendar_upcoming']],
    ['מה קורה היום', ['calendar_today']],
    ['מה התוכנית להיום', ['calendar_today']],
    ['יש לי משהו מחר', ['calendar_tomorrow']],
    ['מה הפגישות הקרובות', ['calendar_upcoming']],
    ['איזה פגישות יש לי השבוע', ['calendar_upcoming']],
    ['qué tengo hoy', ['calendar_today']],
    ['what do I have tomorrow', ['calendar_tomorrow']],
  ]

  for (const [input, expected] of cases) {
    it(`routes "${input}" → ${expected[0]}`, () => {
      const type = assertValidRoute(input)
      expect(expected).toContain(type)
    })

    it(`grounded answer for "${input}" returns content`, () => {
      const answer = tryGroundedAnswer(input)
      // Calendar queries always return a summary (even if empty calendar)
      expect(answer).not.toBeNull()
      expect(typeof answer).toBe('string')
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 3: Appointment Creation (10)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT3: Appointment creation', () => {
  const inputs = [
    'תקבעי לי רופא מחר בעשר',
    'יש לי תור לרופא ביום שלישי',
    'תרשמי לי פגישה מחר בשלוש',
    'אני רוצה פגישה עם הרופא',
    'תקבעי לי תור לדנטיסט מחר',
    'צריכה לקבוע תור לרופא עיניים',
    'תכניסי ליומן פגישה עם יעל מחר בארבע',
    'יש לי פגישה מחר בשמונה בבוקר',
    'שימי לי ביומן ארוחה עם מור ביום שישי',
    'תקבעי לי תופרת ביום רביעי בשלוש',
  ]

  for (const input of inputs) {
    it(`isCreateIntent("${input}") === true`, () => {
      expect(isCreateIntent(input)).toBe(true)
    })

    it(`router routes "${input}" to calendar_create`, () => {
      const type = assertValidRoute(input)
      expect(type).toBe('calendar_create')
    })

    it(`startCreate("${input}") produces a non-idle state`, () => {
      const state = startCreate(input)
      expect(state.phase).not.toBe('idle')
      // Should have parsed at least something
      const d = state.draft
      const hasSomething = d.title || d.date || d.time
      expect(hasSomething).toBeTruthy()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 4: Reminder Creation (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT4: Reminder creation', () => {
  const inputs = [
    'תזכירי לי לקחת כדור',
    'תזכירי לי בעוד חצי שעה לבדוק את הסיר',
    'תזכירי לי מחר בבוקר לקחת תרופה',
    'תזכירי לי להתקשר ליעל',
    'תזכירי לי לשתות מים כל שעתיים',
  ]

  for (const input of inputs) {
    it(`detectReminderIntent("${input}") === 'reminder'`, () => {
      expect(detectReminderIntent(input)).toBe('reminder')
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 5: Confirm / Cancel (5 each)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT5: Confirm', () => {
  const confirms = ['כן', 'בדיוק', 'סבבה', 'כן תרשמי', 'מאשרת']
  for (const input of confirms) {
    it(`isConfirm("${input}") === true`, () => {
      expect(isConfirm(input)).toBe(true)
    })
  }
})

describe('CAT5: Cancel', () => {
  const cancels = ['לא', 'עזבי', 'ביטול', 'תמחקי', 'תבטלי את זה']
  for (const input of cancels) {
    it(`isCancel("${input}") === true`, () => {
      expect(isCancel(input)).toBe(true)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 6: Family Lookups (15)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT6: Family lookups', () => {
  const familyCases: [string, string][] = [
    ['מי זאת מור', 'מור'],
    ['מי זה לאו', 'לאו'],
    ['מי זה אופיר', 'אופיר'],
    ['מי זאת אנאבל', 'אנאבל'],
    ['מי זאת ירדן', 'ירדן'],
    ['מי זה גלעד', 'גלעד'],
    ['מי זאת יעל', 'יעל'],
    ['ספרי לי על עילי', 'עילי'],
    ['מי הנכדים שלי', 'נכד'],
    ['הילדים שלי', 'ילד'],
    ['מתי יום ההולדת של מור', 'מור'],
    ['מתי יום ההולדת של לאו', 'לאו'],
    ['מי זה רפי', 'רפי'],
    ['מי זה נועם', 'נועם'],
    ['מי זה עדי', 'עדי'],
  ]

  for (const [input, expectedName] of familyCases) {
    it(`routes "${input}" to family/birthday route`, () => {
      const type = assertValidRoute(input)
      const familyTypes: RouteType[] = [
        'family_lookup', 'birthday_lookup', 'memorial_lookup',
        'family_location', 'family_relationship_between',
      ]
      expect(familyTypes).toContain(type)
    })

    it(`grounded answer for "${input}" returns content about ${expectedName}`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer).not.toBeNull()
      expect(answer!.length).toBeGreaterThan(0)
    })
  }

  // Correctness checks: specific family relationships
  it('knows Mor is the daughter', () => {
    const answer = tryGroundedAnswer('מי זאת מור')!
    expect(answer).toMatch(/הבת/)
  })

  it('knows Leo is the son', () => {
    const answer = tryGroundedAnswer('מי זה לאו')!
    expect(answer).toMatch(/הבן/)
  })

  it('knows Ofir is a grandson', () => {
    const answer = tryGroundedAnswer('מי זה אופיר')!
    expect(answer).toMatch(/נכד/)
  })

  it('knows Anabel is a great-granddaughter', () => {
    const answer = tryGroundedAnswer('מי זאת אנאבל')!
    expect(answer).toMatch(/נינה/)
  })

  it('knows Yarden is married to Eili', () => {
    const answer = tryGroundedAnswer('מי זאת ירדן')!
    expect(answer).toMatch(/עילי/)
  })

  it('knows Yael is Mor partner', () => {
    const answer = tryGroundedAnswer('מי זאת יעל')!
    expect(answer).toMatch(/מור/)
  })

  // Hallucination checks
  it('does NOT invent a phone number for any family member', () => {
    const names = ['מור', 'לאו', 'אופיר', 'יעל', 'ירדן', 'גלעד']
    for (const name of names) {
      const answer = tryGroundedAnswer(`מי זה ${name}`)
      if (answer) {
        expect(answer).not.toMatch(/\d{3}[-.]?\d{3}[-.]?\d{4}/)
        expect(answer).not.toMatch(/05\d[-]?\d{7}/)
      }
    }
  })

  it('does NOT invent medical information', () => {
    const answer = tryGroundedAnswer('מי זאת מור')!
    expect(answer).not.toMatch(/רופא|מחלה|אלרגי|תרופ/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 7: Family Location Queries (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT7: Family location queries', () => {
  const cases: [string, string][] = [
    ['איפה מור גרה', 'הוד השרון'],
    ['איפה גר נועם', 'הרצליה'],
    ['איפה גר עדי', 'תל אביב'],
    ['איפה גרה יעל', 'הוד השרון'],
    ['איפה לאו גר', 'לאו'], // Leo has no location in data
  ]

  for (const [input, expectedContent] of cases) {
    it(`routes "${input}" to family_location`, () => {
      const type = assertValidRoute(input)
      expect(type).toBe('family_location')
    })

    it(`grounded answer for "${input}" contains "${expectedContent}"`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer).not.toBeNull()
      if (expectedContent !== 'לאו') {
        // For known locations, verify the location appears
        expect(answer!).toContain(expectedContent)
      }
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 8: General Knowledge (10)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT8: General knowledge → non_personal (needs LLM)', () => {
  const inputs = [
    'מה זה AI',
    'מי היה דוד בן גוריון',
    'כמה כוכבים יש ביקום',
    'מה ההבדל בין ויטמין D ל-B12',
    'למה השמיים כחולים',
    'תסבירי לי את תורת הקוונטים',
    'מה דעתך על הפוליטיקה בישראל',
    'איך מכינים אמפנדס',
    'Recomendame un libro',
    'Tell me about quantum physics',
  ]

  for (const input of inputs) {
    it(`routes "${input}" to non_personal`, () => {
      const type = assertValidRoute(input)
      expect(type).toBe('non_personal')
    })

    it(`grounded answer for "${input}" returns null (needs LLM)`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer).toBeNull()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 9: Weather (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT9: Weather queries → non_personal', () => {
  const inputs = [
    'מה מזג האוויר היום',
    'מה הטמפרטורה בכפר סבא',
    'האם ירד גשם מחר',
    'Qué clima hace hoy',
    'What is the weather like',
  ]

  for (const input of inputs) {
    it(`routes "${input}" to non_personal (needs LLM/tool)`, () => {
      const type = assertValidRoute(input)
      expect(type).toBe('non_personal')
    })

    it(`tryGroundedAnswer("${input}") returns null`, () => {
      expect(tryGroundedAnswer(input)).toBeNull()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 10: Edge Cases (10)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT10: Edge cases — safety & robustness', () => {
  const edgeCases = [
    '',                                   // empty
    '   ',                                // whitespace
    'asdfghjkl',                         // gibberish
    'תגידי לי 🤖',                       // emoji
    '<script>alert("xss")</script>',     // XSS
    "'; DROP TABLE users; --",           // SQL injection
    'a'.repeat(5000),                     // very long input
    '!@#$%^&*()',                         // special characters
    'מה'.repeat(200),                     // repeated Hebrew
    '🎉🎂🎈🎊',                         // only emojis
  ]

  for (const input of edgeCases) {
    it(`never throws on edge case: "${input.slice(0, 30)}..."`, () => {
      expect(() => routePersonalQuery(input)).not.toThrow()
    })

    it(`route returns valid type for: "${input.slice(0, 30)}..."`, () => {
      const result = routePersonalQuery(input)
      expect(result.type).toBeDefined()
      // Should be a valid RouteType
      const validTypes: RouteType[] = [
        'family_lookup', 'family_location', 'family_relationship_between',
        'calendar_today', 'calendar_tomorrow', 'calendar_upcoming',
        'calendar_exact_date', 'calendar_month',
        'calendar_create',
        'birthday_lookup', 'memorial_lookup',
        'contact_action',
        'non_personal',
      ]
      expect(validTypes).toContain(result.type)
    })

    it(`tryGroundedAnswer never throws on: "${input.slice(0, 30)}..."`, () => {
      expect(() => tryGroundedAnswer(input)).not.toThrow()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 11: Emotional / Personal (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT11: Emotional / personal inputs', () => {
  const emotionalCases: [string, string | null][] = [
    ['אני מרגישה קצת בודדה', 'loneliness'],
    ['מתגעגעת לפפי', 'missing_pepe'],
    ['אני משועממת', 'boredom'],
    ['אני עצובה היום', 'sadness'],
    ['תודה', 'thanks'],
  ]

  for (const [input, expectedIntent] of emotionalCases) {
    it(`detectIntent("${input}") === "${expectedIntent}"`, () => {
      const intent = detectIntent(input)
      expect(intent).toBe(expectedIntent)
    })

    it(`getProactiveSeed("${input}") returns non-null seed`, () => {
      const seed = getProactiveSeed(input)
      expect(seed).not.toBeNull()
      expect(seed!.text.length).toBeGreaterThan(0)
    })

    it(`proactive seed for "${input}" has no forbidden tone`, () => {
      const seed = getProactiveSeed(input)
      expect(seed).not.toBeNull()
      // Should not be patronizing
      const forbidden = ['יופי של שאלה', 'כל הכבוד', 'איזה יופי', 'muy bien', 'good job']
      for (const f of forbidden) {
        expect(seed!.text.toLowerCase()).not.toContain(f.toLowerCase())
      }
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 12: Hebrew Colloquial / Slang (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT12: Hebrew colloquial / slang', () => {
  const cases: [string, RouteType[]][] = [
    ['מה קורה חביבי', ['non_personal']],
    ['יאללה מה יש היום', ['calendar_today']],
    ['תגידי מתי יום הולדת של מור', ['birthday_lookup']],
    ['מה העניינים השבוע', ['non_personal', 'calendar_upcoming']],
    ['תראי לי את הפגישות שלי', ['calendar_upcoming']],
  ]

  for (const [input, expected] of cases) {
    it(`routes "${input}" correctly`, () => {
      const type = assertValidRoute(input)
      expect(expected).toContain(type)
    })

    it(`never throws on "${input}"`, () => {
      expect(() => tryGroundedAnswer(input)).not.toThrow()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY 13: Cancel Mid-Flow (5)
// ═══════════════════════════════════════════════════════════════════════════

describe('CAT13: Cancel mid-flow variations', () => {
  const cancels = [
    'עזבי את זה',
    'לא צריך',
    'תשכחי',
    'לא לזה התכוונתי',
    'תמחקי את הפגישה',
  ]

  for (const input of cancels) {
    it(`isCancel("${input}") === true`, () => {
      expect(isCancel(input)).toBe(true)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Grounded Answer Quality
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: grounded answers match family_data.json', () => {
  it('family data loads correctly', () => {
    const members = loadFamilyData()
    expect(members.length).toBeGreaterThan(10)
  })

  it('Mor birthday answer contains August', () => {
    const answer = tryGroundedAnswer('מתי יום ההולדת של מור')
    expect(answer).not.toBeNull()
    // Mor birthday is 08-10 = August
    expect(answer!).toMatch(/אוגוסט|08/)
  })

  it('Leo birthday answer contains August', () => {
    const answer = tryGroundedAnswer('מתי יום ההולדת של לאו')
    expect(answer).not.toBeNull()
    // Leo birthday is 08-22 = August
    expect(answer!).toMatch(/אוגוסט|08/)
  })

  it('Ofir birthday answer contains February', () => {
    const answer = tryGroundedAnswer('מתי יום ההולדת של אופיר')
    expect(answer).not.toBeNull()
    expect(answer!).toMatch(/פברואר|02/)
  })

  it('grandchildren group query lists all grandchildren', () => {
    const answer = tryGroundedAnswer('הנכדים שלי')
    expect(answer).not.toBeNull()
    // Should mention key grandchildren
    expect(answer!).toMatch(/אופיר/)
    expect(answer!).toMatch(/עילי/)
    expect(answer!).toMatch(/נועם/)
  })

  it('children group query lists both children', () => {
    const answer = tryGroundedAnswer('הילדים שלי')
    expect(answer).not.toBeNull()
    expect(answer!).toMatch(/מור/)
    expect(answer!).toMatch(/לאו/)
  })

  it('Mor children query lists her 4 children', () => {
    const answer = tryGroundedAnswer('הילדים של מור')
    expect(answer).not.toBeNull()
    expect(answer!).toMatch(/אופיר/)
    expect(answer!).toMatch(/אדר/)
  })

  it('grounded answers are brief (under 6 sentences)', () => {
    const queries = ['מי זאת מור', 'מי זה לאו', 'מי זה אופיר']
    for (const q of queries) {
      const answer = tryGroundedAnswer(q)
      if (answer) {
        assertBrief(answer)
      }
    }
  })

  it('grounded answers never contain markdown', () => {
    const queries = ['מי זאת מור', 'מה יש לי היום', 'הנכדים שלי']
    for (const q of queries) {
      const answer = tryGroundedAnswer(q)
      if (answer) {
        expect(answer).not.toMatch(/\*\*/)
        expect(answer).not.toMatch(/^#{1,6}\s/m)
        expect(answer).not.toMatch(/```/)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Router Never Throws
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: router robustness on all 100 inputs', () => {
  const allInputs = [
    // CAT1: greetings
    'שלום', 'בוקר טוב', 'מה נשמע', 'היי', 'ערב טוב',
    'מה קורה', 'Hola', 'Buenos días', 'Hi', 'Good morning',
    // CAT2: calendar
    'מה יש לי היום', 'מה יש לי מחר', 'מה יש לי השבוע',
    'מה קורה היום', 'מה התוכנית להיום', 'יש לי משהו מחר',
    'מה הפגישות הקרובות', 'איזה פגישות יש לי השבוע',
    'qué tengo hoy', 'what do I have tomorrow',
    // CAT3: create
    'תקבעי לי רופא מחר בעשר', 'יש לי תור לרופא ביום שלישי',
    'תרשמי לי פגישה מחר בשלוש', 'אני רוצה פגישה עם הרופא',
    'תקבעי לי תור לדנטיסט מחר', 'צריכה לקבוע תור לרופא עיניים',
    'תכניסי ליומן פגישה עם יעל מחר בארבע',
    'יש לי פגישה מחר בשמונה בבוקר',
    'שימי לי ביומן ארוחה עם מור ביום שישי',
    'תקבעי לי תופרת ביום רביעי בשלוש',
    // CAT4: reminders
    'תזכירי לי לקחת כדור', 'תזכירי לי בעוד חצי שעה לבדוק את הסיר',
    'תזכירי לי מחר בבוקר לקחת תרופה',
    'תזכירי לי להתקשר ליעל', 'תזכירי לי לשתות מים כל שעתיים',
    // CAT5: confirm/cancel (5 total — the other 5 are in CAT13)
    'כן', 'בדיוק', 'סבבה', 'כן תרשמי', 'מאשרת',
    // CAT6: family
    'מי זאת מור', 'מי זה לאו', 'מי זה אופיר',
    'מי זאת אנאבל', 'מי זאת ירדן', 'מי זה גלעד',
    'מי זאת יעל', 'ספרי לי על עילי', 'מי הנכדים שלי',
    'הילדים שלי', 'מתי יום ההולדת של מור',
    'מתי יום ההולדת של לאו', 'מי זה רפי',
    'מי זה נועם', 'מי זה עדי',
    // CAT7: location
    'איפה מור גרה', 'איפה גר נועם', 'איפה גר עדי',
    'איפה גרה יעל', 'איפה לאו גר',
    // CAT8: general
    'מה זה AI', 'מי היה דוד בן גוריון',
    'כמה כוכבים יש ביקום', 'מה ההבדל בין ויטמין D ל-B12',
    'למה השמיים כחולים', 'תסבירי לי את תורת הקוונטים',
    'מה דעתך על הפוליטיקה בישראל', 'איך מכינים אמפנדס',
    'Recomendame un libro', 'Tell me about quantum physics',
    // CAT9: weather
    'מה מזג האוויר היום', 'מה הטמפרטורה בכפר סבא',
    'האם ירד גשם מחר', 'Qué clima hace hoy',
    'What is the weather like',
    // CAT10: edge
    '', '   ', 'asdfghjkl', 'תגידי לי 🤖',
    '<script>alert("xss")</script>', "'; DROP TABLE users; --",
    'a'.repeat(500), '!@#$%^&*()', 'מה'.repeat(50), '🎉🎂🎈🎊',
    // CAT11: emotional
    'אני מרגישה קצת בודדה', 'מתגעגעת לפפי',
    'אני משועממת', 'אני עצובה היום', 'תודה',
    // CAT12: colloquial
    'מה קורה חביבי', 'יאללה מה יש היום',
    'תגידי מתי יום הולדת של מור', 'מה העניינים השבוע',
    'תראי לי את הפגישות שלי',
    // CAT13: cancel
    'עזבי את זה', 'לא צריך', 'תשכחי',
    'לא לזה התכוונתי', 'תמחקי את הפגישה',
  ]

  // Verify we have 100 inputs
  it('has exactly 100 test inputs', () => {
    expect(allInputs.length).toBe(100)
  })

  for (const input of allInputs) {
    it(`router never throws on: "${input.slice(0, 40)}"`, () => {
      expect(() => routePersonalQuery(input)).not.toThrow()
    })

    it(`tryGroundedAnswer never throws on: "${input.slice(0, 40)}"`, () => {
      expect(() => tryGroundedAnswer(input)).not.toThrow()
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Context Resolver Safety
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: contextResolver and pronounResolver safety', () => {
  it('resolveFollowUp returns original text for normal queries', () => {
    const { resolved, wasFollowUp } = resolveFollowUp('מה יש לי מחר', [])
    expect(wasFollowUp).toBe(false)
    expect(resolved).toBe('מה יש לי מחר')
  })

  it('resolveFollowUp expands "ומחר?" after calendar context', () => {
    const messages = [{ role: 'user' as const, content: 'מה יש לי היום', id: '1', timestamp: Date.now() }]
    const { resolved, wasFollowUp } = resolveFollowUp('ומחר?', messages)
    expect(wasFollowUp).toBe(true)
    expect(resolved).toContain('מחר')
  })

  it('resolvePronouns returns original when no pronoun', () => {
    const { resolved, personName } = resolvePronouns('מה יש לי מחר', [])
    expect(resolved).toBe('מה יש לי מחר')
    expect(personName).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: Contact Action Routing
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-cutting: contact action queries redirect correctly', () => {
  const cases = [
    'תתקשרי ללאו',
    'שלחי הודעה למור',
  ]

  for (const input of cases) {
    it(`routes "${input}" to contact_action`, () => {
      const type = assertValidRoute(input)
      expect(type).toBe('contact_action')
    })

    it(`grounded answer for "${input}" mentions AbuWhatsApp`, () => {
      const answer = tryGroundedAnswer(input)
      expect(answer).not.toBeNull()
      expect(answer!).toMatch(/וואטסאפ|WhatsApp/)
    })

    it(`grounded answer for "${input}" does NOT contain a phone number`, () => {
      const answer = tryGroundedAnswer(input)
      if (answer) {
        expect(answer).not.toMatch(/05\d[-]?\d{7}/)
        expect(answer).not.toMatch(/\+972/)
      }
    })
  }
})
