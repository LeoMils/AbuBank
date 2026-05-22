import { describe, it, expect } from 'vitest'
import { routeFreeSpeech } from './freeSpeechRouter'
import type { FreeSpeechRoute } from './freeSpeechTypes'

// Helper: assert domain + action + safety in one shot
function expectRoute(
  transcript: string,
  expected: {
    domain: FreeSpeechRoute['domain']
    action: FreeSpeechRoute['action']
    safety: FreeSpeechRoute['safety']
    confidence?: FreeSpeechRoute['confidence']
    language?: FreeSpeechRoute['language']
  },
) {
  const result = routeFreeSpeech(transcript)
  expect(result.domain).toBe(expected.domain)
  expect(result.action).toBe(expected.action)
  expect(result.safety).toBe(expected.safety)
  if (expected.confidence) expect(result.confidence).toBe(expected.confidence)
  if (expected.language) expect(result.language).toBe(expected.language)
}

// ─── Empty / too-short ──────────────────────────────────────────────────────

describe('freeSpeechRouter — edge cases', () => {
  it('empty string → unclear/clarify', () => {
    expectRoute('', { domain: 'unclear', action: 'clarify', safety: 'clarify', confidence: 'low' })
  })

  it('single character → unclear/clarify', () => {
    expectRoute('א', { domain: 'unclear', action: 'clarify', safety: 'clarify' })
  })

  it('whitespace only → unclear/clarify', () => {
    expectRoute('   ', { domain: 'unclear', action: 'clarify', safety: 'clarify' })
  })
})

// ─── Calendar QUERY (read-only) ─────────────────────────────────────────────

describe('freeSpeechRouter — calendar query', () => {
  it.each([
    'מה יש לי היום',
    'מה יש היום',
    'מה קורה מחר',
    'מה קבעתי מחר',
    'מה התוכנית היום',
    'מה יש לי מחר',
    'יש לי משהו מחר',
    'מתי יש לי רופא',
    'מתי התור הבא שלי',
    'מה יש השבוע',
    'מה יש שבוע הבא',
    'הפגישות הקרובות',
    'מה היה לי אתמול',
  ])('Hebrew "%s" → calendar/query/read_only', (text) => {
    expectRoute(text, { domain: 'calendar', action: 'query', safety: 'read_only', language: 'he' })
  })

  it.each([
    'qué tengo hoy',
    'qué tenés mañana',
    'cuándo tengo médico',
    'agenda de hoy',
    'calendario de mañana',
  ])('Spanish "%s" → calendar/query/read_only', (text) => {
    expectRoute(text, { domain: 'calendar', action: 'query', safety: 'read_only', language: 'es' })
  })

  it.each([
    "what's on today",
    "what do i have tomorrow",
    'upcoming appointments',
    'my calendar today',
    "tomorrow's schedule",
  ])('English "%s" → calendar/query/read_only', (text) => {
    expectRoute(text, { domain: 'calendar', action: 'query', safety: 'read_only', language: 'en' })
  })
})

// ─── Calendar CREATE (requires confirmation) ────────────────────────────────

describe('freeSpeechRouter — calendar create', () => {
  it.each([
    'שימי לי תור לרופא מחר בעשר',
    'תקבעי לי פגישה ביום שלישי',
    'תוסיפי אירוע ביומן',
    'תרשמי לי תור לדנטיסט',
    'תזכירי לי לקחת תרופה',
    'תכניסי לי פגישה בשלוש',
  ])('Hebrew "%s" → calendar/create/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'calendar',
      action: 'create',
      safety: 'requires_confirmation',
      language: 'he',
    })
  })

  it.each([
    'agregá turno con el médico',
    'agendá una reunión mañana',
    'poneme una cita el jueves',
    'recordame tomar la pastilla',
  ])('Spanish "%s" → calendar/create/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'calendar',
      action: 'create',
      safety: 'requires_confirmation',
      language: 'es',
    })
  })

  it.each([
    'add a doctor appointment tomorrow at 10',
    'schedule a meeting on Tuesday',
    'remind me to take medicine at 8',
    'book an appointment with the dentist',
  ])('English "%s" → calendar/create/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'calendar',
      action: 'create',
      safety: 'requires_confirmation',
      language: 'en',
    })
  })

  it('create with calendar context → high confidence', () => {
    const r = routeFreeSpeech('שימי לי תור לרופא מחר בעשר')
    expect(r.confidence).toBe('high')
  })

  it('create without calendar context → medium confidence', () => {
    const r = routeFreeSpeech('תוסיפי את זה ליומן')
    expect(r.confidence).toBe('medium')
  })
})

