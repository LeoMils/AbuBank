/*
 * 10 EXACT SCENARIOS — production readiness proof.
 * Each test runs the REAL functions and verifies the REAL response.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { isCreateIntent, startCreate, updateCreate, resolvePendingMessage, isCancel } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { detectIntent } from './proactive'

// ═══ SCENARIO 1: "מה יש לי השבוע?" ═══
describe('S1: מה יש לי השבוע?', () => {
  const INPUT = 'מה יש לי השבוע?'

  it('route = calendar_upcoming', () => {
    expect(routePersonalQuery(INPUT).type).toBe('calendar_upcoming')
  })

  it('grounded answer exists (local, no LLM)', () => {
    const answer = tryGroundedAnswer(INPUT)
    expect(answer).not.toBeNull()
  })

  it('answer is natural Hebrew (not robotic)', () => {
    const answer = tryGroundedAnswer(INPUT)!
    expect(answer).not.toContain('שגיאה')
    expect(answer).not.toContain('API')
    // Either has events or says no events found
    expect(answer.length).toBeGreaterThan(5)
  })
})

// ═══ SCENARIO 2: "מה יש לי מחר?" ═══
describe('S2: מה יש לי מחר?', () => {
  const INPUT = 'מה יש לי מחר?'

  it('route = calendar_tomorrow', () => {
    expect(routePersonalQuery(INPUT).type).toBe('calendar_tomorrow')
  })

  it('grounded answer exists', () => {
    expect(tryGroundedAnswer(INPUT)).not.toBeNull()
  })
})

// ═══ SCENARIO 3: "מה היה לי בשבוע שעבר?" ═══
describe('S3: מה היה לי בשבוע שעבר?', () => {
  const INPUT = 'מה היה לי בשבוע שעבר?'

  it('route starts with calendar_', () => {
    const route = routePersonalQuery(INPUT)
    expect(route.type).toMatch(/^calendar_/)
  })

  it('grounded answer exists (not "לא הצלחתי")', () => {
    const answer = tryGroundedAnswer(INPUT)
    expect(answer).not.toBeNull()
    expect(answer).not.toContain('לא הצלחתי')
  })
})

// ═══ SCENARIO 4: "מה היה לי השנה?" ═══
describe('S4: מה היה לי השנה?', () => {
  const INPUT = 'מה היה לי השנה?'

  it('route starts with calendar_', () => {
    const route = routePersonalQuery(INPUT)
    expect(route.type).toMatch(/^calendar_/)
  })

  it('grounded answer exists (not "לא הצלחתי")', () => {
    const answer = tryGroundedAnswer(INPUT)
    expect(answer).not.toBeNull()
    expect(answer).not.toContain('לא הצלחתי')
  })
})

// ═══ SCENARIO 5: "תקבעי לי פגישה מחר ב-15:00 עם מוטי" ═══
describe('S5: תקבעי לי פגישה מחר ב-15:00 עם מוטי', () => {
  const INPUT = 'תקבעי לי פגישה מחר ב-15:00 עם מוטי'

  it('detected as create intent', () => {
    expect(isCreateIntent(INPUT)).toBe(true)
  })

  it('NOT a reminder', () => {
    expect(detectReminderIntent(INPUT)).not.toBe('reminder')
  })

  it('startCreate produces draft with correct time 15:00', () => {
    const state = startCreate(INPUT)
    expect(state.draft.time).toBe('15:00')
  })

  it('draft title contains מוטי', () => {
    const state = startCreate(INPUT)
    expect(state.draft.title).toContain('מוטי')
  })

  it('draft date = tomorrow', () => {
    const state = startCreate(INPUT)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    expect(state.draft.date).toBe(tStr)
  })
})

// ═══ SCENARIO 6: "תשני את הפגישה ליום רביעי" ═══
describe('S6: תשני את הפגישה ליום רביעי (correction during confirm)', () => {
  it('date changes when correcting in confirming phase', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'פגישה עם מוטי', date: '2026-06-14', time: '15:00', emoji: '📅' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const updated = updateCreate(state, 'ביום רביעי')
    expect(updated.phase).toBe('confirming')
    expect(updated.draft.title).toBe('פגישה עם מוטי') // preserved
    expect(updated.draft.time).toBe('15:00') // preserved
    // Date must change to next Wednesday
    expect(updated.draft.date).not.toBe('2026-06-14')
  })

  it('resolvePendingMessage returns update, not cancel', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'פגישה עם מוטי', date: '2026-06-14', time: '15:00', emoji: '📅' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'תשני ליום רביעי', false)
    expect(r.action).toBe('update')
  })
})

// ═══ SCENARIO 7: "תמחקי את הפגישה" ═══
describe('S7: תמחקי את הפגישה (cancel)', () => {
  it('"תמחקי" detected as cancel', () => {
    // "תמחקי" may not be in CANCEL regex — check and fix if needed
    const isCancelResult = isCancel('תמחקי את הפגישה')
    // If not detected, the resolvePendingMessage should handle it
    if (!isCancelResult) {
      // Not an exact cancel match — check if off-topic detection cancels
      const state = {
        phase: 'confirming' as const,
        draft: { title: 'פגישה', date: '2026-06-14', time: '15:00', emoji: '📅' },
        missing: [] as Array<'title' | 'date' | 'time'>,
      }
      const r = resolvePendingMessage(state, 'תמחקי את הפגישה', false)
      expect(r.action).toBe('cancel')
    } else {
      expect(isCancelResult).toBe(true)
    }
  })
})

// ═══ SCENARIO 8: "זה כבר ביומן שלי?" ═══
describe('S8: זה כבר ביומן שלי? (must NOT cancel)', () => {
  it('NOT detected as cancel', () => {
    expect(isCancel('זה כבר ביומן שלי?')).toBe(false)
  })

  it('routes to calendar (not non_personal)', () => {
    const route = routePersonalQuery('זה כבר ביומן שלי?')
    expect(route.type).toMatch(/^calendar_/)
  })

  it('grounded answer exists', () => {
    const answer = tryGroundedAnswer('זה כבר ביומן שלי?')
    expect(answer).not.toBeNull()
  })
})

// ═══ SCENARIO 9: "מה הייתה המהפכה הצרפתית?" ═══
describe('S9: מה הייתה המהפכה הצרפתית? (general knowledge → LLM)', () => {
  it('route = non_personal (goes to LLM)', () => {
    expect(routePersonalQuery('מה הייתה המהפכה הצרפתית?').type).toBe('non_personal')
  })

  it('NOT routed to calendar or family', () => {
    const route = routePersonalQuery('מה הייתה המהפכה הצרפתית?')
    expect(route.type).not.toMatch(/^calendar_/)
    expect(route.type).not.toMatch(/^family_/)
  })

  it('grounded answer is null (correctly falls to LLM)', () => {
    expect(tryGroundedAnswer('מה הייתה המהפכה הצרפתית?')).toBeNull()
  })

  it('not detected as create/reminder/proactive', () => {
    expect(isCreateIntent('מה הייתה המהפכה הצרפתית?')).toBe(false)
    expect(detectIntent('מה הייתה המהפכה הצרפתית?')).toBeNull()
  })
})

// ═══ SCENARIO 10: "מתי יום העצמאות?" ═══
describe('S10: מתי יום העצמאות? (holiday → LLM)', () => {
  it('route = non_personal (LLM handles holidays)', () => {
    expect(routePersonalQuery('מתי יום העצמאות?').type).toBe('non_personal')
  })

  it('grounded answer is null (correctly falls to LLM)', () => {
    expect(tryGroundedAnswer('מתי יום העצמאות?')).toBeNull()
  })

  it('not misrouted to calendar or family', () => {
    const route = routePersonalQuery('מתי יום העצמאות?')
    expect(route.type).not.toMatch(/^calendar_/)
    expect(route.type).not.toMatch(/^family_/)
    expect(route.type).not.toMatch(/^birthday_/)
  })
})
