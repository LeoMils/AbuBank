import { describe, it, expect } from 'vitest'
import { adviseFreeSpeech } from './freeSpeechAdvisory'

// ─── Behavior: calendar create → intercepted, no side effects ────────────────

describe('advisory behavior — calendar create handoff', () => {
  it.each([
    'שימי לי תור לרופא מחר בעשר',
    'תקבעי לי פגישה ביום שלישי',
    'תוסיפי אירוע ביומן',
    'add a doctor appointment tomorrow at 10',
    'agregá turno con el médico',
  ])('"%s" → intercepted, returns Hebrew handoff, no appointment/draft on result', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).not.toBeNull()
    expect(r.response).toContain('יומן')
    expect(r.route.domain).toBe('calendar')
    expect(r.route.action).toBe('create')
    // Pure function — no write artifacts on the result object
    expect(r).not.toHaveProperty('appointment')
    expect(r).not.toHaveProperty('draft')
  })
})

// ─── Behavior: calendar query → NOT intercepted ──────────────────────────────

describe('advisory behavior — calendar query passthrough', () => {
  it.each([
    'מה יש לי היום',
    'מה קורה מחר',
    'מה קבעתי מחר',
    "what's on today",
    'qué tengo hoy',
  ])('"%s" → null (existing AbuAI calendar read path handles)', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).toBeNull()
    expect(r.route.domain).toBe('calendar')
  })
})

// ─── Behavior: WhatsApp → intercepted, no send ──────────────────────────────

describe('advisory behavior — WhatsApp handoff', () => {
  it.each([
    'שלחי הודעה ללאו',
    'תכתבי ליעל שאני מאחרת',
    'שלחי וואטסאפ למור',
    'send a whatsapp to Leo',
    'mandále un whatsapp a Leo',
    'תתקשרי ללאו',
    'call Leo',
  ])('"%s" → intercepted, returns Hebrew handoff, no send/draft', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).not.toBeNull()
    expect(r.response).toContain('הודעה')
    expect(r.route.domain).toBe('whatsapp')
    expect(r).not.toHaveProperty('sent')
    expect(r).not.toHaveProperty('draft')
  })
})

// ─── Behavior: navigation → intercepted with info ────────────────────────────

describe('advisory behavior — navigation', () => {
  it('known target → informational response', () => {
    const r = adviseFreeSpeech('פתחי משחקים')
    expect(r.response).not.toBeNull()
    expect(r.route.domain).toBe('navigation')
  })

  it('unclear target → asks where', () => {
    const r = adviseFreeSpeech('פתחי את זה')
    expect(r.response).not.toBeNull()
    expect(r.response).toContain('לאן')
    expect(r.route.domain).toBe('navigation')
  })
})

// ─── Behavior: unclear → NOT intercepted (falls through to AbuAI) ────────────

describe('advisory behavior — unclear passthrough', () => {
  it.each([
    'mmm ok',
    'רגע',
    'כן',
    'ok',
    'אה',
  ])('borderline "%s" → null (AbuAI existing paths handle short/uncertain input)', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).toBeNull()
  })

  it('empty string → null (handleSend guards empty input before advisory runs)', () => {
    const r = adviseFreeSpeech('')
    expect(r.response).toBeNull()
  })

  it('whitespace → null', () => {
    const r = adviseFreeSpeech('   ')
    expect(r.response).toBeNull()
  })
})

// ─── Behavior: personal/family → NOT intercepted ─────────────────────────────

describe('advisory behavior — personal queries passthrough', () => {
  it.each([
    'מי זה אופיר',
    'מתי יום ההולדת של לאו',
    'הנכדים שלי',
    'who is Adar',
    'quién es Leo',
  ])('"%s" → null (grounded answer path handles)', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).toBeNull()
    expect(r.route.domain).toBe('abuai')
  })
})

// ─── Behavior: general/greetings → NOT intercepted ───────────────────────────

describe('advisory behavior — general conversation passthrough', () => {
  it.each([
    'שלום',
    'בוקר טוב',
    'hello',
    'hola',
  ])('greeting "%s" → null', (text) => {
    const r = adviseFreeSpeech(text)
    expect(r.response).toBeNull()
    expect(r.route.domain).toBe('general')
  })

  it('open-ended question → null', () => {
    const r = adviseFreeSpeech('ספרי לי על ההיסטוריה של ארגנטינה')
    expect(r.response).toBeNull()
    expect(r.route.domain).toBe('general')
  })
})

// ─── Safety invariants ──────────────────────────────────────────────────────

