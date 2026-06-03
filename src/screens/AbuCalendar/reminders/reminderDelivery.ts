/*
 * Reminder delivery abstraction — web fallback + native local notifications.
 *
 * Web tier: open-app only (setInterval polling, popup + sound).
 * Native tier: Capacitor LocalNotifications (fires on lock screen, after
 *   app kill, after reboot). Added as a PARALLEL channel — web tier
 *   continues to work for the in-app popup experience.
 *
 * The native tier is only active when:
 *   1. Capacitor is installed and initialized
 *   2. The app is running inside a Capacitor WebView (not Safari)
 *   3. Notification permission has been granted
 *
 * If native is unavailable, all schedule/cancel calls are no-ops.
 * The web tier handles everything. No crash, no error.
 */

import type { Reminder } from './types'

// ─── Native availability detection ──────────────────────────────────

let _nativeAvailable: boolean | null = null
let _capacitorLocalNotifications: CapacitorLocalNotificationsAPI | null = null

interface CapacitorLocalNotificationsAPI {
  schedule(options: { notifications: Array<{ id: number; title: string; body: string; schedule: { at: Date }; sound?: string; channelId?: string }> }): Promise<void>
  cancel(options: { notifications: Array<{ id: number }> }): Promise<void>
  checkPermissions(): Promise<{ display: string }>
  requestPermissions(): Promise<{ display: string }>
}

/**
 * Check if native local notifications are available.
 * Returns true only inside a Capacitor native app with the plugin installed.
 * Safe to call on web — always returns false.
 */
export function isNativeReminderAvailable(): boolean {
  if (_nativeAvailable !== null) return _nativeAvailable

  try {
    // Capacitor exposes itself on window when running in native WebView
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor
    if (!cap?.isNativePlatform?.()) {
      _nativeAvailable = false
      return false
    }
    // Check if LocalNotifications plugin is registered
    const ln = cap.Plugins?.['LocalNotifications'] as CapacitorLocalNotificationsAPI | undefined
    if (ln && typeof ln.schedule === 'function') {
      _capacitorLocalNotifications = ln
      _nativeAvailable = true
      return true
    }
    _nativeAvailable = false
    return false
  } catch {
    _nativeAvailable = false
    return false
  }
}

// ─── Reminder ID → notification ID mapping ──────────────────────────
// Capacitor uses numeric IDs. We hash the reminder string ID to a number.

function reminderIdToNotificationId(reminderId: string): number {
  let hash = 0
  for (let i = 0; i < reminderId.length; i++) {
    hash = ((hash << 5) - hash + reminderId.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Schedule a native local notification for a reminder.
 * No-op if native is unavailable. Never throws.
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  if (!isNativeReminderAvailable() || !_capacitorLocalNotifications) return false

  try {
    const dueDate = new Date(reminder.dueAt)
    if (dueDate.getTime() <= Date.now()) return false // already past

    await _capacitorLocalNotifications.schedule({
      notifications: [{
        id: reminderIdToNotificationId(reminder.id),
        title: 'תזכורת',
        body: reminder.title,
        schedule: { at: dueDate },
        sound: 'default',
      }],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Cancel a native local notification for a reminder.
 * No-op if native is unavailable. Never throws.
 */
export async function cancelReminderNotification(reminderId: string): Promise<boolean> {
  if (!isNativeReminderAvailable() || !_capacitorLocalNotifications) return false

  try {
    await _capacitorLocalNotifications.cancel({
      notifications: [{ id: reminderIdToNotificationId(reminderId) }],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Reschedule a native notification (cancel old + schedule new).
 * No-op if native is unavailable. Never throws.
 */
export async function rescheduleReminderNotification(reminder: Reminder): Promise<boolean> {
  await cancelReminderNotification(reminder.id)
  return scheduleReminderNotification(reminder)
}

/**
 * Request notification permission on native platform.
 * Returns true if granted. No-op on web (returns false).
 */
export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!isNativeReminderAvailable() || !_capacitorLocalNotifications) return false

  try {
    const result = await _capacitorLocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}
