import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createReminder, updateReminder, deleteReminder, markReminderDone,
  snoozeReminder, cancelReminder, listAllReminders, listScheduledReminders,
  listDueReminders, listTodayReminders, listOverdueReminders, listRecurringReminders,
  createDefaultAlertPolicy, markOverdue, rescheduleReminder,
} from './reminderStore'
import type { Reminder } from './types'

// In-memory localStorage mock for Node test environment
const _ls: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => _ls[k] ?? null,
  setItem: (k: string, v: string) => { _ls[k] = v },
  removeItem: (k: string) => { delete _ls[k] },
  clear: () => { Object.keys(_ls).forEach(k => delete _ls[k]) },
})

// Reset store between tests
beforeEach(() => {
  localStorage.clear()
})

function makeReminder(overrides: Partial<Omit<Reminder, 'id' | 'kind' | 'status' | 'createdAt' | 'updatedAt'>> = {}): Reminder {
  const tomorrow = new Date(Date.now() + 86_400_000)
  const { reminder } = createReminder({
    category: 'general',
    title: 'בדיקה',
    dueAt: tomorrow.toISOString(),
    displayDateLabel: 'מחר',
    displayTimeLabel: '10:00',
    ...overrides,
  })
  return reminder
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────
describe('reminderStore — create', () => {
  it('creates a reminder with correct kind and status', () => {
    const r = makeReminder()
    expect(r.kind).toBe('reminder')
    expect(r.status).toBe('scheduled')
    expect(r.id).toMatch(/^rem_/)
  })

  it('persists to localStorage under abu_reminders_v1', () => {
    makeReminder({ title: 'לקחת כדור' })
    const raw = localStorage.getItem('abu_reminders_v1')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed[0].title).toBe('לקחת כדור')
  })

  it('generates unique ids', () => {
    const a = makeReminder()
    const b = makeReminder()
    expect(a.id).not.toBe(b.id)
  })

  it('uses default alert policy when not specified', () => {
    const r = makeReminder()
    expect(r.alertPolicy.sound).toBe(true)
    expect(r.alertPolicy.snoozeMinutes).toBe(10)
  })
})

describe('reminderStore — update', () => {
  it('updates title', () => {
    const r = makeReminder({ title: 'ישן' })
    const updated = updateReminder(r.id, { title: 'חדש' })
    expect(updated?.title).toBe('חדש')
    // Verify persisted
    const all = listAllReminders()
    expect(all.find(x => x.id === r.id)?.title).toBe('חדש')
  })

  it('returns null for unknown id', () => {
    expect(updateReminder('nonexistent', { title: 'x' })).toBeNull()
  })

  it('updates updatedAt after a tick', async () => {
    const r = makeReminder()
    const before = r.updatedAt
    await new Promise(res => setTimeout(res, 2))
    const updated = updateReminder(r.id, { title: 'new' })
    expect(updated!.updatedAt).not.toBe(before)
  })
})

describe('reminderStore — delete', () => {
  it('deletes existing reminder', () => {
    const r = makeReminder()
    expect(deleteReminder(r.id)).toBe(true)
    expect(listAllReminders().find(x => x.id === r.id)).toBeUndefined()
  })

  it('returns false for unknown id', () => {
    expect(deleteReminder('nonexistent')).toBe(false)
  })
})

// ─── Status transitions ───────────────────────────────────────────────────────
describe('reminderStore — status transitions', () => {
  it('markReminderDone → status=done, confirmedAt set', () => {
    const r = makeReminder()
    const done = markReminderDone(r.id)
    expect(done?.status).toBe('done')
    expect(done?.confirmedAt).toBeDefined()
  })

  it('snoozeReminder → status=snoozed, snoozedUntil set', () => {
    const r = makeReminder()
    const snoozed = snoozeReminder(r.id, 10)
    expect(snoozed?.status).toBe('snoozed')
    expect(snoozed?.snoozedUntil).toBeDefined()
    const until = new Date(snoozed!.snoozedUntil!).getTime()
    expect(until).toBeGreaterThan(Date.now())
  })

  it('cancelReminder → status=cancelled', () => {
    const r = makeReminder()
    const cancelled = cancelReminder(r.id)
    expect(cancelled?.status).toBe('cancelled')
  })

  it('markOverdue → status=overdue', () => {
    const r = makeReminder()
    const overdue = markOverdue(r.id)
    expect(overdue?.status).toBe('overdue')
  })
})

