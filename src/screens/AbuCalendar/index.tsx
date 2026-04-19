import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import {
  loadAppointmentsWithFamily,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  detectEmoji,
  playChime,
  parseAppointmentText,
  formatHebrewDate,
  formatHebrewMonth,
  formatShortHebrewDate,
  getUpcomingBirthdays,
  getHebrewHoliday,
  type Appointment,
} from './service'
import { transcribeAudio, getSupportedMimeType } from '../AbuAI/service'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap, soundSuccess, soundOpen, soundAlert } from '../../services/sounds'
import { injectSharedKeyframes } from '../../design/animations'

const GOLD = '#C9A84C'
const BRIGHT_GOLD = '#D4A853'
const TEAL = '#14b8a6'
const BG = '#050A18'  // v22: match Home screen
const CREAM = '#F5F0E8'

// Hebrew full day names — Sunday first (matching JS getDay())
const DAY_HEADERS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
export type ApptTimeState = 'past' | 'now' | 'today' | 'upcoming'

const isFamily = (a: Appointment) => a.type === 'birthday' || a.type === 'memory'

function ApptCard({ appt, onDelete, onEdit, timeState = 'upcoming' }: {
  appt: Appointment
  onDelete?: () => void
  onEdit?: () => void
  timeState?: ApptTimeState
}) {
  const [hovered, setHovered] = useState(false)
  const isPast = timeState === 'past'
  const isNow = timeState === 'now'
  const isToday = timeState === 'today'
  const family = isFamily(appt)
  const showDelete = !family

  const textColor = isPast ? 'rgba(245,240,232,0.50)' : isNow ? CREAM : isToday ? 'rgba(245,240,232,0.92)' : 'rgba(245,240,232,0.88)'
  const timeColor = isPast ? 'rgba(201,168,76,0.30)' : isNow ? TEAL : GOLD
  const timeWeight = isNow || isToday ? 700 : 400
  const notesColor = isPast ? 'rgba(245,240,232,0.30)' : 'rgba(245,240,232,0.55)'
  const stripeColor = isPast ? 'rgba(255,255,255,0.12)' : isNow ? TEAL : isToday ? GOLD : 'rgba(201,168,76,0.45)'
  const stripeWidth = isNow ? 5 : isPast ? 3 : 4
  const deleteOpacity = isPast ? 0.25 : 0.40

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!family && onEdit ? onEdit : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: isPast ? 'rgba(255,255,255,0.02)'
          : isNow ? 'rgba(20,184,166,0.10)'
          : isToday ? 'rgba(201,168,76,0.06)'
          : 'rgba(255,250,240,0.04)',
        border: isNow ? '1.5px solid rgba(20,184,166,0.40)'
          : isToday ? '1px solid rgba(201,168,76,0.20)'
          : isPast ? '1px solid rgba(255,255,255,0.05)'
          : hovered ? '1px solid rgba(201,168,76,0.25)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '10px 12px 10px 0',
        position: 'relative', marginBottom: 8, overflow: 'hidden',
        transition: 'border-color 0.15s',
        boxShadow: isNow ? '0 2px 12px rgba(20,184,166,0.15)' : 'none',
        animation: 'fadeSlideUp 0.35s ease both',
        cursor: !family && onEdit ? 'pointer' : 'default',
      } as React.CSSProperties}
    >
      <div style={{
        width: stripeWidth, alignSelf: 'stretch', background: stripeColor,
        borderRadius: '0 3px 3px 0', flexShrink: 0,
      }} />

      {isNow && (
        <div style={{
          position: 'absolute', top: 8, left: 10,
          fontSize: 14, fontWeight: 700, color: 'white',
          background: TEAL, padding: '2px 10px', borderRadius: 8,
          fontFamily: "'Heebo',sans-serif",
        }}>עכשיו</div>
      )}

      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, filter: isPast ? 'grayscale(0.6)' : 'none' }}>{appt.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 600, color: textColor,
          fontFamily: "'DM Sans','Heebo',sans-serif", marginBottom: 3,
          textDecoration: isPast ? 'line-through' : 'none',
          textDecorationColor: 'rgba(245,240,232,0.25)',
        }}>{appt.title}</div>
        <div style={{
          fontSize: 16, fontWeight: timeWeight, color: timeColor,
          fontFamily: "'DM Sans',sans-serif",
        }}>{appt.time}</div>
        {appt.notes && (
          <div style={{ fontSize: 16, color: notesColor, fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>{appt.notes}</div>
        )}
      </div>
      {showDelete && onDelete && (
        <button type="button" onClick={e => { e.stopPropagation(); onDelete() }} aria-label="מחקי אירוע"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: `rgba(255,255,255,${deleteOpacity})`, fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  )
}

// ─── Manual Add Modal ─────────────────────────────────────────────────────────
interface ManualModalProps {
  onClose: () => void
  onSave: (appt: Omit<Appointment, 'id' | 'color'>) => void
  defaultDate: string
  editing?: Appointment | null
}

function ManualModal({ onClose, onSave, defaultDate, editing }: ManualModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate)
  const [time, setTime] = useState(editing?.time ?? '09:00')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [titleFocused, setTitleFocused] = useState(false)
  const [dateFocused, setDateFocused] = useState(false)
  const [timeFocused, setTimeFocused] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  const modalTitle = editing ? 'עריכת אירוע' : 'אירוע חדש'

  function handleSave() {
    if (!title.trim()) return
    const trimmedNotes = notes.trim()
    const appt: Omit<Appointment, 'id' | 'color'> = {
      title: title.trim(),
      date,
      time,
      emoji: detectEmoji(title.trim()),
      notes: trimmedNotes || '',
    }
    onSave(appt)
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,250,240,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: CREAM,
    fontSize: 16,
    fontFamily: "'Heebo',sans-serif",
    colorScheme: 'dark' as React.CSSProperties['colorScheme'],
    boxSizing: 'border-box',
    outline: 'none',
    direction: 'rtl',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0 16px',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
          border: '1px solid rgba(201,168,76,0.22)',
          borderRadius: 28,
          padding: '28px 22px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,250,240,0.03)',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: CREAM,
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
          marginBottom: 4,
        }}>
          <span style={{
            background: `linear-gradient(135deg, ${BRIGHT_GOLD}, #e8c76a, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } as React.CSSProperties}>{modalTitle}</span>
        </div>

        <input
          type="text"
          placeholder="שם האירוע..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          style={{
            ...inputBase,
            border: titleFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
            fontSize: 18,
            boxShadow: titleFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
          }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 16, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'Heebo',sans-serif",
            }}>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              style={{
                ...inputBase, padding: '12px 10px',
                border: dateFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
                boxShadow: dateFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 16, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'Heebo',sans-serif",
            }}>שעה</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              onFocus={() => setTimeFocused(true)}
              onBlur={() => setTimeFocused(false)}
              style={{
                ...inputBase, padding: '12px 10px', direction: 'ltr',
                border: timeFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
                boxShadow: timeFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
              }}
            />
          </div>
        </div>

        <input
          type="text"
          placeholder="הערות (אופציונלי)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          style={{
            ...inputBase,
            border: notesFocused ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: notesFocused ? '0 0 0 3px rgba(201,168,76,0.08)' : 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, padding: '15px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer', minHeight: 56,
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: title.trim()
                ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`
                : 'rgba(255,255,255,0.06)',
              color: title.trim() ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: title.trim() ? '0 4px 20px rgba(201,168,76,0.40)' : 'none',
              minHeight: 56,
            }}
          >שמירה</button>
        </div>
      </div>
    </div>
  )
}

