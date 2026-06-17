/**
 * Production Smoke Tests
 *
 * End-to-end pipeline validation: routing → intent → calendar → error recovery.
 * Uses actual production functions (no mocks) to mirror the real deployed app.
 */

import { describe, it, expect } from 'vitest'
import { routePersonalQuery, type RouteType } from './router'
import { isCreateIntent, isConfirm, isCancel } from './calendarCreate'
import { isScheduleQuery } from '../AbuCalendar/intentParser'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectEmoji } from '../AbuCalendar/service'

// ─── Route classifier (mirrors real AbuAI dispatch) ────────────────────────────
function fullRoute(text: string): RouteType {
  return routePersonalQuery(text).type
}

// ─── Smoke Suite ───────────────────────────────────────────────────────────────
describe('Production Smoke — Full Pipeline', () => {

  // ── S1: AbuAI routing basics ────────────────────────────────────────────────
  describe('S1: AbuAI routing — open & greet', () => {
    it('routes general greeting to non_personal (→ LLM)', () => {
      expect(fullRoute('שלום')).toBe('non_personal')
    })

    it('routes empty input to non_personal', () => {
      expect(fullRoute('')).toBe('non_personal')
    })
  })

  // ── S2: General knowledge → LLM ────────────────────────────────────────────
  describe('S2: General knowledge → non_personal (LLM)', () => {
    it('"מהי המהפכה הצרפתית" → non_personal', () => {
      expect(fullRoute('מהי המהפכה הצרפתית')).toBe('non_personal')
    })

    it('"ספרי לי בדיחה" → non_personal', () => {
      expect(fullRoute('ספרי לי בדיחה')).toBe('non_personal')
    })

    it('"מי היה אלברט איינשטיין" → non_personal', () => {
      expect(fullRoute('מי היה אלברט איינשטיין')).toBe('non_personal')
    })
  })

  // ── S3: Calendar query routing ──────────────────────────────────────────────
  describe('S3: Calendar query routing', () => {
    it('"מה יש לי היום" → calendar_today', () => {
      expect(fullRoute('מה יש לי היום')).toBe('calendar_today')
    })

    it('"מה קבעתי מחר" → calendar_tomorrow', () => {
      expect(fullRoute('מה קבעתי מחר')).toBe('calendar_tomorrow')
    })

    it('"מה יש לי השבוע" → calendar_upcoming', () => {
      expect(fullRoute('מה יש לי השבוע')).toBe('calendar_upcoming')
    })

    it('"מה יש ביומן ביולי" → calendar_upcoming or calendar_month', () => {
      const route = fullRoute('מה יש ביומן ביולי')
      expect(['calendar_upcoming', 'calendar_month']).toContain(route)
    })
  })

  // ── S4: Create appointment routing ──────────────────────────────────────────
  describe('S4: Appointment creation intent', () => {
    it('"תקבע לי פגישה מחר בשלוש עם מוטי" → calendar_create', () => {
      expect(fullRoute('תקבע לי פגישה מחר בשלוש עם מוטי')).toBe('calendar_create')
    })

    it('isCreateIntent detects appointment requests', () => {
      expect(isCreateIntent('תקבע לי פגישה מחר')).toBe(true)
      expect(isCreateIntent('תוסיפי פגישה עם הרופא')).toBe(true)
    })

    it('isCreateIntent does NOT fire on queries', () => {
      expect(isCreateIntent('מה יש לי מחר')).toBe(false)
      expect(isCreateIntent('מהי המהפכה הצרפתית')).toBe(false)
    })

    it('reminder intent separates from appointment', () => {
      expect(detectReminderIntent('תזכירי לי לקחת כדור')).toBe('reminder')
      expect(detectReminderIntent('תקבע לי פגישה עם הרופא')).not.toBe('reminder')
    })
  })

  // ── S5: Confirm / Cancel ────────────────────────────────────────────────────
  describe('S5: Confirm and cancel detection', () => {
    it('"כן" → confirm', () => {
      expect(isConfirm('כן')).toBe(true)
    })

    it('"לא" → cancel', () => {
      expect(isCancel('לא')).toBe(true)
    })

    it('"תמחקי" → cancel', () => {
      expect(isCancel('תמחקי')).toBe(true)
    })

    it('"בטח" → confirm', () => {
      expect(isConfirm('בטח')).toBe(true)
    })

    it('non-confirm/cancel text is neither', () => {
      expect(isConfirm('מה יש לי מחר')).toBe(false)
      expect(isCancel('מה יש לי מחר')).toBe(false)
    })
  })

  // ── S6: Family lookup ───────────────────────────────────────────────────────
  describe('S6: Family query routing', () => {
    it('"מתי יום ההולדת של מור" → birthday_lookup', () => {
      expect(fullRoute('מתי יום ההולדת של מור')).toBe('birthday_lookup')
    })

    it('"איפה גר אילי" → family_location', () => {
      expect(fullRoute('איפה גר אילי')).toBe('family_location')
    })
  })

  // ── S7: Emoji detection (visual correctness) ────────────────────────────────
  describe('S7: Emoji assignment', () => {
    it('doctor → 🏥', () => {
      expect(detectEmoji('פגישה עם הרופא')).toBe('🏥')
    })

    it('haircut → ✂️', () => {
      expect(detectEmoji('תספורת')).toBe('✂️')
    })

    it('birthday → 🎂', () => {
      expect(detectEmoji('יום הולדת של מור')).toBe('🎂')
    })
  })

  // ── S8: Edge cases — router never crashes ───────────────────────────────────
  describe('S8: Edge cases & stress', () => {
    it('router never throws on unexpected input', () => {
      const edgeCases = [
        '', '   ', '!!!', '🎉🎉🎉', 'a'.repeat(5000),
        'null', 'undefined', '<script>alert(1)</script>',
        'DELETE FROM appointments', '////',
      ]
      for (const input of edgeCases) {
        expect(() => fullRoute(input)).not.toThrow()
      }
    })

    it('all edge cases route to non_personal (LLM)', () => {
      const junk = ['!!!', '🎉', '<script>alert(1)</script>', 'DROP TABLE']
      for (const input of junk) {
        expect(fullRoute(input)).toBe('non_personal')
      }
    })

    it('isScheduleQuery handles empty and garbage gracefully', () => {
      expect(() => isScheduleQuery('')).not.toThrow()
      expect(() => isScheduleQuery('null')).not.toThrow()
      expect(isScheduleQuery('')).toBe(false)
    })
  })
})