// ─── WhatsApp / messaging (requires confirmation) ───────────────────────────

describe('freeSpeechRouter — whatsapp', () => {
  it.each([
    'תכתבי ליעל שאני מאחרת',
    'שלחי הודעה ללאו',
    'שלחי וואטסאפ למור',
    'לשלוח הודעה לאופיר',
  ])('Hebrew "%s" → whatsapp/send_message/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
      language: 'he',
    })
  })

  it.each([
    'mandále un whatsapp a Leo',
    'enviále un mensaje a Mor',
    'escribíle a Yael',
  ])('Spanish "%s" → whatsapp/send_message/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
      language: 'es',
    })
  })

  it.each([
    'send a whatsapp to Leo',
    'text Mor',
    'send a message to Yael',
  ])('English "%s" → whatsapp/send_message/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
      language: 'en',
    })
  })
})

// ─── Call contact (routes to whatsapp domain) ───────────────────────────────

describe('freeSpeechRouter — call contact', () => {
  it.each([
    'תתקשרי ללאו',
    'להתקשר למור',
  ])('Hebrew call "%s" → whatsapp/send_message/requires_confirmation', (text) => {
    expectRoute(text, {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
      language: 'he',
    })
  })

  it('Spanish call → whatsapp domain', () => {
    expectRoute('llamá a Leo', {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
    })
  })

  it('English call → whatsapp domain', () => {
    expectRoute('call Leo', {
      domain: 'whatsapp',
      action: 'send_message',
      safety: 'requires_confirmation',
    })
  })
})

// ─── Navigation ─────────────────────────────────────────────────────────────

describe('freeSpeechRouter — navigation', () => {
  it.each([
    'פתחי משחקים',
    'תפתחי הגדרות',
    'לפתוח יומן',
    'קחי אותי ל הודעות',
    'תעברי ל הגדרות',
    'חזרי ל בית',
  ])('Hebrew "%s" with known target → navigation/navigate/read_only', (text) => {
    expectRoute(text, {
      domain: 'navigation',
      action: 'navigate',
      safety: 'read_only',
      confidence: 'high',
    })
  })

  it.each([
    'open games',
    'go to settings',
    'take me to calendar',
    'show me messages',
  ])('English "%s" → navigation/navigate/read_only', (text) => {
    expectRoute(text, {
      domain: 'navigation',
      action: 'navigate',
      safety: 'read_only',
      confidence: 'high',
    })
  })

  it('navigation verb without known target → medium/clarify', () => {
    const r = routeFreeSpeech('פתחי את זה')
    expect(r.domain).toBe('navigation')
    expect(r.confidence).toBe('medium')
    expect(r.safety).toBe('clarify')
  })
})

// ─── Personal / family (AbuAI, read-only) ───────────────────────────────────

describe('freeSpeechRouter — personal/family (abuai)', () => {
  it.each([
    'מי זה אופיר',
    'מי הנכד שלי',
    'הנכדים שלי',
    'איך קוראים לבן שלי',
    'מתי יום ההולדת של לאו',
    'מתי האזכרה של פפי',
    'איפה מור גרה',
  ])('Hebrew "%s" → abuai/answer/read_only', (text) => {
    expectRoute(text, { domain: 'abuai', action: 'answer', safety: 'read_only', language: 'he' })
  })

  it.each([
    'quién es Leo',
    'háblame de Mor',
    'contame de Ofir',
    'cuándo es el cumpleaños de Yael',
  ])('Spanish "%s" → abuai/answer/read_only', (text) => {
    expectRoute(text, { domain: 'abuai', action: 'answer', safety: 'read_only' })
  })

  it.each([
    'who is Adar',
    'tell me about Leo',
    "when is Mor's birthday",
  ])('English "%s" → abuai/answer/read_only', (text) => {
    expectRoute(text, { domain: 'abuai', action: 'answer', safety: 'read_only', language: 'en' })
  })
})

// ─── Greetings → general ───────────────────────────────────────────────────