// ─── List queries ─────────────────────────────────────────────────────────────
describe('reminderStore — list queries', () => {
  it('listAllReminders returns all', () => {
    makeReminder({ title: 'a' })
    makeReminder({ title: 'b' })
    expect(listAllReminders().length).toBe(2)
  })

  it('listScheduledReminders excludes done/cancelled', () => {
    const r1 = makeReminder()
    const r2 = makeReminder()
    markReminderDone(r1.id)
    cancelReminder(r2.id)
    const r3 = makeReminder()
    const scheduled = listScheduledReminders()
    expect(scheduled.find(x => x.id === r3.id)).toBeDefined()
    expect(scheduled.find(x => x.id === r1.id)).toBeUndefined()
    expect(scheduled.find(x => x.id === r2.id)).toBeUndefined()
  })

  it('listDueReminders returns overdue-now', () => {
    const past = new Date(Date.now() - 5000).toISOString()
    createReminder({
      category: 'general', title: 'עבר', dueAt: past,
      displayDateLabel: 'היום', displayTimeLabel: '10:00',
      alertPolicy: createDefaultAlertPolicy(),
    })
    const due = listDueReminders()
    expect(due.length).toBeGreaterThan(0)
    expect(due[0]!.title).toBe('עבר')
  })

  it('listDueReminders excludes future', () => {
    makeReminder()  // tomorrow
    expect(listDueReminders().length).toBe(0)
  })

  it('listTodayReminders returns only today scheduled', () => {
    const today = new Date()
    today.setHours(23, 59, 59, 0)
    createReminder({
      category: 'general', title: 'היום', dueAt: today.toISOString(),
      displayDateLabel: 'היום', displayTimeLabel: '23:59',
      alertPolicy: createDefaultAlertPolicy(),
    })
    makeReminder()  // tomorrow
    const todayList = listTodayReminders()
    expect(todayList.some(r => r.title === 'היום')).toBe(true)
    expect(todayList.some(r => r.title === 'בדיקה')).toBe(false)
  })

  it('listOverdueReminders returns overdue-status only', () => {
    const r = makeReminder()
    markOverdue(r.id)
    expect(listOverdueReminders()).toHaveLength(1)
  })

  it('listRecurringReminders returns recurring non-cancelled', () => {
    const r = makeReminder({
      recurrence: { frequency: 'daily', time: '09:00' },
    })
    expect(listRecurringReminders()).toHaveLength(1)
    cancelReminder(r.id)
    expect(listRecurringReminders()).toHaveLength(0)
  })
})

// ─── Default alert policy ─────────────────────────────────────────────────────
describe('createDefaultAlertPolicy', () => {
  it('has sound=true, voice=true, snoozeMinutes=10', () => {
    const p = createDefaultAlertPolicy()
    expect(p.sound).toBe(true)
    expect(p.voice).toBe(true)
    expect(p.snoozeMinutes).toBe(10)
  })
})

// ─── Reschedule ───────────────────────────────────────────────────────────────
describe('rescheduleReminder', () => {
  it('sets new dueAt and resets to scheduled', () => {
    const r = makeReminder()
    markOverdue(r.id)
    const newDue = new Date(Date.now() + 60 * 60_000).toISOString()
    const updated = rescheduleReminder(r.id, newDue, 'היום', '15:00')
    expect(updated?.status).toBe('scheduled')
    expect(updated?.dueAt).toBe(newDue)
  })
})

// ─── Storage safety ───────────────────────────────────────────────────────────
describe('reminderStore — storage safety', () => {
  it('corrupt localStorage does not throw', () => {
    localStorage.setItem('abu_reminders_v1', '{not_json}')
    expect(() => listAllReminders()).not.toThrow()
    expect(listAllReminders()).toEqual([])
  })

  it('empty localStorage returns []', () => {
    expect(listAllReminders()).toEqual([])
  })

  it('stored reminders survive multiple read cycles', () => {
    makeReminder({ title: 'persist' })
    const a = listAllReminders()
    const b = listAllReminders()
    expect(a[0]?.title).toBe(b[0]?.title)
  })
})
