import type { Reminder, ReminderCategory } from './types'

const CATEGORY_ICONS: Record<ReminderCategory, string> = {
  medication: '💊',
  call: '📞',
  home: '🏠',
  appointment_prep: '📋',
  water: '💧',
  general: '🔔',
}

export function categoryIcon(category: ReminderCategory): string {
  return CATEGORY_ICONS[category]
}

export function formatDueLabel(reminder: Reminder): string {
  return `${reminder.displayDateLabel} · ${reminder.displayTimeLabel}`
}

export function formatRecurrenceLabel(reminder: Reminder): string {
  if (!reminder.recurrence) return ''
  const { frequency, daysOfWeek, time } = reminder.recurrence
  if (frequency === 'daily') return `כל יום · ${time}`
  if (frequency === 'weekly' && daysOfWeek?.length) {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const days = daysOfWeek.map(d => dayNames[d] ?? '').join(', ')
    return `כל שבוע · יום ${days} · ${time}`
  }
  return `חוזר · ${time}`
}

export function relativeTimeLabel(dueAt: string, now: Date): string {
  const due = new Date(dueAt)
  const diffMs = due.getTime() - now.getTime()
  if (diffMs < 0) return 'עבר זמנו'
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'עכשיו'
  if (diffMin < 60) return `בעוד ${diffMin} דקות`
  const diffHr = Math.floor(diffMin / 60)
  const remainMin = diffMin % 60
  if (remainMin === 0) {
    if (diffHr === 1) return 'בעוד שעה'
    if (diffHr === 2) return 'בעוד שעתיים'
    return `בעוד ${diffHr} שעות`
  }
  return `בעוד ${diffHr}:${String(remainMin).padStart(2, '0')} שעות`
}

export function statusLabel(status: Reminder['status']): string {
  switch (status) {
    case 'scheduled': return 'מתוכנן'
    case 'due': return 'מגיע עכשיו'
    case 'snoozed': return 'נדחה'
    case 'done': return 'בוצע'
    case 'overdue': return 'עבר זמנו'
    case 'cancelled': return 'בוטל'
  }
}