// ─── Voice confirmation card (editable) ───────────────────────────────────────
interface VoiceCardProps {
  parsed: { title: string; date: string | null; time: string | null; emoji: string }
  existingAppts: Appointment[]
  onConfirm: (final: { title: string; date: string; time: string; emoji: string }) => void
  onCancel: () => void
}

function VoiceCard({ parsed, existingAppts, onConfirm, onCancel }: VoiceCardProps) {
  const [title, setTitle] = useState(parsed.title)
  const [date, setDate] = useState(parsed.date ?? '')
  const [time, setTime] = useState(parsed.time ?? '')
  const emoji = detectEmoji(title)
  const today = getTodayStr()

  const canSave = title.trim() && date && time
  const isPastDate = date && date < today

  const isDuplicate = canSave && existingAppts.some(a =>
    a.title.trim().toLowerCase() === title.trim().toLowerCase() && a.date === date && a.time === time
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12,
    background: 'rgba(255,250,240,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    color: CREAM, fontSize: 16, fontFamily: "'Heebo',sans-serif",
    outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' as React.CSSProperties['colorScheme'],
  }

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.84)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    } as React.CSSProperties}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
        border: '1px solid rgba(201,168,76,0.32)', borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        padding: 'calc(28px + env(safe-area-inset-bottom, 0px)) 20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 -8px 40px rgba(201,168,76,0.12)',
        animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
          🎤 שמעתי נכון?
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 38, flexShrink: 0 }}>{emoji}</span>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            style={{ ...inputStyle, fontSize: 19, fontWeight: 700 }} dir="rtl" />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>תאריך</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              placeholder={!date ? 'תאריך לא זוהה' : undefined}
              style={{ ...inputStyle, padding: '10px 10px', border: !date ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.10)' }} />
            {!date && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>תאריך לא זוהה</span>}
            {isPastDate && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>⚠️ התאריך עבר</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>שעה</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ ...inputStyle, padding: '10px 10px', direction: 'ltr', border: !time ? '1px solid rgba(251,146,60,0.40)' : '1px solid rgba(255,255,255,0.10)' }} />
            {!time && <span style={{ fontSize: 14, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif" }}>זמן לא זוהה</span>}
          </div>
        </div>

        {isDuplicate && (
          <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.50)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
            אירוע דומה כבר קיים
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: '15px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.50)', fontSize: 18, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56,
          }}>ביטול</button>
          <button type="button" disabled={!canSave}
            onClick={() => canSave && onConfirm({ title: title.trim(), date, time, emoji })}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: canSave ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)` : 'rgba(255,255,255,0.06)',
              color: canSave ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: canSave ? 'pointer' : 'not-allowed', minHeight: 56,
            }}
          >כן, שמרי!</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main AbuCalendar Screen ───────────────────────────────────────────────────
export function AbuCalendar() {
  const setScreen = useAppStore(s => s.setScreen)
  const today = getTodayStr()
  const todayDate = new Date()

  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today)
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadAppointmentsWithFamily(todayDate.getFullYear()))
  const [showManual, setShowManual] = useState(false)
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [toast, setToast] = useState(false)
  const [voiceParsed, setVoiceParsed] = useState<{ title: string; date: string | null; time: string | null; emoji: string } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [undoAppt, setUndoAppt] = useState<Appointment | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // ─── Alert state (persisted) ─────────────────────────────────────────────────
  const [alertMinutes, setAlertMinutes] = useState<number>(() => {
    return parseInt(localStorage.getItem('abubank-alert-minutes') ?? '60', 10)
  })
  const [activeAlerts, setActiveAlerts] = useState<Array<{ id: string; title: string; minutesLeft: number }>>([])
  const alertedIdsRef = useRef<Set<string>>((() => {
    try {
      const raw = localStorage.getItem('abubank-alerted-ids')
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>()
    } catch { return new Set<string>() }
  })())

  function persistAlertedIds() {
    try {
      localStorage.setItem('abubank-alerted-ids', JSON.stringify([...alertedIdsRef.current]))
    } catch { /* ignore */ }
  }

  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])
  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(appointments, 14), [appointments])
  const nextBirthday = upcomingBirthdays[0] ?? null

  const [slideDir, setSlideDir] = useState<'none' | 'left' | 'right'>('none')
  const [slideKey, setSlideKey] = useState(0)

  const reload = useCallback(() => setAppointments(loadAppointmentsWithFamily(year)), [year])

  // ─── Feature 1: Alert interval ───────────────────────────────────────────────
  useEffect(() => { injectSharedKeyframes() }, [])
  // Reload appointments when year changes (birthdays are year-specific)
  useEffect(() => { setAppointments(loadAppointmentsWithFamily(year)) }, [year])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const allAppts = loadAppointmentsWithFamily()
      const pending: Array<{ id: string; title: string; minutesLeft: number }> = []
      // Expire alerts whose event time has passed
      setActiveAlerts(prev => prev.filter(a => {
        const appt = allAppts.find(x => x.id === a.id)
        if (!appt) return false
        const t = new Date(`${appt.date}T${appt.time}:00`).getTime()
        return !isNaN(t) && t > now
      }))
      for (const appt of allAppts) {
        if (alertedIdsRef.current.has(appt.id)) continue
        const apptTime = new Date(`${appt.date}T${appt.time}:00`).getTime()
        if (isNaN(apptTime)) continue
        const diff = apptTime - now
        if (diff > 0 && diff <= alertMinutes * 60_000) {
          alertedIdsRef.current.add(appt.id)
          persistAlertedIds()
          pending.push({ id: appt.id, title: appt.title, minutesLeft: Math.round(diff / 60_000) })
        }
      }
      if (pending.length > 0) {
        pending.sort((a, b) => a.minutesLeft - b.minutesLeft)
        soundAlert()
        setActiveAlerts(prev => {
          const combined = [...prev, ...pending]
          combined.sort((a, b) => a.minutesLeft - b.minutesLeft)
          return combined.slice(0, 2)
        })
      }
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [alertMinutes])

  function prevMonth() {
    setSlideDir('right'); setSlideKey(k => k + 1)
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    setSlideDir('left'); setSlideKey(k => k + 1)
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const cells: Array<number | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const apptsByDate = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const k = a.date
    if (!acc[k]) acc[k] = []
    acc[k]!.push(a)
    return acc
  }, {})

  const selectedAppts = apptsByDate[selectedDay] ?? []

  function showToast() {
    setToast(true)
    setTimeout(() => setToast(false), 3500)
  }

  function handleManualSave(appt: Omit<Appointment, 'id' | 'color'>) {
    if (editingAppt) {
      updateAppointment(editingAppt.id, appt)
    } else {
      addAppointment(appt)
    }
    reload()
    setShowManual(false)
    setEditingAppt(null)
    playChime()
    soundSuccess()
    showToast()
  }

  function handleDelete(appt: Appointment) {
    soundTap()
    deleteAppointment(appt.id)
    reload()
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoAppt(appt)
    undoTimerRef.current = setTimeout(() => { setUndoAppt(null); undoTimerRef.current = null }, 4000)
  }

  function handleUndo() {
    if (!undoAppt) return
    addAppointment({ title: undoAppt.title, date: undoAppt.date, time: undoAppt.time, emoji: undoAppt.emoji, notes: undoAppt.notes || '' })
    reload()
    setUndoAppt(null)
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null }
  }

  async function handleVoiceRecord() {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setIsRecording(false)
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        if (blob.size < 1000) {
          setVoiceStatus('ההקלטה קצרה מדי. נסי שוב.')
          setTimeout(() => setVoiceStatus(''), 3000)
          return
        }
        setVoiceStatus('מעבדת...')
        try {
          const transcribed = await transcribeAudio(blob)
          setVoiceStatus('מנתחת...')
          const parsed = await parseAppointmentText(transcribed)
          setVoiceParsed(parsed)
        } catch {
          setVoiceStatus('לא הצלחתי להבין. נסי שוב לאט יותר')
          setTimeout(() => setVoiceStatus(''), 3000)
        }
      }
      mr.start()
      setIsRecording(true)
      setVoiceStatus('מקשיבה... (לחצי שוב לסיום)')
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'צריך לאשר גישה למיקרופון'
        : err instanceof DOMException && err.name === 'NotFoundError'
        ? 'לא נמצא מיקרופון'
        : 'מיקרופון לא זמין — נסי ב-HTTPS'
      setVoiceStatus(msg)
      setTimeout(() => setVoiceStatus(''), 4000)
    }
  }

  function handleVoiceConfirm(final: { title: string; date: string; time: string; emoji: string }) {
    addAppointment(final)
    reload()
    setVoiceParsed(null)
    setVoiceStatus('')
    playChime()
    soundSuccess()
    showToast()
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const hebrewMonthLabel = formatHebrewMonth(year, month)

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Heebo',sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      {/* Ambient glow — warm gold/teal */}
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 50% 30% at 15% 10%, rgba(201,168,76,0.10) 0%, transparent 60%)',
          'radial-gradient(ellipse 40% 35% at 85% 80%, rgba(20,184,166,0.07) 0%, transparent 60%)',
        ].join(', '),
        animation: 'ambientColorShift 30s ease-in-out infinite',
      }} />

      {/* ALERT BANNERS — max 2 stacked */}
      {activeAlerts.length > 0 && (
        <div style={{ position: 'fixed', top: 72, left: 0, right: 0, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeAlerts.map(alert => (
            <div key={alert.id} style={{
              background: 'rgba(12,10,8,0.97)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '2px solid rgba(201,168,76,0.60)',
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
              animation: 'alertSlideIn 0.35s cubic-bezier(0.34,1.2,0.64,1) both',
            } as React.CSSProperties}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🔔</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: GOLD, fontFamily: "'Heebo',sans-serif" }}>
                  תזכורת: {alert.title}
                </span>
                <div style={{ fontSize: 16, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif", marginTop: 2 }}>
                  בעוד {alert.minutesLeft} דקות
                </div>
              </div>
              <button type="button" onClick={() => setActiveAlerts(prev => prev.filter(a => a.id !== alert.id))}
                aria-label="סגרי התראה" style={{
                  minWidth: 64, height: 48, borderRadius: 12,
                  background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
                  color: GOLD, fontSize: 16, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontFamily: "'Heebo',sans-serif", padding: '0 14px',
                }}
              >הבנתי</button>
            </div>
          ))}
        </div>
      )}

      {/* HEADER */}
      <header style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        background: 'rgba(12,10,8,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: '1px solid rgba(201,168,76,0.20)',
        boxShadow: 'inset 0 1px 0 rgba(255,250,240,0.04), 0 4px 20px rgba(0,0,0,0.40)',
      } as React.CSSProperties}>
        {/* Back button — glass pill */}
        <button
          type="button"
          onClick={() => setScreen(Screen.Home)}
          aria-label="חזרה לדף הבית"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            width: 60, height: 48,
            background: 'rgba(255,250,240,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.18)',
            borderRadius: 22,
            color: 'rgba(245,240,232,0.70)',
            fontSize: 14, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer', flexShrink: 0,
          } as React.CSSProperties}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>›</span>
          <span style={{ fontSize: 16 }}>חזרה</span>
        </button>

        {/* Center wordmark */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 18, fontWeight: 700, letterSpacing: '1px',
            background: `linear-gradient(135deg, #e8d5a0 0%, ${BRIGHT_GOLD} 35%, #f0e0a0 60%, ${GOLD} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          } as React.CSSProperties}>Abu יומן</span>
        </div>

        {/* Left side: Martita photo with hearts + 3-dot settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <img
              src={martitaPhoto}
              alt="Martita"
              onError={handleMartitaImgError}
              style={{
                width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                boxShadow: '0 0 0 2px rgba(201,168,76,0.50), 0 2px 14px rgba(0,0,0,0.45)',
              }}
            />
          </div>
          {/* Three-dots settings button */}
          <button
            type="button"
            onClick={() => setShowSettings(p => !p)}
            aria-label="הגדרות יומן"
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="rgba(255,255,255,0.55)">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>

        {/* Bottom glow strip */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.35) 30%, rgba(212,168,83,0.50) 50%, rgba(201,168,76,0.35) 70%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </header>

      {/* Settings dropdown — triggered by 3-dot button */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.50)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            dir="rtl"
            style={{
              position: 'absolute', top: 78, left: 14, right: 14,
              background: 'rgba(12,10,8,0.97)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(201,168,76,0.22)',
              borderRadius: 16, padding: '16px 18px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.50)',
              animation: 'fadeSlideUp 0.2s ease both',
            } as React.CSSProperties}
          >
            {/* Alert settings */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(245,240,232,0.80)', fontFamily: "'Heebo',sans-serif" }}>
                🔔 התראה לפני אירוע
              </span>
              <select
                value={alertMinutes}
                onChange={e => { const v = parseInt(e.target.value, 10); setAlertMinutes(v); localStorage.setItem('abubank-alert-minutes', String(v)) }}
                style={{
                  background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)',
                  borderRadius: 10, color: GOLD, fontSize: 14, fontWeight: 600,
                  fontFamily: "'DM Sans',sans-serif", padding: '6px 12px',
                  cursor: 'pointer', outline: 'none', direction: 'rtl',
                } as React.CSSProperties}
              >
                <option value={15}>15 דקות</option>
                <option value={30}>30 דקות</option>
                <option value={60}>60 דקות</option>
                <option value={120}>120 דקות</option>
              </select>
            </div>

            {/* Info section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 8, fontFamily: "'Heebo',sans-serif" }}>
                ℹ️ איך להשתמש
              </div>
              <div style={{ fontSize: 13, color: 'rgba(245,240,232,0.60)', lineHeight: 1.8, fontFamily: "'Heebo',sans-serif" }}>
                · לחצי על יום בלוח לראות אירועים{'\n'}
                · לחצי על המיקרופון ותגידי מה להוסיף{'\n'}
                · לחצי ＋ הוספה ידנית להזנה בכתב{'\n'}
                · התראה מושמעת לפני כל אירוע
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowSettings(false)}
              style={{
                marginTop: 14, width: '100%', padding: '10px 0', borderRadius: 12,
                background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.22)',
                color: GOLD, fontSize: 15, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer',
              }}
            >סגור ✕</button>
          </div>
        </div>
      )}

      {/* Birthday countdown — only shows when relevant, compact */}
      {nextBirthday && (
        <div style={{
          margin: '4px 14px 0', padding: '6px 12px', borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(244,114,182,0.10) 0%, rgba(167,139,250,0.06) 100%)',
          border: '1px solid rgba(244,114,182,0.18)',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>🎂</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#F472B6', fontFamily: "'Heebo',sans-serif" }}>
            {nextBirthday.daysUntil === 0
              ? `היום יום ההולדת של ${nextBirthday.personName || nextBirthday.title}! 🎉`
              : nextBirthday.daysUntil === 1
              ? `מחר יום ההולדת של ${nextBirthday.personName || nextBirthday.title}! 🎁`
              : `עוד ${nextBirthday.daysUntil} ימים ליום ההולדת של ${nextBirthday.personName || nextBirthday.title}`}
          </span>
        </div>
      )}

      {/* MONTH NAVIGATOR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 6px', flexShrink: 0, position: 'relative',
      }}>
        <button
          type="button" onClick={nextMonth} aria-label="חודש הבא"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,250,240,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.22)',
            color: 'rgba(201,168,76,0.75)', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s',
          } as React.CSSProperties}
        >‹</button>

        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 28, fontWeight: 600, fontStyle: 'italic', letterSpacing: '0.02em',
            background: `linear-gradient(135deg, #e8d5a0 0%, ${BRIGHT_GOLD} 35%, #f0e0a0 65%, ${GOLD} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            lineHeight: 1.1,
          } as React.CSSProperties}>{hebrewMonthLabel.split(' ')[0]}</div>
          <div style={{
            fontSize: 16, color: 'rgba(201,168,76,0.55)',
            fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginTop: 2,
          }}>{hebrewMonthLabel.split(' ')[1]}</div>
        </div>

        {/* Jump to Today — only when viewing non-current month */}
        {(year !== todayDate.getFullYear() || month !== todayDate.getMonth() + 1) && (
          <button type="button" onClick={() => {
            setYear(todayDate.getFullYear()); setMonth(todayDate.getMonth() + 1)
            setSelectedDay(today); setSlideDir('none'); setSlideKey(k => k + 1)
          }} style={{
            position: 'absolute', left: '50%', bottom: -4, transform: 'translateX(-50%)',
            padding: '4px 16px', borderRadius: 14, minHeight: 44, minWidth: 64,
            background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)',
            color: GOLD, fontSize: 14, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer', zIndex: 5,
          }}>היום</button>
        )}

        <button
          type="button" onClick={prevMonth} aria-label="חודש קודם"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,250,240,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.22)',
            color: 'rgba(201,168,76,0.75)', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s',
          } as React.CSSProperties}
        >›</button>
      </div>

      {/* ═══════════ PREMIUM CALENDAR GRID ═══════════ */}
      <div key={slideKey} style={{
        margin: '0 10px', padding: '10px 6px 8px',
        animation: slideDir === 'left' ? 'slideFromLeft 0.25s ease both'
                 : slideDir === 'right' ? 'slideFromRight 0.25s ease both'
                 : 'none',
        background: 'linear-gradient(180deg, rgba(255,250,240,0.035) 0%, rgba(201,168,76,0.015) 100%)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(201,168,76,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,250,240,0.06), 0 4px 24px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {DAY_HEADERS.map((h, idx) => (
            <div key={h} style={{
              textAlign: 'center', fontSize: 16, fontWeight: 700,
              color: idx === 6 ? 'rgba(201,168,76,0.90)' : idx === 5 ? 'rgba(201,168,76,0.60)' : 'rgba(245,240,232,0.50)',
              padding: '4px 0', fontFamily: "'Heebo',sans-serif",
              borderBottom: idx === 6 ? '1.5px solid rgba(201,168,76,0.30)' : idx === 5 ? '1px solid rgba(201,168,76,0.12)' : 'none',
            }}>{h}</div>
          ))}
        </div>

        {/* Day cells grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} style={{ minHeight: 54 }} />
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const isSelected = ds === selectedDay && !isToday
            const isPast = ds < today
            const dots = apptsByDate[ds] ?? []
            const isShabbat = idx % 7 === 6
            const isFriday = idx % 7 === 5
            const holiday = getHebrewHoliday(ds)
            const hasBirthday = dots.some(a => a.type === 'birthday')
            const cellDelay = `${(idx % 7) * 0.02}s`
            return (
              <button
                key={ds}
                type="button"
                onClick={() => { setSelectedDay(ds); soundTap() }}
                aria-label={`${day} ${formatHebrewMonth(year, month)}${holiday ? `, ${holiday}` : ''}${dots.length ? `, ${dots.length} אירועים` : ''}`}
                aria-current={isToday ? 'date' : undefined}
                style={{
                  minHeight: 54, borderRadius: 14, position: 'relative',
                  animation: `fadeSlideUp 0.3s ease ${cellDelay} both`,
                  border: isToday
                    ? '2px solid rgba(201,168,76,0.65)'
                    : isSelected
                    ? '2px solid rgba(20,184,166,0.55)'
                    : holiday
                    ? '1px solid rgba(201,168,76,0.18)'
                    : hasBirthday
                    ? '1px solid rgba(244,114,182,0.25)'
                    : '1px solid rgba(255,255,255,0.03)',
                  background: isToday
                    ? 'linear-gradient(145deg, rgba(201,168,76,0.16) 0%, rgba(212,168,83,0.06) 100%)'
                    : isSelected
                    ? 'linear-gradient(145deg, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0.06) 100%)'
                    : holiday
                    ? 'linear-gradient(145deg, rgba(201,168,76,0.06) 0%, rgba(201,168,76,0.02) 100%)'
                    : hasBirthday
                    ? 'linear-gradient(145deg, rgba(244,114,182,0.08) 0%, rgba(167,139,250,0.03) 100%)'
                    : dots.length > 0
                    ? 'rgba(255,250,240,0.025)'
                    : isShabbat ? 'rgba(201,168,76,0.025)' : isFriday ? 'rgba(201,168,76,0.012)' : 'transparent',
                  opacity: isPast && !isToday ? 0.45 : 1,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 1, padding: '3px 0 2px',
                  transition: 'all 0.18s ease',
                  boxShadow: isToday
                    ? 'inset 0 1px 0 rgba(201,168,76,0.15), 0 2px 12px rgba(201,168,76,0.12)'
                    : isSelected
                    ? 'inset 0 1px 0 rgba(20,184,166,0.10), 0 0 0 3px rgba(20,184,166,0.08)'
                    : 'none',
                }}
              >
                {/* Day number */}
                <div style={{
                  width: isToday ? 36 : 34, height: isToday ? 36 : 34, borderRadius: '50%',
                  background: isToday
                    ? 'linear-gradient(135deg, #f0d878 0%, #e8c76a 20%, #D4A853 45%, #C9A84C 65%, #e8c76a 85%, #f0d878 100%)'
                    : 'transparent',
                  backgroundSize: isToday ? '250% 100%' : undefined,
                  animation: isToday ? 'todayShimmer 3s ease infinite' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: isToday ? 20 : 18,
                    fontWeight: isToday ? 800 : isSelected ? 700 : 500,
                    color: isToday ? '#0C0A08'
                      : isSelected ? '#2DD4BF'
                      : holiday ? GOLD
                      : isShabbat ? 'rgba(201,168,76,0.85)'
                      : isFriday ? 'rgba(245,240,232,0.70)'
                      : 'rgba(245,240,232,0.88)',
                    fontFamily: "'DM Sans',sans-serif", lineHeight: 1,
                    textShadow: isToday ? '0 1px 3px rgba(0,0,0,0.30)' : 'none',
                  }}>{day}</span>
                </div>

                {/* v22: Single dot indicator — events or birthday */}
                {dots.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 1,
                    background: hasBirthday ? '#F472B6' : dots[0]?.color ?? TEAL,
                    boxShadow: hasBirthday
                      ? '0 0 6px rgba(244,114,182,0.50)'
                      : `0 0 4px ${dots[0]?.color ?? TEAL}66`,
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* SELECTED DAY APPOINTMENTS */}
      <div style={{ padding: '8px 16px 4px', flexShrink: 0, maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'thin' as React.CSSProperties['scrollbarWidth'] }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>אירועים</span>
          <span style={{ fontSize: 16, color: 'rgba(245,240,232,0.50)', fontFamily: "'Heebo',sans-serif" }}>{formatShortHebrewDate(selectedDay)}</span>
        </div>

        {getHebrewHoliday(selectedDay) && (
          <div style={{
            padding: '6px 12px', borderRadius: 10, marginBottom: 8,
            background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>✡️</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#e8c76a', fontFamily: "'Heebo',sans-serif" }}>{getHebrewHoliday(selectedDay)}</span>
          </div>
        )}

        {selectedAppts.length === 0 && !getHebrewHoliday(selectedDay) ? (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 28, opacity: 0.5 }}>📅</span>
            <span style={{ color: 'rgba(201,168,76,0.55)', fontSize: 16, fontFamily: "'Heebo',sans-serif", fontWeight: 500 }}>יום פנוי ✨</span>
            <span style={{ color: 'rgba(245,240,232,0.50)', fontSize: 16, fontFamily: "'Heebo',sans-serif" }}>לחצי למטה להוסיף אירוע</span>
          </div>
        ) : (
          selectedAppts.map(a => {
            const apptDateTime = new Date(`${a.date}T${a.time}:00`).getTime()
            const nowMs = Date.now()
            let timeState: ApptTimeState = 'upcoming'
            if (!isNaN(apptDateTime)) {
              if (apptDateTime < nowMs) timeState = 'past'
              else if (apptDateTime >= nowMs && apptDateTime <= nowMs + 10 * 60 * 1000) timeState = 'now'
              else if (a.date === today) timeState = 'today'
            }
            return (
              <ApptCard key={a.id} appt={a} timeState={timeState}
                onDelete={() => handleDelete(a)}
                onEdit={() => { setEditingAppt(a); setShowManual(true) }}
              />
            )
          })
        )}
      </div>

      {/* FOOTER — mic centered, manual-add subdued */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: '4px 16px calc(8px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0, marginTop: 'auto', position: 'relative',
      }}>
        {/* Recording status — appears above footer */}
        {(isRecording || (voiceStatus && !voiceParsed && !isRecording)) && (
          <div style={{
            position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
            fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
            color: isRecording ? 'rgba(252,165,165,0.90)' : 'rgba(201,168,76,0.85)',
            fontFamily: "'Heebo',sans-serif",
          }}>
            {isRecording ? '🔴 מקשיבה...' : voiceStatus}
          </div>
        )}

        <button type="button"
          onClick={() => { soundOpen(); setEditingAppt(null); setShowManual(true) }}
          style={{
            padding: '8px 16px', background: 'none', border: 'none',
            color: 'rgba(245,240,232,0.40)', fontSize: 15, fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer', minHeight: 48,
          }}
        >＋ הוספה ידנית</button>

        <button type="button" onClick={handleVoiceRecord}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          aria-label="הוספת אירוע בקול"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: isRecording
              ? 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(145deg, #D4A853 0%, #C9A84C 45%, #B8912A 100%)',
            border: 'none',
            boxShadow: isRecording
              ? '0 4px 16px rgba(239,68,68,0.35)'
              : '0 4px 16px rgba(201,168,76,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'transform 0.12s ease, background 0.2s ease',
            animation: isRecording ? 'recordPulse 1.2s ease-in-out infinite' : 'none',
          }}
        >
          {isRecording ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          )}
        </button>
      </div>

      {/* UNDO TOAST */}
      {undoAppt && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, background: 'rgba(12,10,8,0.94)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(201,168,76,0.30)', borderRadius: 18, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          animation: 'fadeSlideUp 0.30s ease both',
        } as React.CSSProperties}>
          <span style={{ fontSize: 15, fontWeight: 600, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>האירוע נמחק</span>
          <button type="button" onClick={handleUndo} style={{
            padding: '6px 14px', borderRadius: 10, background: 'rgba(201,168,76,0.20)',
            border: '1px solid rgba(201,168,76,0.40)', color: GOLD, fontSize: 15, fontWeight: 700,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
          }}>ביטול</button>
        </div>
      )}

      {/* SAVE SUCCESS TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, pointerEvents: 'none',
          background: 'rgba(12,10,8,0.94)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(20,184,166,0.40)', borderRadius: 18, padding: '12px 22px',
          color: CREAM, fontSize: 15, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif", direction: 'rtl', whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 16px rgba(20,184,166,0.15)',
          animation: 'fadeSlideUp 0.30s ease both',
        } as React.CSSProperties}>
          האירוע נשמר
        </div>
      )}

      {/* MODALS */}
      {showManual && (
        <ManualModal
          defaultDate={selectedDay}
          editing={editingAppt}
          onClose={() => { setShowManual(false); setEditingAppt(null) }}
          onSave={handleManualSave}
        />
      )}

      {voiceParsed && (
        <VoiceCard
          parsed={voiceParsed}
          existingAppts={appointments}
          onConfirm={handleVoiceConfirm}
          onCancel={() => { setVoiceParsed(null); setVoiceStatus('') }}
        />
      )}

      {/* KEYFRAMES */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes recordPulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 0 8px rgba(239,68,68,0.12), 0 0 0 16px rgba(239,68,68,0.06), 0 8px 32px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,180,180,0.25); }
          50%       { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(239,68,68,0.16), 0 0 0 22px rgba(239,68,68,0.07), 0 12px 40px rgba(239,68,68,0.55), inset 0 1px 0 rgba(255,180,180,0.25); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes sheetUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes alertSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0);     }
        }
        @keyframes todayShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes slideFromLeft {
          from { transform: translateX(-25px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideFromRight {
          from { transform: translateX(25px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
