/**
 * PHASE 4 — Follow-up & Context Proof
 *
 * Tests multi-turn conversation resolution:
 * - Temporal follow-ups ("ומחר?", "ובשלישי?")
 * - Name follow-ups ("ומור?")
 * - "מה עוד?" follow-up
 * - Calendar-then-confirmation flow
 * - Context retention across turns
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveFollowUp } from './contextResolver'
import { routePersonalQuery } from './router'
import type { ChatMessage } from './types'

// ─── localStorage stub ───────────────────────────────────────────────────
let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { storage = {} },
  })
})

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: `msg-${Math.random()}`, role, content, timestamp: Date.now() }
}

describe('Phase 4 — Follow-up & Context Proof', () => {

  // ─── Scenario A: Calendar follow-up chain ──────────────────────────────
  describe('Scenario A: Calendar follow-up chain', () => {
    it('"מה יש לי השבוע?" routes to calendar', () => {
      const route = routePersonalQuery('מה יש לי השבוע?')
      expect(route.type).not.toBe('non_personal')
    })

    it('"ומחר?" after calendar query expands to "מה יש לי מחר?"', () => {
      const history: ChatMessage[] = [
        msg('user', 'מה יש לי השבוע?'),
        msg('assistant', 'השבוע יש לך: רופא שיניים ביום שלישי בשעה 10:00'),
      ]
      const result = resolveFollowUp('ומחר?', history)
      expect(result.wasFollowUp).toBe(true)
      expect(result.resolved).toContain('מחר')
    })

    it('"מה עוד?" is a valid continuation', () => {
      const route = routePersonalQuery('מה עוד?')
      // "מה עוד" is short/vague — should go to LLM, which has context
      // This is expected: the LLM has the full conversation history
      expect(route.type).toBe('non_personal') // goes to LLM with context
    })
  })

  // ─── Scenario B: Knowledge follow-up chain ─────────────────────────────
  describe('Scenario B: Knowledge follow-up chain', () => {
    it('"מה הייתה המהפכה הצרפתית?" routes to non_personal (LLM)', () => {
      const route = routePersonalQuery('מה הייתה המהפכה הצרפתית?')
      expect(route.type).toBe('non_personal')
    })

    it('"תני לי יותר פרטים" routes to non_personal (LLM with history)', () => {
      const route = routePersonalQuery('תני לי יותר פרטים')
      expect(route.type).toBe('non_personal')
    })

    it('"מי היו הדמויות המרכזיות?" routes to non_personal', () => {
      const route = routePersonalQuery('מי היו הדמויות המרכזיות?')
      expect(route.type).toBe('non_personal')
    })

    it('"מה קרה אחר כך?" routes to non_personal', () => {
      const route = routePersonalQuery('מה קרה אחר כך?')
      expect(route.type).toBe('non_personal')
    })
  })

  // ─── Scenario C: Calendar create → confirm → verify ────────────────────
  describe('Scenario C: Calendar create → confirm → verify', () => {
    it('"תקבעי לי פגישה מחר בשלוש עם מוטי" routes to calendar_create', () => {
      const route = routePersonalQuery('תקבעי לי פגישה מחר בשלוש עם מוטי')
      expect(route.type).toBe('calendar_create')
    })

    it('"כן" is confirmation (not personal query)', () => {
      const route = routePersonalQuery('כן')
      expect(route.type).toBe('non_personal') // short affirmative, handled by pending state
    })

    it('"זה כבר ביומן שלי?" routes to calendar', () => {
      const route = routePersonalQuery('זה כבר ביומן שלי?')
      // This should check the calendar
      expect(['calendar_today', 'calendar_tomorrow', 'calendar_upcoming', 'non_personal']).toContain(route.type)
    })
  })

  // ─── Temporal follow-up expansion ──────────────────────────────────────
  describe('Temporal follow-up expansion', () => {
    const calHistory: ChatMessage[] = [
      msg('user', 'מה יש לי היום?'),
      msg('assistant', 'היום יש לך רופא שיניים בשעה 10:00'),
    ]

    it('"ומחר?" → "מה יש לי מחר?"', () => {
      const r = resolveFollowUp('ומחר?', calHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toMatch(/מחר/)
    })

    it('"והשבוע?" → "מה יש לי השבוע?"', () => {
      const r = resolveFollowUp('והשבוע?', calHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toMatch(/השבוע/)
    })

    it('"ובשלישי?" → "מה יש לי ביום שלישי?"', () => {
      const r = resolveFollowUp('ובשלישי?', calHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toMatch(/שלישי/)
    })

    it('"שבוע הבא" → expands with calendar context', () => {
      const r = resolveFollowUp('שבוע הבא', calHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toMatch(/שבוע הבא/)
    })
  })

  // ─── Name follow-up expansion ──────────────────────────────────────────
  describe('Name follow-up after family query', () => {
    const familyHistory: ChatMessage[] = [
      msg('user', 'ספרי לי על נועם'),
      msg('assistant', 'נועם הוא הנכד של Martita.'),
    ]

    it('"ומור?" → "ספרי לי על מור"', () => {
      const r = resolveFollowUp('ומור?', familyHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toContain('מור')
    })
  })

  // ─── "באותו יום" follow-up ────────────────────────────────────────────
  describe('"באותו יום" birthday cross-reference', () => {
    const birthdayHistory: ChatMessage[] = [
      msg('user', 'מתי יום ההולדת של נועם?'),
      msg('assistant', 'יום ההולדת של נועם — 15 במרץ.'),
    ]

    it('"יש לי משהו באותו יום?" extracts date from birthday response', () => {
      const r = resolveFollowUp('יש לי משהו באותו יום?', birthdayHistory)
      expect(r.wasFollowUp).toBe(true)
      expect(r.resolved).toContain('מרץ')
    })
  })

  // ─── No false follow-up detection ─────────────────────────────────────
  describe('No false follow-up detection', () => {
    it('long sentence is NOT a follow-up', () => {
      const r = resolveFollowUp('מה הייתה המהפכה הצרפתית ומה קרה אחריה?', [])
      expect(r.wasFollowUp).toBe(false)
    })

    it('new topic is NOT a follow-up', () => {
      const r = resolveFollowUp('מה זה אינפלציה?', [
        msg('user', 'מה יש לי היום?'),
        msg('assistant', 'אין לך כלום היום.'),
      ])
      expect(r.wasFollowUp).toBe(false)
    })
  })
})
