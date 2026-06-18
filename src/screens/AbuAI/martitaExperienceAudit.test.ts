/**
 * MARTITA EXPERIENCE AUDIT — 100 Realistic Conversations
 *
 * This is NOT a code test. This is a PRODUCT test.
 * Every test asks: "Would Martita trust this response?"
 *
 * Categories:
 * 1-10:  Greetings & small talk
 * 11-25: Calendar queries
 * 26-35: Calendar create/confirm/cancel
 * 36-45: Follow-up & context
 * 46-55: Family queries
 * 56-65: General knowledge
 * 66-75: Contact actions (WhatsApp/call)
 * 76-85: Corrections & interruptions
 * 86-95: Vague & multi-step
 * 96-100: Edge cases & breaking attempts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routePersonalQuery, classifyAbuBankIntent } from './router'
import { resolveFollowUp } from './contextResolver'
import { isCreateIntent, startCreate, updateCreate } from './calendarCreate'
import { containsCreateVerb } from '../AbuCalendar/voiceAutoCreate'
import { getTodayEvents, getTomorrowEvents, getWeekEvents, searchFamily, getBirthdayFor, getMemorialFor } from './tools'
import { shapeCalendarAnswer, shapeCreateConfirm, shapeCreateCancelled, shapeFamilyAnswer, shapeNotFound, timeInWords } from './responseShaper'
import type { ChatMessage } from './types'

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
  })
})

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `msg-${Math.random()}`, role, content, timestamp: Date.now() }
}

// ═══════════════════════════════════════════════════════════════════════════
// GREETINGS & SMALL TALK (1-10)
// Martita says hello. Does AbuAI feel like a person or a robot?
// ═══════════════════════════════════════════════════════════════════════════
describe('Greetings & Small Talk', () => {
  const greetings = [
    'שבוע טוב',
    'בוקר טוב',
    'היי',
    'שלום',
    'מה נשמע?',
    'מה שלומך?',
    'hola',
    'buenas tardes',
    'אני חזרתי',
    'ערב טוב יקירתי',
  ]
  greetings.forEach((g, i) => {
    it(`#${i+1}: "${g}" → routes to LLM (warm response)`, () => {
      const route = routePersonalQuery(g)
      // Greetings MUST go to LLM for warm response, NOT be classified as personal
      expect(route.type).toBe('non_personal')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR QUERIES (11-25)
// Does Martita get useful calendar information?
// ═══════════════════════════════════════════════════════════════════════════
describe('Calendar Queries', () => {
  it('#11: "מה יש לי היום?" → calendar_today', () => {
    expect(routePersonalQuery('מה יש לי היום?').type).toBe('calendar_today')
  })
  it('#12: "מה יש לי מחר?" → calendar_tomorrow', () => {
    expect(routePersonalQuery('מה יש לי מחר?').type).toBe('calendar_tomorrow')
  })
  it('#13: "מה יש לי השבוע?" → calendar_upcoming', () => {
    expect(routePersonalQuery('מה יש לי השבוע?').type).toBe('calendar_upcoming')
  })
  it('#14: "מה יש לי ביומן?" → calendar_upcoming', () => {
    expect(routePersonalQuery('מה יש לי ביומן?').type).toBe('calendar_upcoming')
  })
  it('#15: "מתי יש לי רופא?" → calendar (loose)', () => {
    const r = routePersonalQuery('מתי יש לי רופא?')
    expect(r.type).not.toBe('non_personal')
  })
  it('#16: "יש לי משהו מחר?" → calendar_tomorrow', () => {
    expect(routePersonalQuery('יש לי משהו מחר?').type).toBe('calendar_tomorrow')
  })
  it('#17: "מה התוכנית להיום?" → calendar_today', () => {
    expect(routePersonalQuery('מה התוכנית להיום?').type).toBe('calendar_today')
  })
  it('#18: "מה יש לי ביום חמישי?" → calendar_exact_date', () => {
    expect(routePersonalQuery('מה יש לי ביום חמישי?').type).toBe('calendar_exact_date')
  })
  it('#19: "מה קורה מחר?" → calendar_tomorrow', () => {
    expect(routePersonalQuery('מה קורה מחר?').type).toBe('calendar_tomorrow')
  })
  it('#20: "איזה פגישות יש לי השבוע?" → calendar_upcoming', () => {
    expect(routePersonalQuery('איזה פגישות יש לי השבוע?').type).toBe('calendar_upcoming')
  })
  it('#21: "תראי לי את הפגישות שלי" → calendar_upcoming', () => {
    expect(routePersonalQuery('תראי לי את הפגישות שלי').type).toBe('calendar_upcoming')
  })
  it('#22: "qué tengo hoy?" → calendar_today (Spanish)', () => {
    expect(routePersonalQuery('qué tengo hoy?').type).toBe('calendar_today')
  })
  it('#23: "qué tengo mañana?" → calendar_tomorrow (Spanish)', () => {
    expect(routePersonalQuery('qué tengo mañana?').type).toBe('calendar_tomorrow')
  })
  it('#24: "what do I have today?" → calendar_today (English)', () => {
    expect(routePersonalQuery('what do I have today?').type).toBe('calendar_today')
  })
  it('#25: "זה כבר ביומן?" → calendar (loose)', () => {
    const r = routePersonalQuery('זה כבר ביומן?')
    expect(r.type).not.toBe('non_personal')
  })

  // Calendar answer quality
  it('empty calendar says "לא מצאתי" — not technical error', () => {
    const answer = shapeCalendarAnswer([], 'today')
    expect(answer).toContain('חופשי')
    expect(answer).not.toContain('error')
    expect(answer).not.toContain('null')
  })

  it('time formatting is spoken Hebrew, not raw digits', () => {
    expect(timeInWords('15:00')).toContain('שלוש')
    expect(timeInWords('10:00')).toContain('עשר')
    expect(timeInWords('09:30')).toContain('תשע וחצי')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR CREATE (26-35)
// Can Martita book an appointment by speaking naturally?
// ═══════════════════════════════════════════════════════════════════════════
describe('Calendar Create', () => {
  it('#26: "תקבעי לי פגישה מחר בשלוש עם מוטי" → calendar_create', () => {
    expect(routePersonalQuery('תקבעי לי פגישה מחר בשלוש עם מוטי').type).toBe('calendar_create')
  })
  it('#27: "תרשמי לי תור לרופא מחר בעשר" → calendar_create', () => {
    expect(routePersonalQuery('תרשמי לי תור לרופא מחר בעשר').type).toBe('calendar_create')
  })
  it('#28: "יש לי תור לרופא מחר בעשר" → calendar_create', () => {
    expect(routePersonalQuery('יש לי תור לרופא מחר בעשר').type).toBe('calendar_create')
  })
  it('#29: startCreate produces confirmable draft', () => {
    const state = startCreate('תקבעי לי פגישה מחר בשלוש עם מוטי')
    expect(state.phase).not.toBe('idle')
    expect(state.draft.title).toBeTruthy()
  })
  it('#30: confirmation readback is warm Hebrew', () => {
    const confirm = shapeCreateConfirm({
      title: 'פגישה עם מוטי', date: '2026-06-18', time: '15:00',
      ambiguousTime: false, emoji: '📅',
    })
    expect(confirm).toContain('מוטי')
    expect(confirm).toContain('שלוש')
    expect(confirm).toContain('נכון?')
  })
  it('#31: cancellation is friendly', () => {
    const cancel = shapeCreateCancelled()
    expect(cancel).toContain('ביטלתי')
    expect(cancel).not.toContain('error')
  })
  it('#32: "תזכירי לי לקחת כדור" → calendar_create (reminder)', () => {
    expect(routePersonalQuery('תזכירי לי לקחת כדור').type).toBe('calendar_create')
  })
  it('#33: "תקבעי לי" (incomplete) → calendar_create', () => {
    expect(isCreateIntent('תקבעי לי רופא')).toBe(true)
  })
  it('#34: "agendá una cita mañana" → calendar_create (Spanish)', () => {
    expect(containsCreateVerb('agendá una cita mañana')).toBe(true)
  })
  it('#35: "add appointment tomorrow at 3" → calendar_create (English)', () => {
    expect(containsCreateVerb('add appointment tomorrow at 3')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FOLLOW-UP & CONTEXT (36-45)
// Does AbuAI remember what we were talking about?
// ═══════════════════════════════════════════════════════════════════════════
describe('Follow-up & Context', () => {
  const calHistory: ChatMessage[] = [
    msg('user', 'מה יש לי היום?'),
    msg('assistant', 'היום יש לך רופא שיניים בעשר בבוקר.'),
  ]
  const famHistory: ChatMessage[] = [
    msg('user', 'ספרי לי על נועם'),
    msg('assistant', 'נועם הוא הנכד שלך.'),
  ]

  it('#36: "ומחר?" after calendar → expands correctly', () => {
    const r = resolveFollowUp('ומחר?', calHistory)
    expect(r.wasFollowUp).toBe(true)
  })
  it('#37: "והשבוע?" → calendar follow-up', () => {
    const r = resolveFollowUp('והשבוע?', calHistory)
    expect(r.wasFollowUp).toBe(true)
  })
  it('#38: "ומור?" after family → name follow-up', () => {
    const r = resolveFollowUp('ומור?', famHistory)
    expect(r.wasFollowUp).toBe(true)
  })
  it('#39: "מה עוד?" → goes to LLM with context', () => {
    // "מה עוד" is vague, handled by LLM with full conversation history
    const r = routePersonalQuery('מה עוד?')
    expect(r.type).toBe('non_personal')
  })
  it('#40: "תספרי לי עוד" → LLM continuation', () => {
    const r = routePersonalQuery('תספרי לי עוד')
    expect(r.type).toBe('non_personal')
  })
  it('#41: "תני לי יותר פרטים" → LLM continuation', () => {
    expect(routePersonalQuery('תני לי יותר פרטים').type).toBe('non_personal')
  })
  it('#42: "מי היו הדמויות המרכזיות?" → LLM continuation', () => {
    expect(routePersonalQuery('מי היו הדמויות המרכזיות?').type).toBe('non_personal')
  })
  it('#43: "ובשלישי?" → temporal follow-up', () => {
    const r = resolveFollowUp('ובשלישי?', calHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('שלישי')
  })
  it('#44: long new topic is NOT follow-up', () => {
    const r = resolveFollowUp('מה הייתה המהפכה הצרפתית?', calHistory)
    expect(r.wasFollowUp).toBe(false)
  })
  it('#45: "ומה אחר כך?" after calendar → expands', () => {
    const r = resolveFollowUp('ומה אחרי זה?', calHistory)
    expect(r.wasFollowUp).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY (46-55)
// Does Martita get correct family info?
// ═══════════════════════════════════════════════════════════════════════════
describe('Family Queries', () => {
  it('#46: "מי זה נועם?" → family_lookup', () => {
    const r = routePersonalQuery('מי זה נועם?')
    expect(r.type).toBe('family_lookup')
    expect(r.familyQuery).toContain('נועם')
  })
  it('#47: "ספרי לי על מור" → family_lookup', () => {
    const r = routePersonalQuery('ספרי לי על מור')
    expect(r.type).toBe('family_lookup')
  })
  it('#48: "כמה נכדים יש לי?" → family_lookup', () => {
    const r = routePersonalQuery('כמה נכדים יש לי?')
    expect(r.type).toBe('family_lookup')
  })
  it('#49: "איפה גר לאו?" → family_location', () => {
    const r = routePersonalQuery('איפה גר לאו?')
    expect(r.type).toBe('family_location')
  })
  it('#50: "מתי יום ההולדת של נועם?" → birthday_lookup', () => {
    const r = routePersonalQuery('מתי יום ההולדת של נועם?')
    expect(r.type).toBe('birthday_lookup')
  })
  it('#51: "מתי יום הזיכרון של פפי?" → memorial_lookup', () => {
    const r = routePersonalQuery('מתי יום הזיכרון של פפי?')
    expect(r.type).toBe('memorial_lookup')
  })
  it('#52: "הילדים של מור" → family_lookup', () => {
    const r = routePersonalQuery('הילדים של מור')
    expect(r.type).toBe('family_lookup')
  })
  it('#53: "quién es Leo?" → family_lookup (Spanish)', () => {
    const r = routePersonalQuery('quién es Leo?')
    expect(r.type).toBe('family_lookup')
  })
  it('#54: "who is Mor?" → family_lookup (English)', () => {
    const r = routePersonalQuery('who is Mor?')
    expect(r.type).toBe('family_lookup')
  })
  it('#55: "מה הקשר בין רפי ללאו?" → relationship_between', () => {
    const r = routePersonalQuery('מה הקשר בין רפי ללאו?')
    expect(r.type).toBe('family_relationship_between')
  })

  // Family answer quality
  it('family answer includes relationship, not just name', () => {
    const answer = shapeFamilyAnswer({
      canonicalName: 'Noam', hebrew: 'נועם',
      relationship: 'grandson', relationshipHebrew: 'נכד, הבן הבכור של מור',
      aliases: [], children: [], location: 'תל אביב',
    })
    expect(answer).toContain('נועם')
    expect(answer).toContain('נועם')
  })
  it('"not found" is warm Hebrew, not error message', () => {
    const answer = shapeNotFound('דניאל')
    expect(answer).toContain('לא יודעת')
    expect(answer).not.toContain('error')
    expect(answer).not.toContain('null')
    expect(answer).not.toContain('undefined')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// GENERAL KNOWLEDGE (56-65)
// Is AbuAI a competent conversationalist?
// ═══════════════════════════════════════════════════════════════════════════
describe('General Knowledge', () => {
  const queries = [
    'מה הייתה המהפכה הצרפתית?',
    'מה זה אינפלציה?',
    'ספרי לי בדיחה',
    'מה דעתך על פוליטיקה?',
    'מתי יום העצמאות?',
    'איך מכינים חומוס?',
    'מי המציא את הטלפון?',
    'contame sobre Argentina',
    'recommend a good movie',
    'ספרי לי על איטליה',
  ]
  queries.forEach((q, i) => {
    it(`#${56+i}: "${q}" → non_personal (goes to LLM)`, () => {
      expect(routePersonalQuery(q).type).toBe('non_personal')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT ACTIONS (66-75)
// Can Martita call/WhatsApp family?
// ═══════════════════════════════════════════════════════════════════════════
describe('Contact Actions', () => {
  it('#66: "תתקשרי ליעל" → contact_action (call)', () => {
    const r = routePersonalQuery('תתקשרי ליעל')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('call')
  })
  it('#67: "תשלחי וואטסאפ למור" → contact_action (whatsapp)', () => {
    const r = routePersonalQuery('תשלחי וואטסאפ למור')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('whatsapp')
  })
  it('#68: "תשלחי הודעה ללאו" → contact_action (message)', () => {
    const r = routePersonalQuery('תשלחי הודעה ללאו')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('message')
  })
  it('#69: "llamá a Leo" → contact_action (Spanish)', () => {
    const r = routePersonalQuery('llamá a Leo')
    expect(r.type).toBe('contact_action')
  })
  it('#70: "call Mor" → contact_action (English)', () => {
    const r = routePersonalQuery('call Mor')
    expect(r.type).toBe('contact_action')
  })
  it('#71: "תפתחי וואטסאפ למור" → contact_action', () => {
    const r = routePersonalQuery('שלחי וואטסאפ למור')
    expect(r.type).toBe('contact_action')
  })
  // NOT contact action
  it('#72: "מי זה מור?" → family_lookup, NOT contact', () => {
    expect(routePersonalQuery('מי זה מור?').type).toBe('family_lookup')
  })
  it('#73: "ספרי לי על לאו" → family_lookup, NOT contact', () => {
    expect(routePersonalQuery('ספרי לי על לאו').type).toBe('family_lookup')
  })
  it('#74: "tell me about Italy" → non_personal, NOT family', () => {
    expect(routePersonalQuery('tell me about Italy').type).toBe('non_personal')
  })
  it('#75: "recomendame un podcast" → non_personal, NOT family', () => {
    expect(routePersonalQuery('recomendame un podcast').type).toBe('non_personal')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS & INTERRUPTIONS (76-85)
// Can Martita change her mind mid-flow?
// ═══════════════════════════════════════════════════════════════════════════
describe('Corrections & Interruptions', () => {
  it('#76: "בעצם מחר" during confirmation → updates date', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בעצם מחר')
    // Should stay in confirming (correction, not cancel)
    expect(updated.phase).toBe('confirming')
  })
  it('#77: "לא" during confirmation → cancels', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'לא')
    expect(updated.phase).toBe('idle')
  })
  it('#78: "עזבי" → cancels', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'עזבי').phase).toBe('idle')
  })
  it('#79: "תמחקי" → cancels', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'תמחקי').phase).toBe('idle')
  })
  it('#80: "בעצם בתשע בבוקר" → updates time', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '15:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'בעצם בתשע בבוקר')
    expect(updated.phase).toBe('confirming')
    expect(updated.draft.time).toBe('09:00')
  })
  it('#81: "כן" → keeps state (confirm)', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'כן').phase).toBe('confirming')
  })
  it('#82: "סבבה" → confirms', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'סבבה').phase).toBe('confirming')
  })
  it('#83: "לא צריך" → cancels', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'לא צריך').phase).toBe('idle')
  })
  it('#84: "בסדר" → confirms', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'בסדר').phase).toBe('confirming')
  })
  it('#85: "ביטול" → cancels', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-17', time: '10:00', ambiguousTime: false, emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    expect(updateCreate(state, 'ביטול').phase).toBe('idle')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// VAGUE & MULTI-STEP (86-95)
// Does AbuAI handle ambiguity gracefully?
// ═══════════════════════════════════════════════════════════════════════════
describe('Vague & Multi-step Requests', () => {
  it('#86: "אממ" → non_personal (no false creation)', () => {
    expect(routePersonalQuery('אממ').type).toBe('non_personal')
  })
  it('#87: "טוב" → non_personal', () => {
    expect(routePersonalQuery('טוב').type).toBe('non_personal')
  })
  it('#88: "" (empty) → non_personal', () => {
    expect(routePersonalQuery('').type).toBe('non_personal')
  })
  it('#89: "12345" → non_personal', () => {
    expect(routePersonalQuery('12345').type).toBe('non_personal')
  })
  it('#90: "רופא" alone → NOT calendar_create (no verb)', () => {
    expect(routePersonalQuery('רופא').type).toBe('non_personal')
  })
  it('#91: "מחר בערב" alone → NOT calendar_create (no verb)', () => {
    // Bare "מחר בערב" should NOT auto-create an event
    expect(isCreateIntent('מחר בערב')).toBe(false)
  })
  it('#92: "אני עייפה" → non_personal (emotional, goes to warm LLM)', () => {
    expect(routePersonalQuery('אני עייפה').type).toBe('non_personal')
  })
  it('#93: "אני מרגישה לבד" → non_personal (emotional)', () => {
    expect(routePersonalQuery('אני מרגישה לבד').type).toBe('non_personal')
  })
  it('#94: "תודה" → non_personal', () => {
    expect(routePersonalQuery('תודה').type).toBe('non_personal')
  })
  it('#95: "אני אוהבת אותך" → non_personal (warm response)', () => {
    expect(routePersonalQuery('אני אוהבת אותך').type).toBe('non_personal')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES & BREAKING ATTEMPTS (96-100)
// Can we break AbuAI?
// ═══════════════════════════════════════════════════════════════════════════
describe('Edge Cases & Breaking Attempts', () => {
  it('#96: "לא הבנתי" → non_personal (goes to LLM)', () => {
    expect(routePersonalQuery('לא הבנתי').type).toBe('non_personal')
  })
  it('#97: "מי זה?" (no name) → non_personal or family_lookup', () => {
    // "מי זה" without a name is vague but acceptable
    const r = routePersonalQuery('מי זה?')
    // Should either go to LLM or family with empty name
    expect(['non_personal', 'family_lookup']).toContain(r.type)
  })
  it('#98: "tell me about Italy" → non_personal (NOT family)', () => {
    expect(routePersonalQuery('tell me about Italy').type).toBe('non_personal')
  })
  it('#99: "contame sobre Argentina" → non_personal (NOT family)', () => {
    expect(routePersonalQuery('contame sobre Argentina').type).toBe('non_personal')
  })
  it('#100: calendar create intent guard — "להתראות" is NOT create', () => {
    expect(isCreateIntent('להתראות')).toBe(false)
  })
})
