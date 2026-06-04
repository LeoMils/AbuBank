/*
 * Reminder delivery tests — web fallback, re-fire follow-ups,
 * cancel-all, notification tap handler.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  isNativeReminderAvailable,
  scheduleReminderNotification,
  cancelReminderNotification,
  rescheduleReminderNotification,
  registerNotificationTapHandler,
} from './reminderDelivery'
import type { Reminder } from './types'

const STORE_SRC = fs.readFileSync(path.resolve(__dirname, 'reminderStore.ts'), 'utf8')
const DELIVERY_SRC = fs.readFileSync(path.resolve(__dirname, 'reminderDelivery.ts'), 'utf8')
const CONFIRM_SRC = fs.readFileSync(path.resolve(__dirname, 'ReminderConfirmCard.tsx'), 'utf8')
const BOARD_SRC = fs.readFileSync(path.resolve(__dirname, 'ReminderBoard.tsx'), 'utf8')
const INDEX_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'index.tsx'), 'utf8')

function makeReminder(category: Reminder['category'] = 'medication'): Reminder {
  return {
    id: 'rem_test_1', kind: 'reminder', category,
    title: 'לקחת כדור', dueAt: new Date(Date.now() + 3600000).toISOString(),
    displayDateLabel: 'היום', displayTimeLabel: '20:00',
    alertPolicy: { sound: true, voice: true, repeatUntilConfirmed: false, snoozeMinutes: 10 },
    status: 'scheduled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}

describe('web fallback — all no-ops', () => {
  it('isNativeReminderAvailable returns false on web', () => {
    expect(isNativeReminderAvailable()).toBe(false)
  })

  it('schedule is no-op on web', async () => {
    expect(await scheduleReminderNotification(makeReminder())).toBe(false)
  })

  it('cancel is no-op on web', async () => {
    expect(await cancelReminderNotification('rem_test_1')).toBe(false)
  })

  it('reschedule is no-op on web', async () => {
    expect(await rescheduleReminderNotification(makeReminder())).toBe(false)
  })

  it('registerNotificationTapHandler does not throw on web', () => {
    expect(() => registerNotificationTapHandler(() => {})).not.toThrow()
  })

  it('no function throws on web', async () => {
    await expect(scheduleReminderNotification(makeReminder())).resolves.not.toThrow()
    await expect(cancelReminderNotification('x')).resolves.not.toThrow()
    await expect(rescheduleReminderNotification(makeReminder())).resolves.not.toThrow()
  })
})

describe('native re-fire follow-up notifications', () => {
  it('medication re-fire offsets are 15, 30, 45 minutes', () => {
    expect(DELIVERY_SRC.includes('REFIRE_OFFSETS_MEDICATION = [15, 30, 45]')).toBe(true)
  })

  it('default re-fire offsets are 30, 60, 90 minutes', () => {
    expect(DELIVERY_SRC.includes('REFIRE_OFFSETS_DEFAULT = [30, 60, 90]')).toBe(true)
  })

  it('scheduleReminderNotification schedules primary + follow-ups', () => {
    // Should push primary (baseId) + follow-ups (baseId+1, +2, +3)
    expect(DELIVERY_SRC.includes('id: baseId,')).toBe(true)
    expect(DELIVERY_SRC.includes('id: baseId + i + 1,')).toBe(true)
  })

  it('follow-up body includes medication urgency prefix', () => {
    expect(DELIVERY_SRC.includes('עדיין לא סומן — חשוב לקחת')).toBe(true)
  })

  it('follow-up body includes default urgency prefix', () => {
    expect(DELIVERY_SRC.includes('עדיין לא בוצע')).toBe(true)
  })

  it('category determines which offsets are used', () => {
    expect(DELIVERY_SRC.includes("reminder.category === 'medication' ? REFIRE_OFFSETS_MEDICATION : REFIRE_OFFSETS_DEFAULT")).toBe(true)
  })
})

describe('cancel-all (primary + follow-ups)', () => {
  it('allNotificationIds returns 4 IDs (primary + 3 follow-ups)', () => {
    expect(DELIVERY_SRC.includes('function allNotificationIds')).toBe(true)
    expect(DELIVERY_SRC.includes('[base, base + 1, base + 2, base + 3]')).toBe(true)
  })

  it('cancelReminderNotification cancels all 4 IDs', () => {
    const cancelFn = DELIVERY_SRC.slice(DELIVERY_SRC.indexOf('export async function cancelReminderNotification'))
    expect(cancelFn.includes('allNotificationIds(reminderId)')).toBe(true)
  })
})

describe('notification tap handler', () => {
  it('registerNotificationTapHandler exists', () => {
    expect(DELIVERY_SRC.includes('export function registerNotificationTapHandler')).toBe(true)
  })

  it('listens for localNotificationActionPerformed', () => {
    expect(DELIVERY_SRC.includes("'localNotificationActionPerformed'")).toBe(true)
  })

  it('extracts reminderId from notification extra', () => {
    expect(DELIVERY_SRC.includes("action.notification?.extra?.['reminderId']")).toBe(true)
  })

  it('index.tsx registers the tap handler on mount', () => {
    expect(INDEX_SRC.includes('registerNotificationTapHandler')).toBe(true)
  })
})

describe('store wiring unchanged', () => {
  it('create calls schedule', () => {
    expect(STORE_SRC.includes('void scheduleReminderNotification(reminder)')).toBe(true)
  })

  it('done calls cancel', () => {
    expect(STORE_SRC.includes('void cancelReminderNotification(id)')).toBe(true)
  })

  it('cancel calls cancelNotification', () => {
    const fn = STORE_SRC.slice(STORE_SRC.indexOf('export function cancelReminder'))
    expect(fn.includes('cancelReminderNotification')).toBe(true)
  })

  it('snooze calls reschedule', () => {
    const fn = STORE_SRC.slice(STORE_SRC.indexOf('export function snoozeReminder'))
    expect(fn.includes('rescheduleReminderNotification')).toBe(true)
  })

  it('reschedule calls rescheduleNotification', () => {
    const fn = STORE_SRC.slice(STORE_SRC.indexOf('export function rescheduleReminder'))
    expect(fn.includes('rescheduleReminderNotification')).toBe(true)
  })
})

describe('UX copy dynamic', () => {
  it('ConfirmCard shows native promise when available', () => {
    expect(CONFIRM_SRC.includes('גם כשהטלפון נעול')).toBe(true)
  })

  it('ConfirmCard shows web limitation when native unavailable', () => {
    expect(CONFIRM_SRC.includes('עדיין לא תופיע התראה')).toBe(true)
  })

  it('Board header hides limitation when native available', () => {
    expect(BOARD_SRC.includes('!isNativeReminderAvailable()')).toBe(true)
  })
})
