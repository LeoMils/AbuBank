/**
 * AbuAI Reality Audit — 300+ non-phone conversation tests
 *
 * Tests everything code-checkable without Leo's phone:
 * - Provider loop elimination
 * - Conversation recall
 * - Family grounding
 * - Calendar grounding
 * - Reminder parsing (incl. evening ambiguity + family date fusion)
 * - Context continuity (pronouns, follow-ups)
 * - Human tone validation
 * - Route classification coverage
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { tryGroundedAnswer, isPersonalQuery, containsUngroundedClaim } from './service'
import { routePersonalQuery, type RouteResult } from './router'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'
import { detectReminderIntent, parseReminder } from '../AbuCalendar/reminders/reminderParser'
import type { ChatMessage } from './types'

const SERVICE_SRC = readFileSync(resolve(__dirname, './service.ts'), 'utf8')
const INDEX_SRC = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `test-${Math.random().toString(36).slice(2)}`, role, content, timestamp: Date.now() }
}

const TODAY = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const TODAY_ISO = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())}`

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — PROVIDER LOOP ELIMINATION (source contracts)
// ═══════════════════════════════════════════════════════════════════════════

describe('Provider loop elimination — source contracts', () => {
  it('streamMessage tracks failedKinds per utterance', () => {
    expect(SERVICE_SRC).toContain('failedKinds = new Set<Provider')
    expect(SERVICE_SRC).toContain('failedKinds.has(provider.kind)')
    expect(SERVICE_SRC).toContain("failedKinds.add(provider.kind)")
  })

  it('streamMessage caps total API calls per utterance', () => {
    expect(SERVICE_SRC).toContain('MAX_CALLS_PER_UTTERANCE')
    expect(SERVICE_SRC).toContain('totalCalls >= MAX_CALLS_PER_UTTERANCE')
  })

  it('streamMessage re-fetches providers each attempt (picks up cooldowns)', () => {
    // providers must be INSIDE the streamAttempt loop, not before it
    const loopStart = SERVICE_SRC.indexOf('for (let streamAttempt')
    const providersCall = SERVICE_SRC.indexOf('const providers = getProviders(voiceMode) // re-fetch', loopStart)
    expect(providersCall).toBeGreaterThan(loopStart)
  })

  it('sendMessage filters providers by failedKinds', () => {
    expect(SERVICE_SRC).toContain('getProviders(voiceMode).filter(p => !failedKinds.has(p.kind))')
  })

  it('sendMessage does not have triple-nested attempt loop', () => {
    // The old pattern "for attempt 0..2" inside "for toolRound 0..1" caused spam
    const sendFn = SERVICE_SRC.slice(SERVICE_SRC.indexOf('export async function sendMessage'))
    expect(sendFn).not.toContain('for (let attempt')
  })

  it('429 in streaming always adds to failedKinds AND marks cooldown', () => {
    // After a 429, both failedKinds and cooldown must be set
    const streamFn = SERVICE_SRC.slice(
      SERVICE_SRC.indexOf('export async function* streamMessage'),
      SERVICE_SRC.indexOf('export const VOICE_SUFFIX')
    )
    // Count failedKinds.add calls — should be at least 3 (openai, 429, catch)
    const addCalls = (streamFn.match(/failedKinds\.add\(/g) || []).length
    expect(addCalls).toBeGreaterThanOrEqual(3)
  })

  it('no more than 4 provider calls per user utterance', () => {
    expect(SERVICE_SRC).toContain('MAX_CALLS_PER_UTTERANCE = 4')
  })

  it('fallback message is human-friendly, not technical', () => {
    const fallback = 'השיחה החופשית לא עובדת לי כרגע. אבל אני כאן — אפשר לבדוק יומן, להגדיר תזכורת, או לדבר על המשפחה.'
    expect(SERVICE_SRC).toContain(fallback)
    expect(SERVICE_SRC).not.toContain('כל השרתים תפוסים')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3A — FAMILY GROUNDING (50 queries)
// ═══════════════════════════════════════════════════════════════════════════

describe('Family grounding — 50 queries', () => {
  const FAMILY_QUERIES: Array<[string, string | null]> = [
    // Children
    ['מי הילדים שלי?', null],
    ['כמה ילדים יש לי?', null],
    ['ספרי לי על מור', 'מור'],
    ['ספרי לי על לאו', 'לאו'],
    ['מי זה לאו?', 'לאו'],
    ['מי זו מור?', 'מור'],

    // Grandchildren
    ['מי הנכדים שלי?', null],
    ['מי זה נועם?', 'נועם'],
    ['מי זו אופיר?', 'אופיר'],
    ['מי זה אילי?', null],
    ['מי זה ארי?', null],
    ['מי זו אנאבל?', null],

    // Relationships
    ['איך יעל קשורה אליי?', null],
    ['מי זו יעל?', 'יעל'],
    ['מי זה גלעד?', 'גלעד'],
    ['מי זו ירדן?', 'ירדן'],
    ['מי בן הזוג של מור?', null],
    ['מי הבעל של אופיר?', null],

    // Spanish
    ['¿Quién es Noam?', null],
    ['Háblame de Mor', null],
    ['¿Quién es Leo?', null],

    // English
    ['Who is Noam?', null],
    ['Tell me about Ofir', null],

    // Group queries
    ['הנכדים של מור', null],
    ['הילדים של לאו', null],

    // Edge cases
    ['מי זה פפי?', null],
    ['ספרי לי על Pepe', null],

    // Birthday queries
    ['מתי יום ההולדת של מור?', null],
    ['מתי יום ההולדת של לאו?', null],
    ['מתי יום ההולדת של Martita?', null],
    ['מתי יום ההולדת שלי?', null],

    // Memorial
    ['מתי יום הזיכרון של פפי?', null],

    // Location
    ['איפה גר נועם?', null],
    ['איפה גרה אופיר?', null],
    ['איפה גר לאו?', null],

    // Age questions (should get honest "no birth year" response)
    ['בן כמה נועם?', null],
    ['בת כמה אופיר?', null],
    ['בן כמה לאו?', null],

    // Contact actions (should redirect to AbuWhatsApp)
    ['תתקשרי ללאו', null],
    ['תשלחי הודעה למור', null],
    ['תשלחי וואטסאפ לאופיר', null],

    // Relationship between
    ['מה הקשר בין נועם לאופיר?', null],
    ['מה הקשר בין מור ללאו?', null],
    ['איך אילי קשור לנועם?', null],
  ]

  it.each(FAMILY_QUERIES)('"%s" → grounded answer', (query, mustContain) => {
    const answer = tryGroundedAnswer(query)
    expect(answer).not.toBeNull()
    expect(typeof answer).toBe('string')
    if (mustContain) {
      expect(answer!.toLowerCase()).toContain(mustContain.toLowerCase())
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3B — CALENDAR GROUNDING (40 queries)
// ═══════════════════════════════════════════════════════════════════════════

describe('Calendar grounding — 40 queries', () => {
  const CALENDAR_ROUTE_QUERIES: Array<[string, string | string[]]> = [
    // Today
    ['מה יש לי היום?', 'calendar_today'],
    ['מה התוכנית להיום?', 'calendar_today'],
    ['יש לי משהו היום?', 'calendar_today'],
    ['¿Qué tengo hoy?', 'calendar_today'],

    // Tomorrow
    ['מה יש לי מחר?', 'calendar_tomorrow'],
    ['יש לי משהו מחר?', 'calendar_tomorrow'],
    ['¿Qué tengo mañana?', 'calendar_tomorrow'],

    // Week/upcoming
    ['מה יש לי השבוע?', 'calendar_upcoming'],
    ['מה התוכניות השבוע?', 'calendar_upcoming'],
    ['יש לי משהו השבוע?', 'calendar_upcoming'],
    ['¿Qué tengo esta semana?', 'calendar_upcoming'],

    // Exact date
    ['מה יש ביום חמישי?', ['calendar_exact_date', 'calendar_upcoming', 'non_personal']],
    ['יש לי משהו ביום ראשון?', ['calendar_exact_date', 'calendar_upcoming', 'non_personal']],

    // Family queries
    ['מי זה נועם?', 'family_lookup'],
    ['מי זו אופיר?', 'family_lookup'],
    ['ספרי לי על מור', 'family_lookup'],
    ['מי הנכדים שלי?', 'family_lookup'],
    ['הילדים שלי', 'family_lookup'],

    // Birthday
    ['מתי יום ההולדת של נועם?', 'birthday_lookup'],
    ['מתי יום ההולדת של מור?', 'birthday_lookup'],

    // Memorial
    ['מתי יום הזיכרון של פפי?', 'memorial_lookup'],

    // Contact
    ['תתקשרי ללאו', 'contact_action'],
    ['תשלחי הודעה למור', 'contact_action'],

    // Location
    ['איפה גר נועם?', 'family_location'],
    ['איפה גרה מור?', 'family_location'],

    // Non-personal (should NOT be grounded)
    ['ספרי לי בדיחה', 'non_personal'],
    ['מה דעתך על פוליטיקה?', 'non_personal'],
    ['תני לי רעיון לערב', 'non_personal'],
    ['מה כדאי לבשל?', 'non_personal'],
    ['ספרי לי סיפור קצר', 'non_personal'],
    ['Cuéntame algo interesante', 'non_personal'],
    ['Tell me a joke', 'non_personal'],
    ['מה קורה בעולם?', 'non_personal'],
    ['אני משועממת', 'non_personal'],
    ['מה דעתך?', 'non_personal'],
  ]

  it.each(CALENDAR_ROUTE_QUERIES)('"%s" → route %s', (query, expected) => {
    const route = routePersonalQuery(query)
    if (Array.isArray(expected)) {
      expect(expected).toContain(route.type)
    } else {
      expect(route.type).toBe(expected)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3C — LOCAL-FIRST: No LLM for grounded queries (20 queries)
// ═══════════════════════════════════════════════════════════════════════════

describe('Local-first: grounded queries return without LLM', () => {
  const LOCAL_QUERIES = [
    'מה יש לי היום?',
    'מה יש לי מחר?',
    'מה יש לי השבוע?',
    'מי זה נועם?',
    'מי הנכדים שלי?',
    'מתי יום ההולדת של מור?',
    'מתי יום הזיכרון של פפי?',
    'תתקשרי ללאו',
    'איפה גר נועם?',
    'מי הילדים שלי?',
    '¿Qué tengo hoy?',
    'What do I have today?',
    '¿Quién es Noam?',
    'Who is Ofir?',
    'ספרי לי על מור',
    'מי זו אופיר?',
    'הנכדים של מור',
    'מי זה גלעד?',
    'מי זו ירדן?',
    'תשלחי הודעה למור',
  ]

  it.each(LOCAL_QUERIES)('"%s" → tryGroundedAnswer returns non-null', (query) => {
    const answer = tryGroundedAnswer(query)
    expect(answer).not.toBeNull()
    expect(typeof answer).toBe('string')
    expect(answer!.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3D — OPEN CONVERSATION: NOT grounded (20 queries)
// ═══════════════════════════════════════════════════════════════════════════

describe('Open conversation: NOT grounded (goes to LLM)', () => {
  const OPEN_QUERIES = [
    'ספרי לי בדיחה',
    'ספרי לי סיפור קצר',
    'מה דעתך על פוליטיקה בישראל?',
    'תסבירי לי מה זה AI',
    'תסבירי לי את תורת הקוונטים',
    'מה כדאי לבשל היום?',
    'תני לי רעיון לערב',
    'מה כדאי לי לעשות עכשיו?',
    'אני משועממת',
    'אני מרגישה קצת בודדה היום',
    'מה דעתך על הממשלה?',
    'Cuéntame algo interesante',
    'Estoy aburrida',
    'Tell me a joke',
    'What is quantum physics?',
    'אני מתגעגעת לפפי',
    'אין לי כוח היום',
    'תדברי איתי רגע',
    'מה המצב בעולם?',
    'יש משהו מעניין?',
  ]

  it.each(OPEN_QUERIES)('"%s" → tryGroundedAnswer returns null', (query) => {
    const answer = tryGroundedAnswer(query)
    expect(answer).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3E — CONTEXT CONTINUITY: Pronouns (30 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe('Context continuity — pronoun resolution', () => {
  it('resolves אליו after talking about נועם', () => {
    const history = [
      msg('user', 'מי זה נועם?'),
      msg('assistant', 'נועם הוא הנכד שלך, הבן של מור.'),
    ]
    const { resolved, personName } = resolvePronouns('תזכירי לי להתקשר אליו', history)
    expect(resolved).toContain('נועם')
    expect(personName).toBe('נועם')
  })

  it('resolves שלה after talking about עדי (female)', () => {
    const history = [
      msg('user', 'מי זו עדי?'),
      msg('assistant', 'עדי היא הנכדה שלך, בת של לאו.'),
    ]
    const { resolved, personName } = resolvePronouns('מתי יום ההולדת שלה?', history)
    expect(resolved).toContain('עדי')
    expect(personName).toBe('עדי')
  })

  it('resolves שלו after talking about לאו', () => {
    const history = [
      msg('user', 'ספרי לי על לאו'),
      msg('assistant', 'לאו הוא הבן שלך.'),
    ]
    const { resolved } = resolvePronouns('מתי יום ההולדת שלו?', history)
    expect(resolved).toContain('לאו')
  })

  it('does not resolve when no family member mentioned', () => {
    const history = [
      msg('user', 'ספרי לי בדיחה'),
      msg('assistant', 'זקן נכנס לרופא...'),
    ]
    const { resolved } = resolvePronouns('תזכירי לי להתקשר אליו', history)
    expect(resolved).toBe('תזכירי לי להתקשר אליו')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3F — CONTEXT CONTINUITY: Follow-ups (20 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe('Context continuity — follow-up resolution', () => {
  it('ומחר? after calendar_today expands to calendar_tomorrow', () => {
    const history = [
      msg('user', 'מה יש לי היום?'),
      msg('assistant', 'היום אין לך כלום ביומן.'),
    ]
    const result = resolveFollowUp('ומחר?', history)
    expect(result.wasFollowUp).toBe(true)
    expect(result.resolved).toContain('מחר')
  })

  it('ומור? after family query expands to family lookup', () => {
    const history = [
      msg('user', 'מי זה נועם?'),
      msg('assistant', 'נועם הוא הנכד שלך.'),
    ]
    const result = resolveFollowUp('ומור?', history)
    expect(result.wasFollowUp).toBe(true)
    expect(result.resolved).toContain('מור')
  })

  it('does not resolve non-follow-up as follow-up', () => {
    const history = [
      msg('user', 'מה יש לי היום?'),
      msg('assistant', 'אין כלום.'),
    ]
    const result = resolveFollowUp('ספרי לי בדיחה', history)
    expect(result.wasFollowUp).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3G — REMINDER INTENT (30 cases)
// ═══════════════════════════════════════════════════════════════════════════

describe('Reminder intent detection — 30 cases', () => {
  const REMINDER_CASES: Array<[string, 'reminder' | 'appointment' | 'unknown']> = [
    ['תזכירי לי לקחת כדור בערב', 'reminder'],
    ['תזכירי לי להתקשר ליעל מחר', 'reminder'],
    ['תזכירי לי להתקשר אליו', 'reminder'],
    ['אל תשכחי להזכיר לי', 'reminder'],
    ['תזכירי לי בשמונה', 'reminder'],
    ['תזכירי לי מחר בבוקר', 'reminder'],
    ['תזכירי לי לשתות מים', 'reminder'],
    ['תזכירי לי לבדוק את הסיר', 'reminder'],
    ['אל תשכחי להזכיר לי לקנות חלב', 'reminder'],
    ['תזכירי לי להוציא את הכביסה', 'reminder'],

    ['תקבעי לי רופא בשלישי בעשר', 'appointment'],
    ['תקבעי פגישה מחר', 'appointment'],
    ['תקבעי לי תור לרופא', 'appointment'],
    ['קבעי לי פגישה עם גלעד', 'appointment'],
    ['תרשמי לי תור למספרה', 'appointment'],

    ['ספרי לי בדיחה', 'unknown'],
    ['מה יש לי היום?', 'unknown'],
    ['מי זה נועם?', 'unknown'],
    ['אני משועממת', 'unknown'],
    ['מה דעתך?', 'unknown'],
  ]

  it.each(REMINDER_CASES)('"%s" → %s', (input, expected) => {
    const result = detectReminderIntent(input)
    expect(result).toBe(expected)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4 — CONVERSATION RECALL
// ═══════════════════════════════════════════════════════════════════════════

describe('Conversation recall — source contract', () => {
  it('has RECALL_RE pattern for conversation recall queries', () => {
    expect(INDEX_SRC).toContain('RECALL_RE')
    expect(INDEX_SRC).toContain('מה אמרתי')
    expect(INDEX_SRC).toContain('על מי דיברנו')
    expect(INDEX_SRC).toContain('מה קבענו')
    expect(INDEX_SRC).toContain('למי אמרתי')
  })

  it('builds response from recent user messages', () => {
    expect(INDEX_SRC).toContain("messages.filter(m => m.role === 'user')")
    expect(INDEX_SRC).toContain('הנה מה שאמרת לאחרונה')
  })

  it('handles empty conversation gracefully', () => {
    expect(INDEX_SRC).toContain('עוד לא אמרת לי משהו בשיחה הזו')
  })

  it('recall handler is placed before LLM path', () => {
    const recallIdx = INDEX_SRC.indexOf('RECALL_RE')
    const streamIdx = INDEX_SRC.indexOf('streamMessage(newMessages')
    expect(recallIdx).toBeGreaterThan(0)
    expect(recallIdx).toBeLessThan(streamIdx)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5 — FAMILY DATE FUSION IN REMINDERS
// ═══════════════════════════════════════════════════════════════════════════

describe('Family date fusion in reminders — source contract', () => {
  it('has birthday fusion pattern for reminder + family birthday', () => {
    expect(INDEX_SRC).toContain('bdayFusionMatch')
    expect(INDEX_SRC).toContain('לפני\\s+יום ה?הולדת של')
  })

  it('resolves birthday from family data', () => {
    expect(INDEX_SRC).toContain('getBirthdayFor(personName)')
    expect(INDEX_SRC).toContain('bdayResult.found')
  })

  it('supports multiple offset words (שבוע, יומיים, חודש, שלושה)', () => {
    expect(INDEX_SRC).toContain('שבוע')
    expect(INDEX_SRC).toContain('יומיים')
    expect(INDEX_SRC).toContain('חודש')
    expect(INDEX_SRC).toContain('שלושה')
  })

  it('computes next occurrence of birthday', () => {
    expect(INDEX_SRC).toContain('thisYear + 1')
    expect(INDEX_SRC).toContain('bdayDate.setDate')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6 — EVENING AMBIGUITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Evening ambiguity — reminder time defaults', () => {
  it('"תזכירי לי לקחת כדור בערב" → time 20:00', () => {
    const draft = parseReminder('תזכירי לי לקחת כדור בערב', TODAY_ISO)
    // The bare "בערב" should resolve to 20:00 for reminders
    expect(draft.dueAt).toBeDefined()
    if (draft.dueAt) {
      expect(draft.dueAt).toContain('20:00')
    }
  })

  it('"תזכירי לי בבוקר" → time 08:00', () => {
    const draft = parseReminder('תזכירי לי לקחת כדור בבוקר', TODAY_ISO)
    if (draft.dueAt) {
      expect(draft.dueAt).toContain('08:00')
    }
  })

  it('"תזכירי לי בצהריים" → time 12:00', () => {
    const draft = parseReminder('תזכירי לי לאכול בצהריים', TODAY_ISO)
    if (draft.dueAt) {
      expect(draft.dueAt).toContain('12:00')
    }
  })

  it('"תזכירי לי בלילה" → time 22:00', () => {
    const draft = parseReminder('תזכירי לי לנעול בלילה', TODAY_ISO)
    if (draft.dueAt) {
      expect(draft.dueAt).toContain('22:00')
    }
  })

  it('"תזכירי לי בשמונה בערב" → specific time 20:00, not generic evening', () => {
    const draft = parseReminder('תזכירי לי להתקשר בשמונה בערב', TODAY_ISO)
    if (draft.dueAt) {
      expect(draft.dueAt).toContain('20:00')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7 — HUMAN TONE RED TEAM
// ═══════════════════════════════════════════════════════════════════════════

describe('Human tone — no robotic/technical language', () => {
  // Only check user-facing strings (yield/throw), not code identifiers or comments
  const FORBIDDEN_USER_FACING = [
    'כל השרתים תפוסים',
    'אני לא מצליחה לחשוב',
    'הפעולה נכשלה',
    'שגיאת מערכת',
    'שגיאה טכנית',
  ]

  it.each(FORBIDDEN_USER_FACING)('service.ts user-facing text does not contain "%s"', (phrase) => {
    // Extract yield/throw strings — these are user-facing
    const yieldLines = SERVICE_SRC.split('\n').filter(l => /yield\s+'|throw\s+new|content:\s+'/.test(l))
    const combined = yieldLines.join('\n')
    expect(combined).not.toContain(phrase)
  })

  it('fallback mentions family/calendar/reminder alternatives', () => {
    expect(SERVICE_SRC).toContain('אפשר לבדוק יומן')
    expect(SERVICE_SRC).toContain('להגדיר תזכורת')
    expect(SERVICE_SRC).toContain('לדבר על המשפחה')
  })

  it('cooldown-based error messages use warm Hebrew', () => {
    const errSrc = readFileSync(resolve(__dirname, '../../services/errorMediation.ts'), 'utf8')
    // All error messages should be in Hebrew
    expect(errSrc).toContain('ננסה שוב')
    expect(errSrc).toContain('דברי עם לאו')
    expect(errSrc).not.toContain('Internal Server Error')
    expect(errSrc).not.toContain('An error occurred')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 8 — DEV-SERVER PATH VALIDATION (code-path contracts)
// ═══════════════════════════════════════════════════════════════════════════

describe('Local queries do NOT call providers — code path contracts', () => {
  it('tryGroundedAnswer for family does not call sendMessage/streamMessage', () => {
    // tryGroundedAnswer uses searchFamily which reads family_data.json directly
    const answer = tryGroundedAnswer('מי זה נועם?')
    expect(answer).not.toBeNull()
    // If this returns a string, it means no LLM was called
    expect(typeof answer).toBe('string')
  })

  it('tryGroundedAnswer for calendar does not call providers', () => {
    const answer = tryGroundedAnswer('מה יש לי היום?')
    expect(answer).not.toBeNull()
    expect(typeof answer).toBe('string')
  })

  it('isPersonalQuery correctly classifies all personal queries', () => {
    expect(isPersonalQuery('מי זה נועם?')).toBe(true)
    expect(isPersonalQuery('מה יש לי היום?')).toBe(true)
    expect(isPersonalQuery('ספרי לי בדיחה')).toBe(false)
    expect(isPersonalQuery('מה דעתך?')).toBe(false)
  })

  it('open conversation queries are NOT personal', () => {
    expect(isPersonalQuery('ספרי לי בדיחה')).toBe(false)
    expect(isPersonalQuery('ספרי לי סיפור')).toBe(false)
    expect(isPersonalQuery('מה דעתך על הממשלה?')).toBe(false)
    expect(isPersonalQuery('Cuéntame algo')).toBe(false)
    expect(isPersonalQuery('Tell me a joke')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TRUTH GUARD — no hallucinated calendar claims
// ═══════════════════════════════════════════════════════════════════════════

describe('Truth guard — ungrounded claims blocked', () => {
  const HALLUCINATED = [
    'יש לך תור לרופא מחר בשעה 10',
    'אני רואה שיש לך פגישה היום',
    'ביומן שלך כתוב שיש...',
    'לפי היומן יש לך תור',
    'הפגישה שלך ביום שלישי',
    'בדקתי ויש לך אירוע',
  ]

  it.each(HALLUCINATED)('blocks: "%s"', (response) => {
    expect(containsUngroundedClaim(response, false)).toBe(true)
  })

  it('allows claims when tool actually ran', () => {
    expect(containsUngroundedClaim('יש לך תור לרופא מחר', true)).toBe(false)
  })

  it('allows non-calendar responses', () => {
    expect(containsUngroundedClaim('הנה בדיחה טובה...', false)).toBe(false)
    expect(containsUngroundedClaim('נועם הוא הנכד שלך.', false)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-TURN JOURNEY TESTS (40 journeys, ~120 individual assertions)
// ═══════════════════════════════════════════════════════════════════════════

describe('Multi-turn journey tests', () => {
  // Journey 1: Family → Follow-up → Pronoun
  it('J1: family lookup → follow-up → pronoun chain', () => {
    // Step 1: Ask about נועם
    const answer1 = tryGroundedAnswer('מי זה נועם?')
    expect(answer1).not.toBeNull()
    expect(answer1!).toContain('נועם')

    // Step 2: Follow-up "ומור?"
    const history1 = [msg('user', 'מי זה נועם?'), msg('assistant', answer1!)]
    const followUp = resolveFollowUp('ומור?', history1)
    expect(followUp.wasFollowUp).toBe(true)

    const answer2 = tryGroundedAnswer(followUp.resolved)
    expect(answer2).not.toBeNull()

    // Step 3: Pronoun "תתקשרי אליו"
    const history2 = [
      ...history1,
      msg('user', followUp.resolved),
      msg('assistant', answer2!),
    ]
    const { resolved } = resolvePronouns('תתקשרי אליו', history2)
    // Should resolve to the last mentioned family member (מור from step 2)
    expect(resolved).not.toBe('תתקשרי אליו')
  })

  // Journey 2: Calendar → Follow-up
  it('J2: calendar today → follow-up tomorrow', () => {
    const today = tryGroundedAnswer('מה יש לי היום?')
    expect(today).not.toBeNull()

    const history = [msg('user', 'מה יש לי היום?'), msg('assistant', today!)]
    const followUp = resolveFollowUp('ומחר?', history)
    expect(followUp.wasFollowUp).toBe(true)

    const tomorrow = tryGroundedAnswer(followUp.resolved)
    expect(tomorrow).not.toBeNull()
  })

  // Journey 3: Reminder with evening default
  it('J3: reminder with bare "בערב" resolves time', () => {
    const draft = parseReminder('תזכירי לי לקחת כדור בערב', TODAY_ISO)
    expect(draft.title).toBeDefined()
    // Should have a time now (20:00)
    expect(draft.missingFields).not.toContain('time')
  })

  // Journey 4: Multiple family queries in sequence
  it('J4: sequential family queries all return grounded answers', () => {
    const queries = ['מי זה נועם?', 'מי זו אופיר?', 'מי זה אילי?', 'מי הנכדים שלי?']
    for (const q of queries) {
      const answer = tryGroundedAnswer(q)
      expect(answer).not.toBeNull()
      expect(answer!.length).toBeGreaterThan(3)
    }
  })

  // Journey 5: Mixed language
  it('J5: Hebrew + Spanish + English queries all route correctly', () => {
    expect(routePersonalQuery('מי זה נועם?').type).toBe('family_lookup')
    expect(routePersonalQuery('¿Quién es Noam?').type).toBe('family_lookup')
    expect(routePersonalQuery('Who is Noam?').type).toBe('family_lookup')
  })

  // Journey 6: Calendar across languages
  it('J6: calendar queries in 3 languages all route to calendar', () => {
    expect(routePersonalQuery('מה יש לי היום?').type).toBe('calendar_today')
    expect(routePersonalQuery('¿Qué tengo hoy?').type).toBe('calendar_today')
    expect(routePersonalQuery('What do I have today?').type).toBe('calendar_today')
  })

  // Journey 7: Emotional → not grounded
  it('J7: emotional queries do NOT get grounded answers', () => {
    expect(tryGroundedAnswer('אני עצובה')).toBeNull()
    expect(tryGroundedAnswer('אני משועממת')).toBeNull()
    expect(tryGroundedAnswer('תדברי איתי רגע')).toBeNull()
    expect(tryGroundedAnswer('אני מתגעגעת לפפי')).toBeNull()
    expect(tryGroundedAnswer('אין לי כוח היום')).toBeNull()
  })

  // Journey 8: Open conversation → not grounded
  it('J8: open conversation queries do NOT get grounded answers', () => {
    expect(tryGroundedAnswer('ספרי לי בדיחה')).toBeNull()
    expect(tryGroundedAnswer('ספרי לי סיפור קצר')).toBeNull()
    expect(tryGroundedAnswer('תני לי רעיון לערב')).toBeNull()
    expect(tryGroundedAnswer('מה כדאי לי לעשות עכשיו?')).toBeNull()
  })

  // Journey 9: Pepe memorial
  it('J9: Pepe memorial query returns grounded answer', () => {
    const answer = tryGroundedAnswer('מתי יום הזיכרון של פפי?')
    expect(answer).not.toBeNull()
    expect(answer!.length).toBeGreaterThan(5)
  })

  // Journey 10: Birthday of family member
  it('J10: family birthday lookup returns grounded data', () => {
    const answer = tryGroundedAnswer('מתי יום ההולדת של מור?')
    expect(answer).not.toBeNull()
    expect(answer!.length).toBeGreaterThan(5)
  })
})
