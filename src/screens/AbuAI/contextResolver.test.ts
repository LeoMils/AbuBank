/*
 * Context resolver tests — prove conversational follow-ups work.
 *
 * The key scenario: Martita asks "מה יש לי היום?" then says "ומחר?"
 * and the system understands she means "מה יש לי מחר?" without
 * needing to repeat the full phrase.
 */

import { describe, it, expect } from 'vitest'
import { resolveFollowUp } from './contextResolver'
import { routePersonalQuery } from './router'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: '1', role, content, timestamp: Date.now() }
}

describe('temporal follow-ups after calendar query', () => {
  const calendarHistory: ChatMessage[] = [
    msg('user', 'מה יש לי היום?'),
    msg('assistant', 'היום יש לך תור לרופא ב-10:00 ופגישה ב-14:00.'),
  ]

  it('"ומחר?" expands to "מה יש לי מחר?"', () => {
    const r = resolveFollowUp('ומחר?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי מחר?')
  })

  it('"מחר?" expands to "מה יש לי מחר?" (no leading ו)', () => {
    const r = resolveFollowUp('מחר?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי מחר?')
  })

  it('"ואתמול?" expands to "מה יש לי אתמול?"', () => {
    const r = resolveFollowUp('ואתמול?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי אתמול?')
  })

  it('"ובשלישי?" expands to "מה יש לי ביום שלישי?"', () => {
    const r = resolveFollowUp('ובשלישי?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי ביום שלישי?')
  })

  it('"ביום רביעי?" expands to "מה יש לי ביום רביעי?"', () => {
    const r = resolveFollowUp('ביום רביעי?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי ביום רביעי?')
  })

  it('"והשבוע?" expands to "מה יש לי השבוע?"', () => {
    const r = resolveFollowUp('והשבוע?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי השבוע?')
  })

  it('"ושבוע הבא?" expands to "מה יש לי שבוע הבא?"', () => {
    const r = resolveFollowUp('ושבוע הבא?', calendarHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי שבוע הבא?')
  })
})

describe('bare "מחר?" without prior context', () => {
  it('"מחר?" still expands (most likely intent is calendar)', () => {
    const r = resolveFollowUp('מחר?', [])
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('מה יש לי מחר?')
  })
})

describe('name follow-ups after family query', () => {
  const familyHistory: ChatMessage[] = [
    msg('user', 'מי זה נועם?'),
    msg('assistant', 'נועם הוא הנכד של Martita, בנו של לאו.'),
  ]

  it('"ומור?" expands to "ספרי לי על מור"', () => {
    const r = resolveFollowUp('ומור?', familyHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('ספרי לי על מור')
  })

  it('"ולאו?" expands to "ספרי לי על לאו"', () => {
    const r = resolveFollowUp('ולאו?', familyHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toBe('ספרי לי על לאו')
  })
})

describe('does NOT expand long sentences or non-follow-ups', () => {
  const calendarHistory: ChatMessage[] = [
    msg('user', 'מה יש לי היום?'),
    msg('assistant', 'היום יש לך תור לרופא.'),
  ]

  it('full sentence is not expanded', () => {
    const r = resolveFollowUp('מה יש לי מחר בבוקר?', calendarHistory)
    expect(r.wasFollowUp).toBe(false)
  })

  it('unrelated short text is not expanded', () => {
    const r = resolveFollowUp('תודה', calendarHistory)
    expect(r.wasFollowUp).toBe(false)
  })

  it('name without ו prefix is not expanded as family follow-up', () => {
    const familyHistory: ChatMessage[] = [
      msg('user', 'מי זה נועם?'),
      msg('assistant', 'נועם הוא הנכד של Martita.'),
    ]
    const r = resolveFollowUp('מור', familyHistory)
    expect(r.wasFollowUp).toBe(false)
  })
})

describe('end-to-end: expanded text routes correctly', () => {
  // Verify that the expanded text actually hits the right router path
  it('"מה יש לי מחר?" (expanded from "ומחר?") matches CALENDAR_TOMORROW', () => {
    const route = routePersonalQuery('מה יש לי מחר?')
    expect(route.type).toBe('calendar_tomorrow')
  })

  it('"מה יש לי ביום שלישי?" (expanded from "ובשלישי?") matches CALENDAR_WEEKDAY_READ', () => {
    const route = routePersonalQuery('מה יש לי ביום שלישי?')
    expect(route.type).toBe('calendar_exact_date')
  })

  it('"ספרי לי על מור" (expanded from "ומור?") matches family_lookup', () => {
    const route = routePersonalQuery('ספרי לי על מור')
    expect(route.type).toBe('family_lookup')
  })
})
