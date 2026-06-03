import { useState, useEffect, useCallback } from 'react'
import {
  listDueReminders,
  markReminderDone,
  snoozeReminder,
  cancelReminder,
  markOverdue,
  listAllReminders,
  rescheduleReminder,
} from './reminderStore'
import { playReminderBeep, speakReminder } from './reminderSound'
import { categoryIcon } from './reminderFormat'
import type { Reminder } from './types'

const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'
const CHECK_INTERVAL_MS = 30_000
const OVERDUE_THRESHOLD_MS = 2 * 60 * 60 * 1000  // 2 hours

interface Props {
  onReminderDue?: (reminder: Reminder) => void
}

export function ReminderDueEngine({ onReminderDue }: Props) {
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  // Track which reminders we've shown the popup for in this session.
  // Prevents marking overdue before the user ever sees the popup.
  const [firedIds] = useState(() => new Set<string>())

  const checkDue = useCallback(() => {
    const now = Date.now()

    // Transition overdue: only mark overdue if we already showed the
    // popup for this reminder in this session. Otherwise let the due
    // popup fire first so the user is always notified at least once.
    const allReminders = listAllReminders()
    for (const r of allReminders) {
      if (r.status === 'scheduled') {
        const dueMs = new Date(r.dueAt).getTime()
        if (dueMs < now - OVERDUE_THRESHOLD_MS && firedIds.has(r.id)) {
          markOverdue(r.id)
        }
      }
      // Snoozed: check if snooze expired
      if (r.status === 'snoozed' && r.snoozedUntil) {
        if (new Date(r.snoozedUntil).getTime() <= now) {
          rescheduleReminder(r.id, r.dueAt, r.displayDateLabel, r.displayTimeLabel)
        }
      }
    }

    const due = listDueReminders()
    if (due.length > 0) {
      setDueReminders(due)
      setCurrentIdx(0)
      // Mark all as fired so they can transition to overdue next cycle
      for (const r of due) firedIds.add(r.id)
      // Sound + TTS for first due reminder
      const first = due[0]!
      playReminderBeep()
      if (first.alertPolicy.voice) {
        speakReminder(`תזכורת: ${first.title}`)
      }
      onReminderDue?.(first)
    }
  }, [onReminderDue, firedIds])

  useEffect(() => {
    checkDue()
    const interval = setInterval(checkDue, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [checkDue])

  const current = dueReminders[currentIdx] ?? null

  if (!current) return null

  function handleDone() {
    if (!current) return
    // Recurring reminders: schedule next occurrence instead of permanent done.
    if (current.recurrence) {
      const rec = current.recurrence
      const time = rec.time || current.displayTimeLabel || '09:00'
      const [h, m] = time.split(':').map(Number)
      const now = new Date()
      const next = new Date(now)
      if (rec.frequency === 'daily') {
        // Next day at the same time
        next.setDate(next.getDate() + 1)
        next.setHours(h ?? 9, m ?? 0, 0, 0)
      } else if (rec.frequency === 'weekly' && rec.daysOfWeek?.length) {
        const target = rec.daysOfWeek[0]!
        const cur = now.getDay()
        let diff = (target - cur + 7) % 7
        if (diff === 0) diff = 7
        next.setDate(next.getDate() + diff)
        next.setHours(h ?? 9, m ?? 0, 0, 0)
      } else {
        // Default weekly: +7 days
        next.setDate(next.getDate() + 7)
        next.setHours(h ?? 9, m ?? 0, 0, 0)
      }
      const pad = (n: number) => String(n).padStart(2, '0')
      const nextDueAt = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}:00`
      const nextDateLabel = rec.frequency === 'daily' ? 'כל יום' : 'כל שבוע'
      rescheduleReminder(current.id, nextDueAt, nextDateLabel, time)
    } else {
      markReminderDone(current.id)
    }
    const remaining = dueReminders.filter(r => r.id !== current.id)
    setDueReminders(remaining)
    setCurrentIdx(0)
  }

  function handleSnooze() {
    if (!current) return
    snoozeReminder(current.id, current.alertPolicy.snoozeMinutes)
    const next = dueReminders.filter(r => r.id !== current.id)
    setDueReminders(next)
    setCurrentIdx(0)
  }

  function handleDelete() {
    if (!current) return
    cancelReminder(current.id)
    const next = dueReminders.filter(r => r.id !== current.id)
    setDueReminders(next)
    setCurrentIdx(0)
  }

  const icon = categoryIcon(current.category)

  return (
    <div
      data-testid="reminder-due-popup"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(3,6,16,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
        fontFamily: "'Heebo',sans-serif",
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 400,
          background: 'linear-gradient(180deg, rgba(14,18,38,0.99) 0%, #050A18 100%)',
          borderRadius: 24,
          border: '1.5px solid rgba(201,168,76,0.35)',
          padding: '28px 22px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.70), 0 0 0 1px rgba(201,168,76,0.12)',
          textAlign: 'center',
          animation: 'reminderPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        } as React.CSSProperties}
        role="alertdialog"
        aria-modal="true"
        aria-label={`תזכורת: ${current.title}`}
      >
        {/* Bell icon */}
        <div style={{ fontSize: 40, marginBottom: 4 }}>🔔</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, marginBottom: 8 }}>
          תזכורת
        </div>

        {/* Reminder icon + title */}
        <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
        <div style={{
          fontSize: 22, fontWeight: 800, color: CREAM,
          marginBottom: 6, lineHeight: 1.3,
        }}>
          {current.title}
        </div>

        <div style={{
          fontSize: 16, color: 'rgba(201,168,76,0.60)',
          marginBottom: 4,
        }}>
          {current.displayTimeLabel}
        </div>

        <div style={{
          fontSize: 18, fontWeight: 700,
          color: '#E97943',
          marginBottom: 24,
        }}>
          הגיע הזמן עכשיו
        </div>

        {/* Count if multiple due */}
        {dueReminders.length > 1 && (
          <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.45)', marginBottom: 16 }}>
            {dueReminders.length - 1} תזכורות נוספות
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            data-testid="reminder-due-done-btn"
            onClick={handleDone}
            style={{
              minHeight: 60, borderRadius: 16, border: 'none',
              background: 'linear-gradient(135deg, #D4A853 0%, #C9A84C 50%, #B8912A 100%)',
              color: '#0a0c1a', fontSize: 20, fontWeight: 800, cursor: 'pointer',
              fontFamily: "'Heebo',sans-serif",
            }}
          >
            {getDoneLabel(current.category)}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              data-testid="reminder-due-snooze-btn"
              onClick={handleSnooze}
              style={{
                flex: 1, minHeight: 56, borderRadius: 14,
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
                color: GOLD, fontSize: 17, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Heebo',sans-serif",
              }}
            >
              עוד {current.alertPolicy.snoozeMinutes} דקות
            </button>
            <button
              type="button"
              data-testid="reminder-due-delete-btn"
              onClick={handleDelete}
              style={{
                flex: 1, minHeight: 56, borderRadius: 14,
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
                color: GOLD, fontSize: 17, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Heebo',sans-serif",
              }}
            >
              מחיקה
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes reminderPop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function getDoneLabel(category: Reminder['category']): string {
  switch (category) {
    case 'medication': return 'לקחתי'
    case 'water': return 'שתיתי'
    case 'call': return 'התקשרתי'
    case 'home': return 'עשיתי'
    default: return 'בוצע ✓'
  }
}
