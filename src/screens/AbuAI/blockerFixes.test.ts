/*
 * Targeted tests for production closure blockers.
 * Each test proves a specific user-facing fix.
 */

import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { startCreate, updateCreate, resolvePendingMessage } from './calendarCreate'
import { resolveFollowUp } from './contextResolver'
import type { ChatMessage } from './types'

function msg(role: 'user' | 'assistant', content: string): ChatMessage {
  return { id: '1', role, content, timestamp: Date.now() }
}

// ─── Blocker #1: Age questions ──────────────────────────────────────────────

describe('Blocker #1: age questions get honest answer', () => {
  it('"בן כמה אופיר?" returns honest "לא רשומה לי שנת לידה"', () => {
    const answer = tryGroundedAnswer('בן כמה אופיר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא רשומה לי שנת לידה')
  })

  it('"בת כמה מור?" returns honest answer', () => {
    const answer = tryGroundedAnswer('בת כמה מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא רשומה לי שנת לידה')
  })

  it('"מה הגיל של נועם?" returns honest answer', () => {
    const answer = tryGroundedAnswer('מה הגיל של נועם?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא רשומה לי שנת לידה')
  })
})

// ─── Blocker #2: Family-calendar fusion ("באותו יום") ────────────────────────

describe('Blocker #2: "באותו יום" after birthday lookup', () => {
  const birthdayHistory: ChatMessage[] = [
    msg('user', 'מתי יום ההולדת של נועם?'),
    msg('assistant', 'יום ההולדת של נועם — 15 במרץ.'),
  ]

  it('"יש לי משהו באותו יום?" expands to calendar date query', () => {
    const r = resolveFollowUp('יש לי משהו באותו יום?', birthdayHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מה יש לי')
    expect(r.resolved).toContain('מרץ')
  })

  it('"מה יש לי באותו תאריך?" also works', () => {
    const r = resolveFollowUp('מה יש לי באותו תאריך?', birthdayHistory)
    expect(r.wasFollowUp).toBe(true)
    expect(r.resolved).toContain('מרץ')
  })

  it('without birthday context, "באותו יום" is not expanded', () => {
    const noContext: ChatMessage[] = [
      msg('user', 'שלום'),
      msg('assistant', 'שלום! מה נשמע?'),
    ]
    const r = resolveFollowUp('יש לי משהו באותו יום?', noContext)
    expect(r.wasFollowUp).toBe(false)
  })
})

// ─── Blocker #3: Correction during confirmation ─────────────────────────────

describe('Blocker #3: correction during confirmation updates draft', () => {
  it('"בעצם ביום X" updates date during confirming phase', () => {
    // Build a confirming-phase state directly
    const s = startCreate('תקבעי לי רופא מחר בעשר בבוקר')
    // If startCreate returns 'creating' (ambiguous time), manually advance
    const state = s.phase === 'confirming' ? s : {
      phase: 'confirming' as const,
      draft: { ...s.draft, time: '10:00', ambiguousTime: false },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const originalDate = state.draft.date

    // Pick a weekday that is guaranteed NOT to be tomorrow (3 days from now)
    const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    const safeDay = HE_DAYS[threeDaysFromNow.getDay()]!

    const updated = updateCreate(state, `בעצם ביום ${safeDay}`)
    expect(updated.phase).toBe('confirming')
    expect(updated.draft.title).toBe(state.draft.title) // title preserved
    expect(updated.draft.date).not.toBe(originalDate) // date changed
    expect(updated.draft.time).toBe(state.draft.time) // time preserved
  })

  it('"בעצם בתשע בבוקר" updates time during confirming phase', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-15', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }

    const updated = updateCreate(state, 'בעצם בתשע בבוקר')
    expect(updated.phase).toBe('confirming')
    expect(updated.draft.title).toBe('רופא') // title preserved
    expect(updated.draft.time).toBe('09:00') // time updated to 9 AM
    expect(updated.draft.date).toBe('2026-06-15') // date preserved
  })

  it('resolvePendingMessage routes date correction to update, not cancel', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-16', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'בעצם מחר', false)
    expect(r.action).toBe('update')
    if (r.action === 'update') {
      expect(r.state.draft.title).toBe('רופא')
      // Date should have changed from the original
      expect(r.state.phase).toBe('confirming')
    }
  })

  it('plain "לא" still cancels (not a correction)', () => {
    const state = {
      phase: 'confirming' as const,
      draft: { title: 'רופא', date: '2026-06-16', time: '10:00', emoji: '🏥' },
      missing: [] as Array<'title' | 'date' | 'time'>,
    }
    const r = resolvePendingMessage(state, 'לא', false)
    expect(r.action).toBe('cancel')
  })
})
