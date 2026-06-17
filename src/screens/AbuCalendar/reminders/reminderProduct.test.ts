/*
 * Reminder product behavior tests — re-fire, medication priority,
 * snooze correctness, recurring daily, simplified popup.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ENGINE = fs.readFileSync(path.resolve(__dirname, 'ReminderDueEngine.tsx'), 'utf8')
const STORE = fs.readFileSync(path.resolve(__dirname, 'reminderStore.ts'), 'utf8')
const DELIVERY = fs.readFileSync(path.resolve(__dirname, 'reminderDelivery.ts'), 'utf8')

describe('reminder re-fire after no response', () => {
  it('REFIRE_MS_MEDICATION is 15 minutes', () => {
    expect(ENGINE.includes('REFIRE_MS_MEDICATION = 15 * 60 * 1000')).toBe(true)
  })

  it('REFIRE_MS_DEFAULT is 30 minutes', () => {
    expect(ENGINE.includes('REFIRE_MS_DEFAULT = 30 * 60 * 1000')).toBe(true)
  })

  it('re-fire checks medication vs default interval', () => {
    expect(ENGINE.includes("r.category === 'medication' ? REFIRE_MS_MEDICATION : REFIRE_MS_DEFAULT")).toBe(true)
  })

  it('re-fire limit is 3 times', () => {
    expect(ENGINE.includes('count < 3')).toBe(true)
  })

  it('re-fire plays sound again', () => {
    expect(ENGINE.includes('playReminderBeep()')).toBe(true)
  })

  it('re-fire TTS adds urgency prefix after first re-fire', () => {
    expect(ENGINE.includes('עדיין לא בוצע')).toBe(true)
  })

  it('re-fire tracking is cleared on done/snooze/delete', () => {
    expect(ENGINE.includes('clearRefireTracking(current.id)')).toBe(true)
    // Should appear 3 times: handleDone, handleSnooze, handleDelete
    const matches = ENGINE.match(/clearRefireTracking\(current\.id\)/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(3)
  })
})

describe('medication reminder priority', () => {
  it('medication re-fire notice shown in popup', () => {
    expect(ENGINE.includes('reminder-refire-notice')).toBe(true)
    expect(ENGINE.includes('עדיין לא סומן — חשוב לקחת')).toBe(true)
  })

  it('medication notice only shows after first re-fire (not on initial)', () => {
    expect(ENGINE.includes("(refireCount.get(current.id) ?? 0) > 0")).toBe(true)
  })
})

describe('popup simplification', () => {
  it('delete button says "לא צריך" not "מחיקה"', () => {
    expect(ENGINE.includes('לא צריך')).toBe(true)
  })

  it('done button is 60px minimum height', () => {
    expect(ENGINE.includes('minHeight: 60')).toBe(true)
  })

  it('snooze button is full-width', () => {
    // snooze should have width: 100%
    const snoozeSection = ENGINE.slice(ENGINE.indexOf('reminder-due-snooze-btn'))
    expect(snoozeSection.includes("width: '100%'")).toBe(true)
  })

  it('popup has done, snooze, and delete/dismiss buttons', () => {
    expect(ENGINE.includes('reminder-due-done-btn')).toBe(true)
    expect(ENGINE.includes('reminder-due-snooze-btn')).toBe(true)
    expect(ENGINE.includes('reminder-due-delete-btn')).toBe(true)
    expect(ENGINE.includes('reminder-due-dismiss-btn')).toBe(true)
  })

  it('medication popup shows "לא עכשיו" (dismiss) instead of "לא צריך" (delete)', () => {
    // Medication: dismiss-only button, does NOT call handleDelete
    expect(ENGINE.includes("current.category === 'medication'")).toBe(true)
    expect(ENGINE.includes('לא עכשיו')).toBe(true)
    // Dismiss button does NOT call cancelReminder — only removes from popup
    const dismissSection = ENGINE.slice(ENGINE.indexOf('reminder-due-dismiss-btn'))
    const dismissEnd = dismissSection.indexOf('</button>')
    const dismissBlock = dismissSection.slice(0, dismissEnd)
    expect(dismissBlock.includes('handleDelete')).toBe(false)
  })

  it('non-medication popup still shows "לא צריך" (delete)', () => {
    expect(ENGINE.includes('לא צריך')).toBe(true)
    expect(ENGINE.includes('reminder-due-delete-btn')).toBe(true)
  })
})

describe('snooze correctness', () => {
  it('snoozeReminder sets snoozedUntil to now + minutes', () => {
    expect(STORE.includes('Date.now() + minutes * 60_000')).toBe(true)
  })

  it('snooze calls rescheduleReminderNotification for native sync', () => {
    const snoozeFn = STORE.slice(STORE.indexOf('export function snoozeReminder'))
    expect(snoozeFn.includes('rescheduleReminderNotification')).toBe(true)
  })
})

describe('recurring daily correctness', () => {
  it('daily recurring sets next day at same time on Done', () => {
    expect(ENGINE.includes("next.setDate(next.getDate() + 1)")).toBe(true)
    expect(ENGINE.includes("next.setHours(h ?? 9, m ?? 0, 0, 0)")).toBe(true)
  })

  it('recurring Done calls rescheduleReminder not markReminderDone', () => {
    const doneFn = ENGINE.slice(ENGINE.indexOf('function handleDone'))
    expect(doneFn.includes('rescheduleReminder(current.id')).toBe(true)
  })
})

describe('native scheduling consistency', () => {
  it('create calls scheduleReminderNotification', () => {
    expect(STORE.includes('void scheduleReminderNotification(reminder)')).toBe(true)
  })

  it('done calls cancelReminderNotification', () => {
    expect(STORE.includes('void cancelReminderNotification(id)')).toBe(true)
  })

  it('cancel calls cancelReminderNotification', () => {
    const cancelFn = STORE.slice(STORE.indexOf('export function cancelReminder'))
    expect(cancelFn.includes('cancelReminderNotification')).toBe(true)
  })

  it('snooze calls rescheduleReminderNotification', () => {
    const snoozeFn = STORE.slice(STORE.indexOf('export function snoozeReminder'))
    expect(snoozeFn.includes('rescheduleReminderNotification')).toBe(true)
  })

  it('reschedule calls rescheduleReminderNotification', () => {
    const reschFn = STORE.slice(STORE.indexOf('export function rescheduleReminder'))
    expect(reschFn.includes('rescheduleReminderNotification')).toBe(true)
  })

  it('native unavailable returns false without crash', () => {
    expect(DELIVERY.includes("_nativeAvailable = false")).toBe(true)
    expect(DELIVERY.includes('return false')).toBe(true)
  })
})
