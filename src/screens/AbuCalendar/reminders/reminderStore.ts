import type { Reminder, ReminderCategory, ReminderStatus } from './types'
import { scheduleReminderNotification, cancelReminderNotification, rescheduleReminderNotification } from './reminderDelivery'
import { durable } from '../../../services/durableStore'

const STORE_KEY = 'abu_reminders_v1'

function readStore(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Reminder[]
  } catch {
    return []
  }
}

/** Write reminders to localStorage. Returns false if write failed
 *  (quota exceeded, private mode, etc.) — caller MUST check. */
function writeStore(items: Reminder[]): boolean {
  try {
    const json = JSON.stringify(items)
    // Durable write-through: localStorage mirror (sync) + IndexedDB (durable).
    durable.setString(STORE_KEY, json)
    // Round-trip verify against the synchronous mirror.
    const readback = localStorage.getItem(STORE_KEY)
    if (!readback || readback.length !== json.length) return false
    return true
  } catch {
    return false
  }
}

function nowISO(): string {
  return new Date().toISOString()
}

function generateId(): string {
  return `rem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createDefaultAlertPolicy(): Reminder['alertPolicy'] {
  return {
    sound: true,
    voice: true,
    repeatUntilConfirmed: false,
    snoozeMinutes: 10,
    remindBeforeMinutes: 0,
    maxRepeats: 3,
  }
}

export function createReminder(
  fields: Omit<Reminder, 'id' | 'kind' | 'status' | 'alertPolicy' | 'createdAt' | 'updatedAt'> & {
    alertPolicy?: Reminder['alertPolicy']
  },
): { reminder: Reminder; saved: boolean } {
  const reminder: Reminder = {
    ...fields,
    id: generateId(),
    kind: 'reminder',
    status: 'scheduled',
    alertPolicy: fields.alertPolicy ?? createDefaultAlertPolicy(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  const items = readStore()
  items.push(reminder)
  const saved = writeStore(items)
  // Schedule native notification (no-op on web, never throws)
  void scheduleReminderNotification(reminder)
  return { reminder, saved }
}

export function updateReminder(id: string, patch: Partial<Omit<Reminder, 'id' | 'kind'>>): Reminder | null {
  const items = readStore()
  const idx = items.findIndex(r => r.id === id)
  if (idx === -1) return null
  const updated = { ...items[idx]!, ...patch, updatedAt: nowISO() }
  items[idx] = updated
  writeStore(items)
  return updated
}

export function deleteReminder(id: string): boolean {
  const items = readStore()
  const next = items.filter(r => r.id !== id)
  if (next.length === items.length) return false
  writeStore(next)
  return true
}

export function markReminderDone(id: string): Reminder | null {
  void cancelReminderNotification(id)
  return updateReminder(id, { status: 'done', confirmedAt: nowISO() })
}

export function snoozeReminder(id: string, minutes = 10): Reminder | null {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString()
  const updated = updateReminder(id, { status: 'snoozed', snoozedUntil })
  // Reschedule native notification to snooze time
  if (updated) void rescheduleReminderNotification({ ...updated, dueAt: snoozedUntil })
  return updated
}

export function cancelReminder(id: string): Reminder | null {
  void cancelReminderNotification(id)
  return updateReminder(id, { status: 'cancelled' })
}

export function listAllReminders(): Reminder[] {
  return readStore()
}

export function listScheduledReminders(): Reminder[] {
  return readStore().filter(r => r.status === 'scheduled' || r.status === 'snoozed')
}

export function listDueReminders(): Reminder[] {
  const now = Date.now()
  return readStore().filter(r => {
    if (r.status === 'snoozed') {
      if (!r.snoozedUntil) return false
      const ms = new Date(r.snoozedUntil).getTime()
      return !isNaN(ms) && ms <= now
    }
    if (r.status !== 'scheduled') return false
    const ms = new Date(r.dueAt).getTime()
    return !isNaN(ms) && ms <= now
  })
}

export function listTodayReminders(): Reminder[] {
  // dueAt is stored in local time (no Z suffix), so compare against local date.
  // UTC-based date extraction would give the wrong day for Israel (UTC+3)
  // where midnight–02:59 local is still the previous day in UTC.
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return readStore().filter(r =>
    (r.status === 'scheduled' || r.status === 'snoozed') &&
    r.dueAt.startsWith(today),
  )
}

export function listOverdueReminders(): Reminder[] {
  return readStore().filter(r => r.status === 'overdue')
}

export function listRecurringReminders(): Reminder[] {
  return readStore().filter(r => !!r.recurrence && r.status !== 'cancelled')
}

export function normalizeReminderTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

export function markOverdue(id: string): Reminder | null {
  return updateReminder(id, { status: 'overdue' })
}

export function rescheduleReminder(id: string, dueAt: string, displayDateLabel: string, displayTimeLabel: string): Reminder | null {
  const items = readStore()
  const idx = items.findIndex(r => r.id === id)
  if (idx === -1) return null
  const item = { ...items[idx]! }
  item.dueAt = dueAt
  item.displayDateLabel = displayDateLabel
  item.displayTimeLabel = displayTimeLabel
  item.status = 'scheduled'
  item.updatedAt = nowISO()
  delete item.snoozedUntil
  items[idx] = item
  writeStore(items)
  // Reschedule native notification to new dueAt
  void rescheduleReminderNotification(item)
  return item
}
