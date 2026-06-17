/*
 * Reminder delivery — web fallback + Capacitor native local notifications.
 *
 * Web tier: open-app only (setInterval polling, popup + sound).
 * Native tier: Capacitor LocalNotifications → fires on lock screen,
 *   after app kill, after reboot. Includes follow-up re-fire notifications
 *   for medication safety.
 *
 * All functions are safe to call on web — they return false and never throw.
 */

import type { Reminder } from './types'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// ─── Re-fire intervals (minutes after dueAt) ────────────────────────
// Medication: urgent — 15/30/45 min follow-ups
// Regular: gentle — 30/60/90 min follow-ups
const REFIRE_OFFSETS_MEDICATION = [15, 30, 45]
const REFIRE_OFFSETS_DEFAULT = [30, 60, 90]

// ─── Native availability detection ──────────────────────────────────

let _nativeChecked = false
let _nativeAvailable = false

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
// Base ID from string hash. Follow-ups use baseId + 1, +2, +3.

function reminderIdToNotificationId(reminderId: string): number {
  let hash = 0
  for (let i = 0; i < reminderId.length; i++) {
    hash = ((hash << 5) - hash + reminderId.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) || 1) * 10 // ×10 leaves room for +1,+2,+3 offsets
}

/** All notification IDs for a reminder: primary + follow-ups. */
function allNotificationIds(reminderId: string): number[] {
  const base = reminderIdToNotificationId(reminderId)
  return [base, base + 1, base + 2, base + 3]
}

// ─── Public API ─────────────────────────────────────────────────────

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
 * Schedule native notifications: primary + follow-up re-fires.
 * Medication: +15, +30, +45 min. Others: +30, +60, +90 min.
 * Follow-up body includes urgency prefix.
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  if (!isNativeReminderAvailable()) return false
  try {
    const dueMs = new Date(reminder.dueAt).getTime()
    const now = Date.now()
    if (dueMs <= now) return false

    const baseId = reminderIdToNotificationId(reminder.id)
    const offsets = reminder.category === 'medication' ? REFIRE_OFFSETS_MEDICATION : REFIRE_OFFSETS_DEFAULT

    const notifications: Array<{
      id: number; title: string; body: string;
      schedule: { at: Date }; sound: string;
      actionTypeId: string; extra: Record<string, string>
    }> = []

    // Primary notification
    notifications.push({
      id: baseId,
      title: 'תזכורת',
      body: reminder.title,
      schedule: { at: new Date(dueMs) },
      sound: 'default',
      actionTypeId: 'REMINDER_ACTION',
      extra: { reminderId: reminder.id },
    })

    // Follow-up re-fire notifications
    for (let i = 0; i < offsets.length; i++) {
      const refireMs = dueMs + offsets[i]! * 60_000
      if (refireMs <= now) continue
      const urgency = reminder.category === 'medication'
        ? 'עדיין לא סומן — חשוב לקחת'
        : 'עדיין לא בוצע'
      notifications.push({
        id: baseId + i + 1,
        title: 'תזכורת',
        body: `${urgency}: ${reminder.title}`,
        schedule: { at: new Date(refireMs) },
        sound: 'default',
        actionTypeId: 'REMINDER_ACTION',
        extra: { reminderId: reminder.id },
      })
    }

    await LocalNotifications.schedule({ notifications })
    return true
  } catch {
    return false
  }
}

/**
 * Cancel ALL native notifications for a reminder (primary + follow-ups).
 */
export async function cancelReminderNotification(reminderId: string): Promise<boolean> {
  if (!isNativeReminderAvailable()) return false
  try {
    const ids = allNotificationIds(reminderId)
    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id })),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Reschedule: cancel all old + schedule new (primary + follow-ups).
 */
export async function rescheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  await cancelReminderNotification(reminder.id)
  return scheduleReminderNotification(reminder)
}

// ─── Notification tap handler ───────────────────────────────────────

type NotificationTapCallback = (reminderId: string) => void
let _tapCallback: NotificationTapCallback | null = null
let _listenerRegistered = false

/**
 * Register a callback for when the user taps a reminder notification.
 * Call once at app startup. The callback receives the reminderId from
 * the notification payload. No-op on web.
 */
export function registerNotificationTapHandler(callback: NotificationTapCallback): void {
  _tapCallback = callback
  if (_listenerRegistered || !isNativeReminderAvailable()) return
  _listenerRegistered = true
  try {
    void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const reminderId = action.notification?.extra?.['reminderId'] as string | undefined
      if (reminderId && _tapCallback) {
        _tapCallback(reminderId)
      }
    })
  } catch {
    // Listener registration failed — taps won't navigate, but no crash
  }
}
