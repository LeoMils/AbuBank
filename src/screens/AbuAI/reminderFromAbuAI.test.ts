/*
 * AbuAI → Reminder integration tests.
 * Proves that reminder phrases spoken in AbuAI route to the reminder
 * pipeline instead of creating appointments.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { isCreateIntent } from './calendarCreate'
import { detectReminderIntent, parseReminder } from '../AbuCalendar/reminders/reminderParser'

const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')

describe('AbuAI reminder intent detection', () => {
  it('"תזכירי לי לקחת כדור בערב" is both create intent AND reminder intent', () => {
    const text = 'תזכירי לי לקחת כדור בערב'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('reminder')
  })

  it('"תזכירי לי להתקשר ליעל" is reminder intent', () => {
    const text = 'תזכירי לי להתקשר ליעל'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('reminder')
  })

  it('"תזכירי לי מחר בבוקר לקחת תרופה" is reminder intent', () => {
    const text = 'תזכירי לי מחר בבוקר לקחת תרופה'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('reminder')
  })

  it('"תקבעי לי פגישה מחר בעשר" is appointment, NOT reminder', () => {
    const text = 'תקבעי לי פגישה מחר בעשר'
    expect(isCreateIntent(text)).toBe(true)
    expect(detectReminderIntent(text)).toBe('appointment')
  })

  it('"בעוד 5 דקות להתקשר" is reminder intent', () => {
    const text = 'תזכירי לי בעוד 5 דקות להתקשר'
    expect(detectReminderIntent(text)).toBe('reminder')
  })
})

describe('AbuAI reminder parsing produces correct draft', () => {
  const TODAY = '2026-06-06'

  it('medication reminder has correct category', () => {
    const draft = parseReminder('תזכירי לי לקחת כדור בעוד שעה', TODAY)
    expect(draft.category).toBe('medication')
    expect(draft.title).toContain('לקחת כדור')
  })

  it('call reminder has correct category', () => {
    const draft = parseReminder('תזכירי לי להתקשר ליעל בעוד חצי שעה', TODAY)
    expect(draft.category).toBe('call')
  })

  it('reminder with time has dueAt', () => {
    const draft = parseReminder('תזכירי לי בעוד שעה לשתות מים', TODAY)
    expect(draft.dueAt).toBeDefined()
    expect(draft.dueAt!.length).toBeGreaterThan(0)
  })

  it('reminder without time has missing time', () => {
    const draft = parseReminder('תזכירי לי לקחת כדור', TODAY)
    expect(draft.missingFields).toContain('time')
  })

  it('readbackText is generated', () => {
    const draft = parseReminder('תזכירי לי בעוד שעה לקחת כדור', TODAY)
    expect(draft.readbackText.length).toBeGreaterThan(0)
  })
})

describe('AbuAI index.tsx reminder routing wiring', () => {
  it('imports detectReminderIntent from reminderParser', () => {
    expect(INDEX_SRC.includes("import { detectReminderIntent, parseReminder }")).toBe(true)
  })

  it('imports createReminder from reminderStore', () => {
    expect(INDEX_SRC.includes("import { createReminder, createDefaultAlertPolicy }")).toBe(true)
  })

  it('checks detectReminderIntent before appointment create', () => {
    const reminderCheck = INDEX_SRC.indexOf("detectReminderIntent(msgText) === 'reminder'")
    const appointmentCheck = INDEX_SRC.indexOf("// Check for new create intent (appointments only")
    expect(reminderCheck).toBeGreaterThan(0)
    expect(appointmentCheck).toBeGreaterThan(0)
    expect(reminderCheck).toBeLessThan(appointmentCheck)
  })

  it('pendingReminder state exists', () => {
    expect(INDEX_SRC.includes('pendingReminder')).toBe(true)
    expect(INDEX_SRC.includes('setPendingReminder')).toBe(true)
  })

  it('confirmation saves via createReminder', () => {
    expect(INDEX_SRC.includes("createReminder({")).toBe(true)
    expect(INDEX_SRC.includes("תזכורת נשמרה:")).toBe(true)
  })

  it('cancel clears pendingReminder', () => {
    expect(INDEX_SRC.includes("setPendingReminder(null)")).toBe(true)
    expect(INDEX_SRC.includes("ביטלתי")).toBe(true)
  })

  it('missing time asks clarification', () => {
    expect(INDEX_SRC.includes("מתי להזכיר לך")).toBe(true)
  })

  it('missing time stores partial draft for time follow-up', () => {
    // When time is missing, setPendingReminder(draft) is called
    // so the next user message can provide time
    const section = INDEX_SRC.slice(INDEX_SRC.indexOf("// Missing time → store partial"))
    const block = section.slice(0, section.indexOf('return'))
    expect(block.includes('setPendingReminder(draft)')).toBe(true)
  })

  it('time follow-up re-parses with pending title', () => {
    // Case 1 in pending handler: !pendingReminder.dueAt → combines
    // user's time answer with pending title and re-parses
    expect(INDEX_SRC.includes('// Case 1: waiting for time')).toBe(true)
    expect(INDEX_SRC.includes('תזכירי לי ${msgText} ${pendingReminder.title')).toBe(true)
  })

  it('time follow-up still allows cancel', () => {
    expect(INDEX_SRC.includes("isCancel(msgText)")).toBe(true)
    expect(INDEX_SRC.includes("ביטלתי")).toBe(true)
  })

  it('unresolvable time asks again clearly', () => {
    expect(INDEX_SRC.includes("לא הבנתי את השעה")).toBe(true)
  })

  it('no false saved claim — confirmation required before save', () => {
    expect(INDEX_SRC.includes("לשמור?")).toBe(true)
  })
})

describe('AbuAI voice mode reminder routing', () => {
  it('voice handleText checks detectReminderIntent before appointment create', () => {
    // The voice path (handleText) must detect reminders BEFORE falling
    // through to the appointment create state machine
    const voiceReminderCheck = INDEX_SRC.indexOf("// ─── Voice reminder (before appointment create)")
    const voiceAppointmentCheck = INDEX_SRC.indexOf("if (cs.phase !== 'idle' || isCreateIntent(effectiveText))")
    expect(voiceReminderCheck).toBeGreaterThan(0)
    expect(voiceAppointmentCheck).toBeGreaterThan(0)
    expect(voiceReminderCheck).toBeLessThan(voiceAppointmentCheck)
  })

  it('voice path handles pendingReminder confirmation', () => {
    const voicePendingCheck = INDEX_SRC.indexOf("// ─── Voice pending reminder confirmation")
    expect(voicePendingCheck).toBeGreaterThan(0)
  })

  it('voice reminder speaks response via TTS', () => {
    // After creating reminder response, voice mode speaks it
    const section = INDEX_SRC.slice(INDEX_SRC.indexOf("// ─── Voice reminder (before appointment create)"))
    const block = section.slice(0, section.indexOf("// ─── Voice pending reminder confirmation"))
    expect(block.includes('speakVoiceMode')).toBe(true)
    expect(block.includes("'reminder-turn'")).toBe(true)
  })
})
