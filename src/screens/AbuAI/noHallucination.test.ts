import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  shapeNotFound,
  shapeToolError,
  shapeFamilyAnswer,
  shapeCalendarAnswer,
} from './responseShaper'
import { answerFromToolResult } from './groundedResponse'
import {
  isPersonalQuery,
  containsUngroundedClaim,
  tryGroundedAnswer,
  SYSTEM_PROMPT,
} from './service'
import * as toolsModule from './tools'

// Past-tense first-person success-claim verbs that imply a tool ran. "מצאתי"
// is allowed only inside the negation "לא מצאתי" / "לא מצאתי מידע".
const FORBIDDEN_SUCCESS_CLAIMS: Array<{ name: string; re: RegExp }> = [
  { name: 'בדקתי', re: /\bבדקתי\b/ },
  { name: 'חיפשתי', re: /\bחיפשתי\b/ },
  { name: 'אימתתי', re: /\bאימתתי\b/ },
  { name: 'אישרתי', re: /\bאישרתי\b/ },
  { name: 'searched', re: /\bsearched\b/i },
  { name: 'checked', re: /\bchecked\b/i },
  { name: 'verified', re: /\bverified\b/i },
  { name: 'מצאתי (without לא)', re: /(?<!לא\s)\bמצאתי\b/ },
  { name: 'I searched online', re: /searched\s+online/i },
  { name: 'I looked online', re: /looked\s+online/i },
  { name: 'בדקתי באינטרנט', re: /בדקתי\s+ב(?:אינטרנט|רשת|אונליין)/ },
]

// Honest, allowed wording when a tool failed or had no result.
const ALLOWED_HONEST_PHRASES = [
  'אני לא מצליחה לבדוק',
  'לא מצאתי מידע',
  'לא מצאתי משהו',
  'אין לי מידע',
  'לא יודעת',
  'תפתחי את היומן',
]

function expectNoForbiddenClaims(text: string, ctx: string) {
  for (const { name, re } of FORBIDDEN_SUCCESS_CLAIMS) {
    expect(re.test(text), `[${ctx}] forbidden claim "${name}" found in:\n${text}`).toBe(false)
  }
}

function expectAtLeastOneHonestPhrase(text: string, ctx: string) {
  const ok = ALLOWED_HONEST_PHRASES.some((p) => text.includes(p))
  expect(ok, `[${ctx}] no honest phrase found in:\n${text}`).toBe(true)
}

describe('AbuAI no-hallucination — shaper outputs', () => {
  it('shapeToolError() never claims a tool ran and uses honest wording', () => {
    const out = shapeToolError()
    expectNoForbiddenClaims(out, 'shapeToolError')
    expectAtLeastOneHonestPhrase(out, 'shapeToolError')
  })

  it('shapeNotFound() (no context) never claims a tool ran', () => {
    const out = shapeNotFound()
    expectNoForbiddenClaims(out, 'shapeNotFound()')
    expectAtLeastOneHonestPhrase(out, 'shapeNotFound()')
  })

  it('shapeNotFound("דניאל") names the entity but does not claim to have checked it', () => {
    const out = shapeNotFound('דניאל')
    expect(out).toContain('דניאל')
    expectNoForbiddenClaims(out, 'shapeNotFound(דניאל)')
    expect(out.startsWith('לא מצאתי')).toBe(true)
  })
})

describe('AbuAI no-hallucination — answerFromToolResult', () => {
  it('calendar tool error → honest "אני לא מצליחה לבדוק", no claim verbs', () => {
    const out = answerFromToolResult('calendar_today', { ok: false })
    expectNoForbiddenClaims(out, 'tool error / calendar_today')
    expect(out).toContain('אני לא מצליחה לבדוק')
  })

  it('family tool error → honest message, no claim verbs', () => {
    const out = answerFromToolResult('family_lookup', { ok: false })
    expectNoForbiddenClaims(out, 'tool error / family_lookup')
    expect(out).toContain('אני לא מצליחה לבדוק')
  })

  it('family found=false → "לא מצאתי", no fabrication, no past-tense success claim', () => {
    const out = answerFromToolResult('family_lookup', {
      ok: true, found: false, members: [], answer: '',
    })
    expectNoForbiddenClaims(out, 'family found=false')
    expect(out.startsWith('לא מצאתי')).toBe(true)
  })

  it('empty calendar summary passes through without injecting a claim verb', () => {
    const shaped = 'לא מצאתי משהו ביומן להיום.'
    const out = answerFromToolResult('calendar_today', { ok: true, events: [], summary: shaped })
    expectNoForbiddenClaims(out, 'empty calendar today')
    expect(out).toBe(shaped)
  })

  it('shapeCalendarAnswer for empty results never claims a check happened', () => {
    for (const scope of ['today', 'tomorrow', 'week', 'upcoming'] as const) {
      const out = shapeCalendarAnswer([], scope)
      expectNoForbiddenClaims(out, `shapeCalendarAnswer [] ${scope}`)
      expect(out).toContain('לא מצאתי')
    }
  })
})

