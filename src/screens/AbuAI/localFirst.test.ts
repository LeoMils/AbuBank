/*
 * Local-first routing tests — prove that Martita's 10 core use cases
 * are handled entirely locally without any LLM/provider call.
 */

import { describe, it, expect } from 'vitest'
import { isCreateIntent } from './calendarCreate'
import { detectReminderIntent } from '../AbuCalendar/reminders/reminderParser'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { isScheduleQuery, isFamilyQuery } from '../AbuCalendar/intentParser'
import fs from 'fs'
import path from 'path'

const SERVICE_SRC = fs.readFileSync(path.resolve(__dirname, 'service.ts'), 'utf8')

// Helper: determine if a message would be handled locally (no LLM needed)
function isHandledLocally(text: string): { local: boolean; handler: string } {
  // 1. Pending states (createState/pendingReminder) — skip, these are stateful

  // 2. Reminder intent
  if (isCreateIntent(text) && detectReminderIntent(text) === 'reminder') {
    return { local: true, handler: 'REMINDER_CREATE' }
  }

  // 3. Appointment intent
  if (isCreateIntent(text)) {
    return { local: true, handler: 'APPOINTMENT_CREATE' }
  }

  // 4. Grounded answer (calendar/family/birthday)
  const grounded = tryGroundedAnswer(text)
  if (grounded !== null) {
    return { local: true, handler: 'GROUNDED_ANSWER' }
  }

  // 5. Schedule query (intentParser)
  if (isScheduleQuery(text)) {
    return { local: true, handler: 'SCHEDULE_QUERY' }
  }

  // 6. Family query (intentParser)
  if (isFamilyQuery(text)) {
    return { local: true, handler: 'FAMILY_QUERY' }
  }

  return { local: false, handler: 'LLM' }
}

describe('local-first: 10 core cases do NOT need LLM', () => {
  it('1. "מי זה אופיר?" → local grounded answer', () => {
    const r = isHandledLocally('מי זה אופיר?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('2. "מתי יום ההולדת של נועם?" → local grounded answer', () => {
    const r = isHandledLocally('מתי יום ההולדת של נועם?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('3. "מה יש לי היום?" → local grounded answer', () => {
    const r = isHandledLocally('מה יש לי היום?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('4. "מה יש לי מחר?" → local grounded answer', () => {
    const r = isHandledLocally('מה יש לי מחר?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('5. "תזכירי לי לקחת כדור בערב" → local reminder create', () => {
    const r = isHandledLocally('תזכירי לי לקחת כדור בערב')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('REMINDER_CREATE')
  })

  it('6. "תזכירי לי להתקשר ליעל מחר" → local reminder create', () => {
    const r = isHandledLocally('תזכירי לי להתקשר ליעל מחר')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('REMINDER_CREATE')
  })

  it('7. "תקבעי לי רופא בשלישי בעשר" → local appointment create', () => {
    const r = isHandledLocally('תקבעי לי רופא בשלישי בעשר')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('APPOINTMENT_CREATE')
  })

  it('8. "מי הילדים של מור?" → local grounded answer', () => {
    const r = isHandledLocally('מי הילדים של מור?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('9. "מתי יש לי רופא?" → local grounded answer', () => {
    const r = isHandledLocally('מתי יש לי רופא?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })

  it('10. "מה התוכניות שלי השבוע?" → local grounded answer', () => {
    const r = isHandledLocally('מה התוכניות שלי השבוע?')
    expect(r.local).toBe(true)
    expect(r.handler).toBe('GROUNDED_ANSWER')
  })
})

describe('local-first: confirm/cancel are local', () => {
  it('"כן" is handled by pending state (no LLM)', () => {
    // כן/לא are handled by createState or pendingReminder — both local
    // They never reach the LLM. We verify the routing exists.
    const idx = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(idx.includes("isConfirm(msgText)")).toBe(true)
    expect(idx.includes("isCancel(msgText)")).toBe(true)
  })
})

describe('LLM failure message is warm and helpful', () => {
  it('sendMessage fallback guides user to local capabilities', () => {
    expect(SERVICE_SRC.includes('אפשר עדיין לקבוע פגישה')).toBe(true)
    expect(SERVICE_SRC.includes('להגדיר תזכורת')).toBe(true)
    expect(SERVICE_SRC.includes('לבדוק את היומן')).toBe(true)
    expect(SERVICE_SRC.includes('לשאול על המשפחה')).toBe(true)
  })

  it('streamMessage fallback guides user to local capabilities', () => {
    expect(SERVICE_SRC.includes('אפשר לקבוע פגישה')).toBe(true)
    expect(SERVICE_SRC.includes('לבדוק יומן')).toBe(true)
  })

  it('fallback does NOT say "כל השרתים תפוסים"', () => {
    expect(SERVICE_SRC.includes('כל השרתים תפוסים')).toBe(false)
  })

  it('fallback does NOT say "שגיאה בחיבור"', () => {
    expect(SERVICE_SRC.includes('שגיאה בחיבור')).toBe(false)
  })
})

describe('Groq does not receive tools (prevents 400)', () => {
  it('supportsTools excludes groq-client', () => {
    // The supportsTools line must NOT include groq-client
    expect(SERVICE_SRC.includes("provider.kind === 'openai-server' || provider.kind === 'groq-client'")).toBe(false)
    expect(SERVICE_SRC.includes("provider.kind === 'openai-server'")).toBe(true)
  })

  it('only openai-server is treated as supportsTools', () => {
    const line = SERVICE_SRC.split('\n').find(l => l.includes('const supportsTools'))
    expect(line).toBeDefined()
    expect(line).not.toContain('groq')
    expect(line).toContain('openai-server')
  })
})
