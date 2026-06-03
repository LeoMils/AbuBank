import type { Reminder, ReminderCategory, ReminderStatus } from './types'

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
    localStorage.setItem(STORE_KEY, json)
    // Round-trip verify: read back and check length matches
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
  return updateReminder(id, { status: 'done', confirmedAt: nowISO() })
}

export function snoozeReminder(id: string, minutes = 10): Reminder | null {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString()
  return updateReminder(id, { status: 'snoozed', snoozedUntil })
}

export function cancelReminder(id: string): Reminder | null {
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
      return r.snoozedUntil ? new Date(r.snoozedUntil).getTime() <= now : false
    }
    if (r.status !== 'scheduled') return false
    return new Date(r.dueAt).getTime() <= now
  })
}

export function listTodayReminders(): Reminder[] {
  const today = new Date().toISOString().slice(0, 10)
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
  return item
}
