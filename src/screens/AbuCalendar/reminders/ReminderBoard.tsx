import { useState, useEffect } from 'react'
import { isNativeReminderAvailable } from './reminderDelivery'
import {
  listAllReminders,
  markReminderDone,
  snoozeReminder,
  cancelReminder,
  rescheduleReminder,
} from './reminderStore'
import { categoryIcon, formatRecurrenceLabel, relativeTimeLabel } from './reminderFormat'
import type { Reminder } from './types'

const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'

interface Section {
  id: string
  label: string
  emoji: string
  reminders: Reminder[]
}

function buildSections(now: Date): Section[] {
  const all = listAllReminders()
  const p = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const nowMs = now.getTime()

  const due = all.filter(r => r.status === 'due' || (r.status === 'scheduled' && new Date(r.dueAt).getTime() <= nowMs))
  const todayLater = all.filter(r =>
    r.status === 'scheduled' &&
    r.dueAt.startsWith(today) &&
    new Date(r.dueAt).getTime() > nowMs,
  )
  const overdue = all.filter(r => r.status === 'overdue')
  const recurring = all.filter(r => !!r.recurrence && r.status !== 'cancelled' && r.status !== 'done')

  const sections: Section[] = []
  if (due.length > 0) sections.push({ id: 'now', label: 'עכשיו', emoji: '🔔', reminders: due })
  if (todayLater.length > 0) sections.push({ id: 'today', label: 'היום בהמשך', emoji: '📅', reminders: todayLater })
  if (overdue.length > 0) sections.push({ id: 'overdue', label: 'עבר זמנו', emoji: '⏰', reminders: overdue })
  if (recurring.length > 0) sections.push({ id: 'recurring', label: 'חוזרות', emoji: '🔁', reminders: recurring })
  return sections
}

export function ReminderBoard() {
  const [sections, setSections] = useState<Section[]>(() => buildSections(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setSections(buildSections(new Date()))
  }, [refreshKey])

  // Refresh board every 60s
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  function refresh() { setRefreshKey(k => k + 1) }

  if (sections.length === 0) return null

  return (
    <div
      data-testid="reminder-board"
      style={{
        margin: '12px 10px 0',
        borderRadius: 18,
        border: '1px solid rgba(201,168,76,0.14)',
        background: 'linear-gradient(180deg, rgba(255,250,240,0.025) 0%, rgba(201,168,76,0.010) 100%)',
        overflow: 'hidden',
        fontFamily: "'Heebo',sans-serif",
        direction: 'rtl',
      }}
    >
      <div style={{
        padding: '12px 16px 8px',
        borderBottom: '1px solid rgba(201,168,76,0.10)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>תזכורות</span>
        {!isNativeReminderAvailable() && (
          <span style={{ fontSize: 11, color: 'rgba(201,168,76,0.35)', fontWeight: 400 }}>כשהאפליקציה פתוחה</span>
        )}
      </div>

      {sections.map(section => (
        <div key={section.id} style={{ padding: '10px 0 4px' }}>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: section.id === 'overdue' ? 'rgba(233,121,67,0.70)' : 'rgba(201,168,76,0.50)',
            padding: '0 16px', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {section.emoji} {section.label}
          </div>

          {section.reminders.map(r => (
            <ReminderRow
              key={r.id}
              reminder={r}
              sectionId={section.id}
              now={new Date()}
              onDone={() => { markReminderDone(r.id); refresh() }}
              onSnooze={() => { snoozeReminder(r.id); refresh() }}
              onDelete={() => { cancelReminder(r.id); refresh() }}
              onReschedule={() => {
                const d = new Date(Date.now() + 60 * 60_000)
                const pd = (n: number) => String(n).padStart(2, '0')
                const dueAt = `${d.getFullYear()}-${pd(d.getMonth()+1)}-${pd(d.getDate())}T${pd(d.getHours())}:${pd(d.getMinutes())}:00`
                rescheduleReminder(r.id, dueAt, 'היום', d.toTimeString().slice(0, 5))
                refresh()
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface RowProps {
  reminder: Reminder
  sectionId: string
  now: Date
  onDone: () => void
  onSnooze: () => void
  onDelete: () => void
  onReschedule: () => void
}

function ReminderRow({ reminder: r, sectionId, now, onDone, onSnooze, onDelete, onReschedule }: RowProps) {
  const icon = categoryIcon(r.category)
  const isOverdue = sectionId === 'overdue'
  const isRecurring = sectionId === 'recurring'
  const isNow = sectionId === 'now'

  const timeLabel = isRecurring
    ? formatRecurrenceLabel(r)
    : isNow
    ? relativeTimeLabel(r.dueAt, now)
    : r.displayTimeLabel ?? r.displayDateLabel

  return (
    <div
      data-testid={`reminder-row-${r.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: isOverdue ? '#E97943' : isNow ? GOLD : CREAM,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {r.title}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(201,168,76,0.50)', marginTop: 1 }}>
          {timeLabel}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {(isNow || isOverdue) && (
          <button
            type="button"
            onClick={onDone}
            aria-label="בוצע"
            style={miniBtn('#1a6b3a')}
          >✓</button>
        )}
        {isNow && (
          <button
            type="button"
            onClick={onSnooze}
            aria-label={`עוד ${r.alertPolicy.snoozeMinutes} דקות`}
            style={miniBtn('rgba(201,168,76,0.15)')}
          >⏱</button>
        )}
        {isOverdue && (
          <button
            type="button"
            onClick={onReschedule}
            aria-label="להזכיר שוב"
            style={miniBtn('rgba(201,168,76,0.15)')}
          >↺</button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="מחיקה"
          style={miniBtn('rgba(180,60,60,0.20)')}
        >×</button>
      </div>
    </div>
  )
}

function miniBtn(bg: string): React.CSSProperties {
  return {
    width: 36, height: 36, borderRadius: 10,
    background: bg, border: 'none',
    color: CREAM, fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Heebo',sans-serif",
    flexShrink: 0,
  }
}