describe('freeSpeechRouter — greetings', () => {
  it.each([
    'שלום',
    'היי',
    'בוקר טוב',
    'מה שלומך',
  ])('Hebrew greeting "%s" → general/answer/read_only', (text) => {
    expectRoute(text, { domain: 'general', action: 'answer', safety: 'read_only' })
  })

  it.each([
    'hola',
    'buen día',
    'cómo andás',
    'qué tal',
  ])('Spanish greeting "%s" → general/answer/read_only', (text) => {
    expectRoute(text, { domain: 'general', action: 'answer', safety: 'read_only' })
  })

  it.each([
    'hello',
    'good morning',
    'how are you',
  ])('English greeting "%s" → general/answer/read_only', (text) => {
    expectRoute(text, { domain: 'general', action: 'answer', safety: 'read_only' })
  })
})

// ─── General conversation (fallback) ────────────────────────────────────────

describe('freeSpeechRouter — general conversation', () => {
  it('open-ended question → general/answer/read_only', () => {
    expectRoute('recomendame un podcast sobre ciencia', {
      domain: 'general',
      action: 'answer',
      safety: 'read_only',
    })
  })

  it('random long sentence → general/answer/read_only', () => {
    expectRoute('ספרי לי על ההיסטוריה של ארגנטינה', {
      domain: 'general',
      action: 'answer',
      safety: 'read_only',
    })
  })

  it('short unknown → unclear/clarify', () => {
    expectRoute('mmm ok', { domain: 'unclear', action: 'clarify', safety: 'clarify' })
  })
})

// ─── Language detection ─────────────────────────────────────────────────────

describe('freeSpeechRouter — language detection', () => {
  it('Hebrew text detected', () => {
    expect(routeFreeSpeech('מה יש לי היום').language).toBe('he')
  })

  it('Spanish text detected', () => {
    expect(routeFreeSpeech('qué tengo hoy').language).toBe('es')
  })

  it('English text detected', () => {
    expect(routeFreeSpeech("what's on today").language).toBe('en')
  })

  it('mixed Hebrew + English → mixed', () => {
    expect(routeFreeSpeech('שלחי message ללאו please').language).toBe('mixed')
  })
})

// ─── Safety invariants ──────────────────────────────────────────────────────

describe('freeSpeechRouter — safety invariants', () => {
  it('write actions always require confirmation', () => {
    const writeUtterances = [
      'שימי לי תור לרופא מחר',
      'שלחי הודעה ללאו',
      'תתקשרי למור',
      'add appointment tomorrow',
      'mandále un whatsapp a Leo',
    ]
    for (const u of writeUtterances) {
      const r = routeFreeSpeech(u)
      expect(r.safety).toBe('requires_confirmation')
    }
  })

  it('read actions are always read_only or clarify', () => {
    const readUtterances = [
      'מה יש לי היום',
      'מי זה אופיר',
      'hello',
      "what's on today",
      'פתחי משחקים',
    ]
    for (const u of readUtterances) {
      const r = routeFreeSpeech(u)
      expect(['read_only', 'clarify']).toContain(r.safety)
    }
  })

  it('every route has normalizedText', () => {
    const r = routeFreeSpeech('  שלום   ')
    expect(r.normalizedText).toBe('שלום')
  })

  it('every route has at least one reason', () => {
    const r = routeFreeSpeech('מה יש לי היום')
    expect(r.reasons.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── Priority ordering ─────────────────────────────────────────────────────

describe('freeSpeechRouter — priority ordering', () => {
  it('messaging beats calendar when both could match', () => {
    // "write to Yael that I'm late" has messaging intent, not calendar
    const r = routeFreeSpeech('תכתבי ליעל שאני מאחרת')
    expect(r.domain).toBe('whatsapp')
  })

  it('calendar create beats calendar query', () => {
    // "שימי לי תור" has both create verb and appointment context
    const r = routeFreeSpeech('שימי לי תור לרופא')
    expect(r.domain).toBe('calendar')
    expect(r.action).toBe('create')
  })

  it('call beats personal lookup for contact action', () => {
    // "תתקשרי ללאו" should route to whatsapp, not abuai family lookup
    const r = routeFreeSpeech('תתקשרי ללאו')
    expect(r.domain).toBe('whatsapp')
  })
})

// ─── Calendar context as weak signal ────────────────────────────────────────

describe('freeSpeechRouter — calendar context fallback', () => {
  it('appointment word without verb → calendar/query/medium', () => {
    const r = routeFreeSpeech('יש לי פגישה')
    expect(r.domain).toBe('calendar')
    expect(r.action).toBe('query')
    expect(r.confidence).toBe('medium')
  })
})
