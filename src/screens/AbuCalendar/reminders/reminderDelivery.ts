/*
 * Reminder delivery — web fallback + Capacitor native local notifications.
 *
 * Web tier: open-app only (setInterval polling, popup + sound).
 * Native tier: Capacitor LocalNotifications → fires on lock screen,
 *   after app kill, after reboot.
 *
 * All functions are safe to call on web — they return false and never throw.
 */

import type { Reminder } from './types'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// ─── Native availability detection ──────────────────────────────────

let _nativeChecked = false
let _nativeAvailable = false

/**
 * Check if native local notifications are available.
 * Returns true only inside a Capacitor native app.
 * Safe to call on web — always returns false.
 */
export function isNativeReminderAvailable(): boolean {
  if (_nativeChecked) return _nativeAvailable
  _nativeChecked = true
  try {
    _nativeAvailable = Capacitor.isNativePlatform()
  } catch {
    _nativeAvailable = false
  }
  return _nativeAvailable
}

// ─── Reminder ID → notification ID mapping ──────────────────────────
// Capacitor uses numeric IDs. Hash the string ID to a positive integer.

function reminderIdToNotificationId(reminderId: string): number {
  let hash = 0
  for (let i = 0; i < reminderId.length; i++) {
    hash = ((hash << 5) - hash + reminderId.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1 // never 0
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Request notification permission. Call once on app startup or before
 * first reminder save. Returns true if granted.
 * No-op on web (returns false).
 */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!isNativeReminderAvailable()) return false
  try {
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'granted') return true
    const req = await LocalNotifications.requestPermissions()
    return req.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule a native local notification for a reminder.
 * No-op if native unavailable or dueAt is in the past. Never throws.
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  if (!isNativeReminderAvailable()) return false
  try {
    const dueDate = new Date(reminder.dueAt)
    if (dueDate.getTime() <= Date.now()) return false

    await LocalNotifications.schedule({
      notifications: [{
        id: reminderIdToNotificationId(reminder.id),
        title: 'תזכורת',
        body: reminder.title,
        schedule: { at: dueDate },
        sound: 'default',
        actionTypeId: 'REMINDER_ACTION',
        extra: { reminderId: reminder.id },
      }],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Cancel a native local notification. Never throws.
 */
export async function cancelReminderNotification(reminderId: string): Promise<boolean> {
  if (!isNativeReminderAvailable()) return false
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: reminderIdToNotificationId(reminderId) }],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Reschedule: cancel old + schedule new. Never throws.
 */
export async function rescheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  await cancelReminderNotification(reminder.id)
  return scheduleReminderNotification(reminder)
}
