import { describe, it, expect } from 'vitest'
import { adviseFreeSpeech } from './freeSpeechAdvisory'

// ─── Calendar create → intercepted with handoff ──────────────────────────────

describe('freeSpeechAdvisory — calendar create interception', () => {
  it.each([
    'שימי לי תור לרופא מחר בעשר',
    'תקבעי לי פגישה ביום שלישי',
    'תוסיפי אירוע ביומן',
    'add a doctor appointment tomorrow at 10',
    'agregá turno con el médico',
  ])('"%s" → intercepted with calendar handoff, no side effects', (text) => {
    const result = adviseFreeSpeech(text)
    expect(result.response).not.toBeNull()
    expect(result.response).toContain('יומן')
    expect(result.route.domain).toBe('calendar')
    expect(result.route.action).toBe('create')
  })

  it('calendar create does NOT create any event (pure function, no side effects)', () => {
    // adviseFreeSpeech is a pure function — verify it returns a string, not an object with appointment
    const result = adviseFreeSpeech('תקבעי לי פגישה מחר בעשר')
    expect(typeof result.response).toBe('string')
    expect(result.response).not.toBeNull()
    // No appointment, no draft, no state mutation — just a message
    expect(result).not.toHaveProperty('appointment')
    expect(result).not.toHaveProperty('draft')
  })
})

// ─── Calendar query → falls through to existing AbuAI path ────────────────

describe('freeSpeechAdvisory — calendar query passthrough', () => {
  it.each([
    'מה יש לי היום',
    'מה קורה מחר',
    'מה קבעתי מחר',
    "what's on today",
    'qué tengo hoy',
  ])('"%s" → null (falls through to existing AbuAI calendar read path)', (text) => {
    const result = adviseFreeSpeech(text)
    expect(result.response).toBeNull()
    expect(result.route.domain).toBe('calendar')
    expect(result.route.action).toBe('query')
  })
})

// ─── WhatsApp → intercepted with safe message ────────────────────────────────

describe('freeSpeechAdvisory — WhatsApp interception', () => {
  it.each([
    'שלחי הודעה ללאו',
    'תכתבי ליעל שאני מאחרת',
    'שלחי וואטסאפ למור',
    'send a whatsapp to Leo',
    'mandále un whatsapp a Leo',
    'תתקשרי ללאו',
    'call Leo',
  ])('"%s" → intercepted with WhatsApp handoff, no send', (text) => {
    const result = adviseFreeSpeech(text)
    expect(result.response).not.toBeNull()
    expect(result.response).toContain('הודעה')
    expect(result.route.domain).toBe('whatsapp')
  })

  it('WhatsApp interception does NOT send any message (pure function)', () => {
    const result = adviseFreeSpeech('שלחי הודעה ללאו')
    expect(typeof result.response).toBe('string')
    expect(result).not.toHaveProperty('sent')
    expect(result).not.toHaveProperty('draft')
  })
})

// ─── Navigation → informational message ───────────────────────────────────

describe('freeSpeechAdvisory — navigation interception', () => {
  it('known target → informational response', () => {
    const result = adviseFreeSpeech('פתחי משחקים')
    expect(result.response).not.toBeNull()
    expect(result.route.domain).toBe('navigation')
  })

  it('unclear target → asks where to go', () => {
    const result = adviseFreeSpeech('פתחי את זה')
    expect(result.response).not.toBeNull()
    expect(result.response).toContain('לאן')
    expect(result.route.domain).toBe('navigation')
    expect(result.route.safety).toBe('clarify')
  })
})

// ─── Unclear → Hebrew clarification ──────────────────────────────────────

describe('freeSpeechAdvisory — unclear interception', () => {
  it('short unclear input → clarification question', () => {
    const result = adviseFreeSpeech('mmm ok')
    expect(result.response).not.toBeNull()
    expect(result.response).toContain('לא הבנתי')
    expect(result.route.domain).toBe('unclear')
  })

  it('empty input → clarification', () => {
    const result = adviseFreeSpeech('')
    expect(result.response).not.toBeNull()
    expect(result.route.domain).toBe('unclear')
  })
})