describe('AbuAI no-hallucination — tryGroundedAnswer', () => {
  beforeEach(() => {
    // Use a clean localStorage so calendar-tool reads no user-saved events.
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  it('non-personal query returns null (no fabricated answer)', () => {
    expect(tryGroundedAnswer('מה מזג האוויר היום')).toBeNull()
    expect(tryGroundedAnswer('ספרי לי על איטליה')).toBeNull()
  })

  it('unknown family lookup returns honest "לא מצאתי" without claim verbs', () => {
    const out = tryGroundedAnswer('מי זה דניאלאלאלא')
    expect(out).not.toBeNull()
    expectNoForbiddenClaims(out!, 'unknown family')
    expect(out!).toContain('לא מצאתי')
  })

  it('"מה יש לי היום" with empty user-storage returns honest empty message, not "בדקתי"', () => {
    const out = tryGroundedAnswer('מה יש לי היום')
    expect(out).not.toBeNull()
    expectNoForbiddenClaims(out!, 'calendar_today empty storage')
  })
})

describe('AbuAI no-hallucination — web/online claim', () => {
  it('there is no exported web-search / online-search tool that the AI flow could call', () => {
    // tools.ts is the only tool surface used by tryGroundedAnswer/answerFromToolResult.
    const exported = Object.keys(toolsModule)
    for (const name of exported) {
      expect(/web|online|internet|search.*web/i.test(name)).toBe(false)
    }
    // Static-source check across the AbuAI flow files for any web-tool wiring.
    const router = readFileSync(resolve(__dirname, './router.ts'), 'utf8')
    const service = readFileSync(resolve(__dirname, './service.ts'), 'utf8')
    const grounded = readFileSync(resolve(__dirname, './groundedResponse.ts'), 'utf8')
    for (const src of [router, service, grounded]) {
      expect(/searchWeb|search_web|fetchWeb|web_search|webSearchTool/.test(src)).toBe(false)
    }
  })

  it('SYSTEM_PROMPT instructs the model to say it cannot check when a tool fails', () => {
    expect(SYSTEM_PROMPT).toContain('אם הכלי לא עובד')
    expect(SYSTEM_PROMPT).toContain('אני לא מצליחה לבדוק')
    expect(SYSTEM_PROMPT).toContain('אם הכלי מחזיר תוצאה ריקה')
    expect(SYSTEM_PROMPT).toContain('אל תמציאי')
  })

  it('SYSTEM_PROMPT never asserts the model has live web access', () => {
    // The model must not be told it has internet/web search.
    expect(SYSTEM_PROMPT).not.toMatch(/יש לך גישה (לאינטרנט|לרשת|לאונליין)/)
    expect(SYSTEM_PROMPT).not.toMatch(/at\s+your\s+disposal.*(web|internet)/i)
  })
})

describe('AbuAI no-hallucination — truthGuard runtime claim detection', () => {
  it('a calendar claim WITHOUT a tool call is flagged as ungrounded', () => {
    expect(containsUngroundedClaim('יש לך תור רופא ב-10:00 מחר', false)).toBe(true)
    expect(containsUngroundedClaim('אני רואה ביומן שלך פגישה', false)).toBe(true)
  })

  it('the same claim WITH a tool call is allowed', () => {
    expect(containsUngroundedClaim('יש לך תור רופא ב-10:00 מחר', true)).toBe(false)
  })

  it('honest empty / not-found responses are never flagged as ungrounded', () => {
    expect(containsUngroundedClaim('לא מצאתי משהו ביומן להיום.', false)).toBe(false)
    expect(containsUngroundedClaim('אני לא מצליחה לבדוק את זה כרגע. נסי שוב.', false)).toBe(false)
    expect(containsUngroundedClaim('לא מצאתי מידע על דניאלאלאלא.', false)).toBe(false)
  })
})

describe('AbuAI no-hallucination — known gap (NOT_PROVEN)', () => {
  // The current containsUngroundedClaim only inspects calendar phrases. It does
  // NOT block past-tense success-claim verbs like "בדקתי" / "חיפשתי" if the
  // model emits them without a tool call. This test documents the gap; product
  // behavior is not changed.
  it('containsUngroundedClaim DOES NOT yet block past-tense "בדקתי" without tool call (gap)', () => {
    const flagged = containsUngroundedClaim('בדקתי ולא מצאתי כלום', false)
    // Not asserting `true` (would be a behavior demand). Asserting the actual
    // current state so a future tightening is visible as a delta.
    expect(flagged).toBe(false)
  })
})

describe('AbuAI no-hallucination — isPersonalQuery routing', () => {
  it('personal calendar queries route to the grounded path', () => {
    expect(isPersonalQuery('מה יש לי היום')).toBe(true)
    expect(isPersonalQuery('מה קורה לי מחר')).toBe(true)
  })

  it('personal family queries route to the grounded path', () => {
    expect(isPersonalQuery('מי זה עילי')).toBe(true)
  })

  it('weather / general knowledge questions are not personal', () => {
    expect(isPersonalQuery('מה מזג האוויר')).toBe(false)
    expect(isPersonalQuery('ספרי לי על איטליה')).toBe(false)
  })
})

describe('AbuAI no-hallucination — shapeFamilyAnswer integrity', () => {
  it('returns the structured answer; never injects "בדקתי" / "חיפשתי"', () => {
    const out = shapeFamilyAnswer({
      canonicalName: 'Mor', hebrew: 'מור', aliases: ['מור'],
      relationship: 'daughter', relationshipHebrew: 'הבת',
    })
    expectNoForbiddenClaims(out, 'shapeFamilyAnswer')
  })
})
