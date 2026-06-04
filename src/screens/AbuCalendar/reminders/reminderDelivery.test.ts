/*
 * Reminder delivery abstraction tests.
 * Verifies web fallback behavior + native integration points.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  isNativeReminderAvailable,
  scheduleReminderNotification,
  cancelReminderNotification,
  rescheduleReminderNotification,
} from './reminderDelivery'
import type { Reminder } from './types'

const STORE_SRC = fs.readFileSync(path.resolve(__dirname, 'reminderStore.ts'), 'utf8')
const DELIVERY_SRC = fs.readFileSync(path.resolve(__dirname, 'reminderDelivery.ts'), 'utf8')
const CONFIRM_SRC = fs.readFileSync(path.resolve(__dirname, 'ReminderConfirmCard.tsx'), 'utf8')
const BOARD_SRC = fs.readFileSync(path.resolve(__dirname, 'ReminderBoard.tsx'), 'utf8')

function makeReminder(): Reminder {
  return {
    id: 'rem_test_1', kind: 'reminder', category: 'medication',
    title: 'לקחת כדור', dueAt: new Date(Date.now() + 3600000).toISOString(),
    displayDateLabel: 'היום', displayTimeLabel: '20:00',
    alertPolicy: { sound: true, voice: true, repeatUntilConfirmed: false, snoozeMinutes: 10 },
    status: 'scheduled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}

describe('reminderDelivery — web fallback', () => {
  it('isNativeReminderAvailable returns false on web (no Capacitor)', () => {
    expect(isNativeReminderAvailable()).toBe(false)
  })

  it('scheduleReminderNotification is no-op on web (returns false)', async () => {
    const result = await scheduleReminderNotification(makeReminder())
    expect(result).toBe(false)
  })

  it('cancelReminderNotification is no-op on web (returns false)', async () => {
    const result = await cancelReminderNotification('rem_test_1')
    expect(result).toBe(false)
  })

  it('rescheduleReminderNotification is no-op on web (returns false)', async () => {
    const result = await rescheduleReminderNotification(makeReminder())
    expect(result).toBe(false)
  })

  it('no function throws on web', async () => {
    // All functions must be safe to call without Capacitor
    await expect(scheduleReminderNotification(makeReminder())).resolves.not.toThrow()
    await expect(cancelReminderNotification('x')).resolves.not.toThrow()
    await expect(rescheduleReminderNotification(makeReminder())).resolves.not.toThrow()
  })
})

describe('reminderDelivery — native integration wiring', () => {
  it('reminderStore imports and calls scheduleReminderNotification on create', () => {
    expect(STORE_SRC.includes("import { scheduleReminderNotification")).toBe(true)
    expect(STORE_SRC.includes('void scheduleReminderNotification(reminder)')).toBe(true)
  })

  it('reminderStore calls cancelReminderNotification on done', () => {
    expect(STORE_SRC.includes('void cancelReminderNotification(id)')).toBe(true)
  })

  it('reminderStore calls cancelReminderNotification on cancel', () => {
    // cancelReminder function body
    const cancelFn = STORE_SRC.slice(STORE_SRC.indexOf('export function cancelReminder'))
    expect(cancelFn.includes('cancelReminderNotification')).toBe(true)
  })

  it('reminderStore calls rescheduleReminderNotification on snooze', () => {
    const snoozeFn = STORE_SRC.slice(STORE_SRC.indexOf('export function snoozeReminder'))
    expect(snoozeFn.includes('rescheduleReminderNotification')).toBe(true)
  })

  it('reminderStore calls rescheduleReminderNotification on reschedule', () => {
    const reschedFn = STORE_SRC.slice(STORE_SRC.indexOf('export function rescheduleReminder'))
    expect(reschedFn.includes('rescheduleReminderNotification')).toBe(true)
  })
})

describe('reminderDelivery — UX copy is dynamic', () => {
  it('ConfirmCard imports isNativeReminderAvailable', () => {
    expect(CONFIRM_SRC.includes("import { isNativeReminderAvailable }")).toBe(true)
  })

  it('ConfirmCard shows native promise when available', () => {
    expect(CONFIRM_SRC.includes('גם כשהטלפון נעול')).toBe(true)
  })

  it('ConfirmCard shows web limitation when native unavailable', () => {
    expect(CONFIRM_SRC.includes('כשהאפליקציה פתוחה על המסך')).toBe(true)
    expect(CONFIRM_SRC.includes('עדיין לא תופיע התראה')).toBe(true)
  })

  it('Board header hides limitation suffix when native available', () => {
    expect(BOARD_SRC.includes('!isNativeReminderAvailable()')).toBe(true)
  })
})

describe('reminderDelivery — Capacitor detection', () => {
  it('checks window.Capacitor.isNativePlatform()', () => {
    expect(DELIVERY_SRC.includes('isNativePlatform')).toBe(true)
  })

  it('checks Capacitor.Plugins.LocalNotifications', () => {
    expect(DELIVERY_SRC.includes('LocalNotifications')).toBe(true)
  })

  it('uses numeric notification IDs (hash from string ID)', () => {
    expect(DELIVERY_SRC.includes('reminderIdToNotificationId')).toBe(true)
  })
})