// ─── Personal/family → falls through ──────────────────────────────────────

describe('freeSpeechAdvisory — personal queries passthrough', () => {
  it.each([
    'מי זה אופיר',
    'מתי יום ההולדת של לאו',
    'הנכדים שלי',
    "who is Adar",
    'quién es Leo',
  ])('"%s" → null (falls through to grounded answer path)', (text) => {
    const result = adviseFreeSpeech(text)
    expect(result.response).toBeNull()
    expect(result.route.domain).toBe('abuai')
  })
})

// ─── General/greetings → falls through ────────────────────────────────────

describe('freeSpeechAdvisory — general conversation passthrough', () => {
  it.each([
    'שלום',
    'בוקר טוב',
    'hello',
    'hola',
  ])('greeting "%s" → null (falls through to existing AbuAI greeting path)', (text) => {
    const result = adviseFreeSpeech(text)
    expect(result.response).toBeNull()
    expect(result.route.domain).toBe('general')
  })

  it('open-ended question → null (falls through)', () => {
    const result = adviseFreeSpeech('ספרי לי על ההיסטוריה של ארגנטינה')
    expect(result.response).toBeNull()
    expect(result.route.domain).toBe('general')
  })
})

// ─── Safety invariants ──────────────────────────────────────────────────────

describe('freeSpeechAdvisory — safety invariants', () => {
  it('every result includes the route for observability', () => {
    const result = adviseFreeSpeech('מה יש לי היום')
    expect(result.route).toBeDefined()
    expect(result.route.domain).toBeDefined()
    expect(result.route.action).toBeDefined()
    expect(result.route.safety).toBeDefined()
  })

  it('intercepted responses are always in Hebrew', () => {
    const writeTests = [
      'שימי לי תור לרופא מחר',
      'שלחי הודעה ללאו',
      'פתחי משחקים',
    ]
    for (const text of writeTests) {
      const result = adviseFreeSpeech(text)
      if (result.response) {
        // Hebrew chars present in every intercepted response
        expect(/[\u0590-\u05FF]/.test(result.response)).toBe(true)
      }
    }
  })

  it('no intercepted response contains technical jargon', () => {
    const tests = [
      'שימי לי תור לרופא מחר',
      'שלחי הודעה ללאו',
      'פתחי את זה',
      'mmm ok',
    ]
    const jargon = /error|exception|null|undefined|API|endpoint|route|domain|handler/i
    for (const text of tests) {
      const result = adviseFreeSpeech(text)
      if (result.response) {
        expect(jargon.test(result.response)).toBe(false)
      }
    }
  })
})

// ─── Wiring contract: index.tsx imports adviseFreeSpeech ──────────────────────

describe('freeSpeechAdvisory — wiring contract', () => {
  it('AbuAI index.tsx imports adviseFreeSpeech', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes("import { adviseFreeSpeech } from './freeSpeechAdvisory'")).toBe(true)
  })

  it('AbuAI index.tsx calls adviseFreeSpeech before isCreateIntent', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    const advisoryIdx = src.indexOf('adviseFreeSpeech(msgText)')
    const createIdx = src.indexOf('isCreateIntent(msgText)')
    expect(advisoryIdx).toBeGreaterThan(-1)
    expect(createIdx).toBeGreaterThan(-1)
    expect(advisoryIdx).toBeLessThan(createIdx)
  })

  it('existing isCreateIntent path is preserved (not deleted)', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes('isCreateIntent(msgText)')).toBe(true)
    expect(src.includes('startCreate(msgText)')).toBe(true)
    expect(src.includes("shapeCreateConfirm(next.draft)")).toBe(true)
  })

  it('existing grounded answer path is preserved', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes('tryGroundedAnswer(msgText)')).toBe(true)
  })

  it('existing online wiring is preserved', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes('isOnlineCurrentInfoQuery(msgText)')).toBe(true)
    expect(src.includes('answerOnlineCurrentInfo')).toBe(true)
  })
})
