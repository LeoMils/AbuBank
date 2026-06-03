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
// Re-fire intervals: medication is more urgent than casual reminders
const REFIRE_MS_MEDICATION = 15 * 60 * 1000  // 15 min
const REFIRE_MS_DEFAULT = 30 * 60 * 1000     // 30 min

interface Props {
  onReminderDue?: (reminder: Reminder) => void
}

export function ReminderDueEngine({ onReminderDue }: Props) {
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  // Track which reminders we've shown the popup for in this session.
  const [firedIds] = useState(() => new Set<string>())
  // Track first-shown time for re-fire logic (id → timestamp)
  const [firstShownAt] = useState(() => new Map<string, number>())
  // Track how many times we've re-fired each reminder
  const [refireCount] = useState(() => new Map<string, number>())

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
      // Mark all as fired + track first-shown time
      for (const r of due) {
        firedIds.add(r.id)
        if (!firstShownAt.has(r.id)) firstShownAt.set(r.id, now)
      }
      // Sound + TTS for first due reminder
      const first = due[0]!
      playReminderBeep()
      if (first.alertPolicy.voice) {
        speakReminder(`תזכורת: ${first.title}`)
      }
      onReminderDue?.(first)
    }

    // Re-fire: if a reminder was shown but user hasn't acted, re-alert.
    // Medication re-fires every 15 min, others every 30 min.
    for (const r of allReminders) {
      if (r.status !== 'scheduled') continue
      const shownAt = firstShownAt.get(r.id)
      if (!shownAt) continue
      const refireMs = r.category === 'medication' ? REFIRE_MS_MEDICATION : REFIRE_MS_DEFAULT
      const count = refireCount.get(r.id) ?? 0
      const nextRefireAt = shownAt + refireMs * (count + 1)
      if (now >= nextRefireAt && count < 3) {
        refireCount.set(r.id, count + 1)
        playReminderBeep()
        if (r.alertPolicy.voice) {
          const urgency = count >= 1 ? 'עדיין לא בוצע. ' : ''
          speakReminder(`${urgency}תזכורת: ${r.title}`)
        }
      }
    }
  }, [onReminderDue, firedIds, firstShownAt, refireCount])

  useEffect(() => {
    checkDue()
    const interval = setInterval(checkDue, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [checkDue])

  const current = dueReminders[currentIdx] ?? null

  if (!current) return null

  function clearRefireTracking(id: string) {
    firstShownAt.delete(id)
    refireCount.delete(id)
  }

  function handleDone() {
    if (!current) return
    clearRefireTracking(current.id)
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
    clearRefireTracking(current.id)
    snoozeReminder(current.id, current.alertPolicy.snoozeMinutes)
    const next = dueReminders.filter(r => r.id !== current.id)
    setDueReminders(next)
    setCurrentIdx(0)
  }

  function handleDelete() {
    if (!current) return
    clearRefireTracking(current.id)
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
        {/* Bell icon — pulses to catch attention even if sound is blocked */}
        <style>{`@keyframes bellPulse { 0%,100% { transform: scale(1); } 25% { transform: scale(1.15) rotate(-8deg); } 50% { transform: scale(1.1) rotate(8deg); } 75% { transform: scale(1.15) rotate(-4deg); } }`}</style>
        <div style={{ fontSize: 48, marginBottom: 4, animation: 'bellPulse 1s ease-in-out infinite' }}>🔔</div>
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
          marginBottom: current.category === 'medication' && (refireCount.get(current.id) ?? 0) > 0 ? 8 : 24,
        }}>
          הגיע הזמן עכשיו
        </div>
        {/* Medication re-fire urgency — gentle but clear */}
        {current.category === 'medication' && (refireCount.get(current.id) ?? 0) > 0 && (
          <div data-testid="reminder-refire-notice" style={{
            fontSize: 15, fontWeight: 600, color: '#fbbf24',
            marginBottom: 24, lineHeight: 1.4,
          }}>
            עדיין לא סומן — חשוב לקחת
          </div>
        )}

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

          <button
            type="button"
            data-testid="reminder-due-snooze-btn"
            onClick={handleSnooze}
            style={{
              width: '100%', minHeight: 56, borderRadius: 14,
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
              width: '100%', minHeight: 48, borderRadius: 14,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Heebo',sans-serif",
            }}
          >
            לא צריך
          </button>
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