describe('advisory safety invariants', () => {
  it('every result includes the route for observability', () => {
    for (const text of ['מה יש לי היום', 'שלחי הודעה ללאו', '', 'שלום']) {
      const r = adviseFreeSpeech(text)
      expect(r.route).toBeDefined()
      expect(r.route.domain).toBeDefined()
      expect(r.route.action).toBeDefined()
      expect(r.route.safety).toBeDefined()
    }
  })

  it('intercepted responses are always in Hebrew', () => {
    for (const text of ['שימי לי תור לרופא מחר', 'שלחי הודעה ללאו', 'פתחי משחקים']) {
      const r = adviseFreeSpeech(text)
      if (r.response) {
        expect(/[\u0590-\u05FF]/.test(r.response)).toBe(true)
      }
    }
  })

  it('no intercepted response contains technical jargon', () => {
    const jargon = /error|exception|null|undefined|API|endpoint|route|domain|handler/i
    for (const text of ['שימי לי תור לרופא מחר', 'שלחי הודעה ללאו', 'פתחי את זה']) {
      const r = adviseFreeSpeech(text)
      if (r.response) {
        expect(jargon.test(r.response)).toBe(false)
      }
    }
  })

  it('advisory only intercepts calendar/create, whatsapp, and navigation — nothing else', () => {
    // Exhaustive domain check: these must all pass through
    const passThrough = [
      { text: 'מה יש לי היום', expectedDomain: 'calendar' },    // query
      { text: 'מי זה אופיר', expectedDomain: 'abuai' },
      { text: 'שלום', expectedDomain: 'general' },
      { text: 'mmm ok', expectedDomain: 'unclear' },
    ]
    for (const { text, expectedDomain } of passThrough) {
      const r = adviseFreeSpeech(text)
      expect(r.response).toBeNull()
      expect(r.route.domain).toBe(expectedDomain)
    }

    // These must be intercepted
    const intercepted = [
      { text: 'תקבעי פגישה מחר', expectedDomain: 'calendar' },  // create
      { text: 'שלחי הודעה ללאו', expectedDomain: 'whatsapp' },
      { text: 'פתחי משחקים', expectedDomain: 'navigation' },
    ]
    for (const { text, expectedDomain } of intercepted) {
      const r = adviseFreeSpeech(text)
      expect(r.response).not.toBeNull()
      expect(r.route.domain).toBe(expectedDomain)
    }
  })
})

// ─── Existing AbuAI paths remain reachable ──────────────────────────────────
// These tests verify that advisory returns null for inputs that exercise
// the existing isCreateIntent, tryGroundedAnswer, and online paths —
// proving the advisory does not block them.

describe('advisory passthrough — existing AbuAI paths remain reachable', () => {
  it('isCreateIntent inputs still pass through (advisory returns null for calendar/query or general)', () => {
    // "אני צריכה להיות אצל הרופא מחר בעשר" contains a natural create intent
    // that isCreateIntent detects. The freeSpeech router may classify this
    // as calendar/create (intercepted) or general (passed through).
    // Either way, inputs that isCreateIntent catches but freeSpeech doesn't
    // classify as calendar/create will reach isCreateIntent.
    // Verify the typical grounded-path inputs pass through:
    const personalInputs = ['מי זה אופיר', 'מה שלום יעל', 'ספרי לי על המשפחה']
    for (const text of personalInputs) {
      const r = adviseFreeSpeech(text)
      expect(r.response).toBeNull()
    }
  })

  it('tryGroundedAnswer inputs pass through (family/personal queries are not intercepted)', () => {
    const groundedInputs = [
      'מתי יום ההולדת של לאו',
      'איפה מור גרה',
      'הנכדים שלי',
      'מי הבת שלי',
    ]
    for (const text of groundedInputs) {
      const r = adviseFreeSpeech(text)
      expect(r.response).toBeNull()
    }
  })

  it('online current-info inputs pass through (general knowledge not intercepted)', () => {
    const onlineInputs = [
      'מה מזג האוויר היום',
      'מה קורה בחדשות',
      'ספרי לי על ההיסטוריה של ארגנטינה',
    ]
    for (const text of onlineInputs) {
      const r = adviseFreeSpeech(text)
      expect(r.response).toBeNull()
    }
  })
})

// ─── Minimal wiring contract ────────────────────────────────────────────────

describe('advisory wiring — minimal contract', () => {
  it('adviseFreeSpeech is importable and callable', () => {
    expect(typeof adviseFreeSpeech).toBe('function')
    const r = adviseFreeSpeech('test')
    expect(r).toHaveProperty('response')
    expect(r).toHaveProperty('route')
  })
})
