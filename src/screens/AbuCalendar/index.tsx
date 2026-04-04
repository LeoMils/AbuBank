import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import {
  loadAppointments,
  addAppointment,
  deleteAppointment,
  detectEmoji,
  playChime,
  parseAppointmentText,
  formatHebrewDate,
  formatHebrewMonth,
  APPT_COLORS,
  type Appointment,
} from './service'
import { transcribeAudio, getSupportedMimeType } from '../AbuAI/service'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap, soundSuccess, soundOpen, soundAlert } from '../../services/sounds'

const GOLD = '#C9A84C'
const TEAL = '#14b8a6'
const BG = '#050A18'

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
function ApptCard({ appt, onDelete }: { appt: Appointment; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered
          ? '1px solid rgba(201,168,76,0.30)'
          : `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 12,
        padding: '14px 14px 14px 0',
        position: 'relative',
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered
          ? `0 4px 24px rgba(201,168,76,0.10)`
          : '0 2px 12px rgba(0,0,0,0.25)',
        animation: 'fadeSlideUp 0.35s ease both',
      } as React.CSSProperties}
    >
      {/* Left color stripe */}
      <div style={{
        width: 4,
        alignSelf: 'stretch',
        background: appt.color,
        borderRadius: '0 3px 3px 0',
        flexShrink: 0,
        marginLeft: 0,
        marginRight: 0,
      }} />
      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{appt.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.95)',
          fontFamily: "'DM Sans','Heebo',sans-serif",
          marginBottom: 3,
        }}>{appt.title}</div>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: TEAL,
          fontFamily: "'DM Sans',sans-serif",
        }}>{appt.time}</div>
        {appt.notes && (
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.40)',
            fontFamily: "'Heebo',sans-serif",
            marginTop: 4,
          }}>{appt.notes}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="מחקי פגישה"
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.40)',
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >×</button>
    </div>
  )
}

// ─── Manual Add Modal ─────────────────────────────────────────────────────────
interface ManualModalProps {
  onClose: () => void
  onSave: (appt: Omit<Appointment, 'id' | 'color'>) => void
  defaultDate: string
}

function ManualModal({ onClose, onSave, defaultDate }: ManualModalProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')
  const [colorIdx, setColorIdx] = useState(0)
  const [notes, setNotes] = useState('')
  const [titleFocused, setTitleFocused] = useState(false)
  const [dateFocused, setDateFocused] = useState(false)
  const [timeFocused, setTimeFocused] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)

  function handleSave() {
    if (!title.trim()) return
    const trimmedNotes = notes.trim()
    const appt: Omit<Appointment, 'id' | 'color'> = {
      title: title.trim(),
      date,
      time,
      emoji: detectEmoji(title.trim()),
    }
    if (trimmedNotes) appt.notes = trimmedNotes
    onSave(appt)
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'white',
    fontSize: 16,
    fontFamily: "'Heebo',sans-serif",
    colorScheme: 'dark' as React.CSSProperties['colorScheme'],
    boxSizing: 'border-box',
    outline: 'none',
    direction: 'rtl',
    transition: 'border-color 0.2s',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.80)',
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
          background: 'linear-gradient(160deg, rgba(12,20,45,0.98) 0%, rgba(7,12,28,0.98) 100%)',
          border: '1px solid rgba(201,168,76,0.20)',
          borderRadius: 28,
          padding: '28px 22px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Modal title */}
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.92)',
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
          marginBottom: 4,
        }}>
          <span style={{
            background: `linear-gradient(135deg, ${GOLD}, #e8c76a, ${GOLD})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } as React.CSSProperties}>אירוע חדש</span>
        </div>

        {/* Title input */}
        <input
          type="text"
          placeholder="שם האירוע..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          style={{
            ...inputBase,
            border: titleFocused
              ? `1px solid rgba(201,168,76,0.55)`
              : '1px solid rgba(255,255,255,0.10)',
            fontSize: 18,
            boxShadow: titleFocused ? `0 0 0 3px rgba(201,168,76,0.08)` : 'none',
          }}
          autoFocus
        />

        {/* Date + Time row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 12,
              fontWeight: 600,
              color: `rgba(201,168,76,0.70)`,
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              style={{
                ...inputBase,
                padding: '12px 10px',
                border: dateFocused
                  ? `1px solid rgba(201,168,76,0.55)`
                  : '1px solid rgba(255,255,255,0.10)',
                boxShadow: dateFocused ? `0 0 0 3px rgba(201,168,76,0.08)` : 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 12,
              fontWeight: 600,
              color: `rgba(201,168,76,0.70)`,
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>שעה</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              onFocus={() => setTimeFocused(true)}
              onBlur={() => setTimeFocused(false)}
              style={{
                ...inputBase,
                padding: '12px 10px',
                direction: 'ltr',
                border: timeFocused
                  ? `1px solid rgba(201,168,76,0.55)`
                  : '1px solid rgba(255,255,255,0.10)',
                boxShadow: timeFocused ? `0 0 0 3px rgba(201,168,76,0.08)` : 'none',
              }}
            />
          </div>
        </div>

        {/* Color selector */}
        <div>
          <label style={{
            fontSize: 12,
            fontWeight: 600,
            color: `rgba(201,168,76,0.70)`,
            fontFamily: "'DM Sans',sans-serif",
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: 10,
          }}>צבע</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {APPT_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorIdx(i)}
                aria-label={`צבע ${i + 1}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <span style={{
                  display: 'block',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  outline: colorIdx === i ? `3px solid ${GOLD}` : '3px solid transparent',
                  outlineOffset: 3,
                  boxShadow: colorIdx === i ? `0 0 14px ${c}88` : 'none',
                  transition: 'outline 0.15s, box-shadow 0.15s, transform 0.15s',
                  transform: colorIdx === i ? 'scale(1.15)' : 'scale(1)',
                }} />
              </button>
            ))}
          </div>
        </div>

        {/* Notes input */}
        <input
          type="text"
          placeholder="הערות (אופציונלי)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          style={{
            ...inputBase,
            border: notesFocused
              ? `1px solid rgba(201,168,76,0.55)`
              : '1px solid rgba(255,255,255,0.10)',
            boxShadow: notesFocused ? `0 0 0 3px rgba(201,168,76,0.08)` : 'none',
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '15px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer',
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              flex: 2,
              padding: '15px',
              borderRadius: 14,
              border: 'none',
              background: title.trim()
                ? `linear-gradient(135deg, ${GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`
                : 'rgba(255,255,255,0.06)',
              color: title.trim() ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 17,
              fontWeight: 700,
              fontFamily: "'Heebo',sans-serif",
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
              boxShadow: title.trim() ? `0 4px 20px rgba(201,168,76,0.35)` : 'none',
            }}
          >שמירה</button>
        </div>
      </div>
    </div>
  )
}

// ─── Voice confirmation card ───────────────────────────────────────────────────
interface VoiceCardProps {
  parsed: { title: string; date: string; time: string; emoji: string }
  onConfirm: () => void
  onCancel: () => void
}

function VoiceCard({ parsed, onConfirm, onCancel }: VoiceCardProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'linear-gradient(160deg, rgba(12,20,45,0.99) 0%, rgba(7,12,28,0.99) 100%)',
          border: `1px solid rgba(201,168,76,0.30)`,
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: '28px 20px calc(32px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: `0 -8px 40px rgba(201,168,76,0.10), 0 -2px 0 rgba(201,168,76,0.15)`,
          animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.90)',
          fontFamily: "'Heebo',sans-serif",
          textAlign: 'center',
        }}>
          <span style={{ marginInlineEnd: 8, fontSize: 20 }}>🎤</span>
          שמעתי נכון?
        </div>

        {/* Preview card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid rgba(201,168,76,0.25)`,
          borderRadius: 16,
          padding: '18px 20px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          boxShadow: `0 0 24px rgba(201,168,76,0.06)`,
        } as React.CSSProperties}>
          <span style={{ fontSize: 38, flexShrink: 0 }}>{parsed.emoji}</span>
          <div>
            <div style={{
              fontSize: 19,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              fontFamily: "'Heebo',sans-serif",
            }}>{parsed.title}</div>
            <div style={{
              fontSize: 14,
              color: TEAL,
              fontFamily: "'DM Sans',sans-serif",
              marginTop: 5,
              fontWeight: 600,
            }}>
              {formatHebrewDate(parsed.date)} · {parsed.time}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '15px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.50)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer',
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 2,
              padding: '15px',
              borderRadius: 14,
              border: 'none',
              background: `linear-gradient(135deg, ${GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`,
              color: 'rgba(0,0,0,0.85)',
              fontSize: 17,
              fontWeight: 700,
              fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer',
              boxShadow: `0 4px 20px rgba(201,168,76,0.35)`,
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
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadAppointments())
  const [showManual, setShowManual] = useState(false)
  const [toast, setToast] = useState(false)
  const [voiceParsed, setVoiceParsed] = useState<{ title: string; date: string; time: string; emoji: string } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // ─── Feature 1: Alert state ──────────────────────────────────────────────────
  const [alertMinutes, setAlertMinutes] = useState<number>(() => {
    return parseInt(localStorage.getItem('abubank-alert-minutes') ?? '60', 10)
  })
  const [activeAlert, setActiveAlert] = useState<{ id: string; title: string; minutesLeft: number } | null>(null)
  const alertedIdsRef = useRef<Set<string>>(new Set())

  // ─── Feature 2: Martita photo ────────────────────────────────────────────────
  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  const reload = useCallback(() => setAppointments(loadAppointments()), [])

  // ─── Feature 1: Alert interval ───────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const allAppts = loadAppointments()
      for (const appt of allAppts) {
        if (alertedIdsRef.current.has(appt.id)) continue
        // Build appointment timestamp
        const apptTime = new Date(`${appt.date}T${appt.time}:00`).getTime()
        if (isNaN(apptTime)) continue
        const diff = apptTime - now
        if (diff > 0 && diff <= alertMinutes * 60_000) {
          alertedIdsRef.current.add(appt.id)
          const minutesLeft = Math.round(diff / 60_000)
          setActiveAlert({ id: appt.id, title: appt.title, minutesLeft })
          soundAlert()
          break // show one alert at a time
        }
      }
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [alertMinutes])

  // Month navigation
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month) // 0=Sun
  const cells: Array<number | null> = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  // Appointment lookups
  const apptsByDate = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const k = a.date
    if (!acc[k]) acc[k] = []
    acc[k]!.push(a)
    return acc
  }, {})

  const selectedAppts = apptsByDate[selectedDay] ?? []

  // Upcoming: next 5 from today
  const upcomingAppts = appointments
    .filter(a => a.date >= today)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time))
    .slice(0, 5)

  function showToast() {
    setToast(true)
    setTimeout(() => setToast(false), 2500)
  }

  function handleManualSave(appt: Omit<Appointment, 'id' | 'color'>) {
    addAppointment(appt)
    reload()
    setShowManual(false)
    playChime()
    soundSuccess()
    showToast()
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
        setVoiceStatus('מעבדת...')
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          const transcribed = await transcribeAudio(blob)
          setVoiceStatus('מנתחת...')
          const parsed = await parseAppointmentText(transcribed)
          setVoiceParsed(parsed)
        } catch {
          setVoiceStatus('שגיאה בזיהוי קול')
          setTimeout(() => setVoiceStatus(''), 3000)
        }
      }
      mr.start()
      setIsRecording(true)
      setVoiceStatus('מקשיבה... (לחצי שוב לסיום)')
    } catch {
      setVoiceStatus('מיקרופון לא זמין')
      setTimeout(() => setVoiceStatus(''), 3000)
    }
  }

  function handleVoiceConfirm() {
    if (!voiceParsed) return
    addAppointment(voiceParsed)
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
    }
  }, [])

  // Hebrew month name for header right side
  const hebrewMonthLabel = formatHebrewMonth(year, month)

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: `linear-gradient(170deg, #060d24 0%, #050A18 40%, ${BG} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Heebo',sans-serif",
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
    >
      {/* ══════════════════════════════════════════
          FEATURE 1: ALERT BANNER
      ══════════════════════════════════════════ */}
      {activeAlert && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(12,10,8,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '2px solid rgba(201,168,76,0.60)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'alertSlideIn 0.35s cubic-bezier(0.34,1.2,0.64,1) both',
        } as React.CSSProperties}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: GOLD,
              fontFamily: "'Heebo',sans-serif",
              direction: 'rtl',
            }}>
              תזכורת: {activeAlert.title} בעוד {activeAlert.minutesLeft} דקות
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            aria-label="סגרי התראה"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.30)',
              color: GOLD,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          HEADER — 72px hero bar
      ══════════════════════════════════════════ */}
      <header style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(6,13,36,0.98) 0%, rgba(5,10,24,0.96) 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: '1px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: `0 1px 0 rgba(201,168,76,0.20), 0 4px 24px rgba(0,0,0,0.40)`,
      }}>
        {/* Back button — right side (RTL) */}
        <button
          type="button"
          onClick={() => setScreen(Screen.Home)}
          aria-label="חזרה לדף הבית"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            padding: '8px 12px 8px 10px',
            color: 'rgba(255,255,255,0.70)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>›</span>
          חזרה
        </button>

        {/* Center — screen title */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '0.04em',
            background: `linear-gradient(135deg, #e8d5a0 0%, ${GOLD} 35%, #f0e0a0 60%, ${GOLD} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1.1,
          } as React.CSSProperties}>לוח שנה</span>
        </div>

        {/* Left — Martita photo + month/year (Feature 2) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {/* Month + year label */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            minWidth: 60,
          }}>
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.70)',
              fontFamily: "'Heebo',sans-serif",
              lineHeight: 1.3,
            }}>{hebrewMonthLabel.split(' ')[0]}</span>
            <span style={{
              fontSize: 12,
              color: TEAL,
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 500,
            }}>{hebrewMonthLabel.split(' ')[1]}</span>
          </div>
          {/* Martita portrait circle */}
          <img
            src={martitaPhoto}
            alt="Martita"
            onError={handleMartitaImgError}
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid rgba(201,168,76,0.45)',
              flexShrink: 0,
              boxShadow: '0 2px 12px rgba(0,0,0,0.40)',
            }}
          />
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MONTH NAVIGATOR
      ══════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 16px 12px',
        flexShrink: 0,
      }}>
        {/* Next month chevron (left side in RTL) */}
        <button
          type="button"
          onClick={nextMonth}
          aria-label="חודש הבא"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >‹</button>

        {/* Month name + year */}
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: '0.03em',
            background: `linear-gradient(135deg, #e8d5a0 0%, ${GOLD} 40%, #f0e0a0 70%, ${GOLD} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } as React.CSSProperties}>{hebrewMonthLabel.split(' ')[0]}</div>
          <div style={{
            fontSize: 14,
            color: TEAL,
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 500,
            marginTop: 2,
          }}>{hebrewMonthLabel.split(' ')[1]}</div>
        </div>

        {/* Prev month chevron (right side in RTL) */}
        <button
          type="button"
          onClick={prevMonth}
          aria-label="חודש קודם"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >›</button>
      </div>

      {/* ══════════════════════════════════════════
          CALENDAR GRID
      ══════════════════════════════════════════ */}
      <div style={{ padding: '0 12px 4px', flexShrink: 0 }}>
        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
          {DAY_HEADERS.map((h, idx) => {
            // Shabbat is last column (index 6 in our Sunday-first array)
            const isShabbat = idx === 6
            return (
              <div key={h} style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: isShabbat ? 'rgba(201,168,76,0.65)' : 'rgba(255,255,255,0.35)',
                padding: '4px 0',
                fontFamily: "'Heebo',sans-serif",
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>{h}</div>
            )
          })}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} style={{ height: 48 }} />
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const isSelected = ds === selectedDay
            const isPast = ds < today
            const dots = apptsByDate[ds] ?? []
            // Shabbat: column position in grid (idx % 7 === 6)
            const isShabbat = idx % 7 === 6
            return (
              <button
                key={ds}
                type="button"
                onClick={() => { setSelectedDay(ds); soundTap() }}
                style={{
                  height: 50,
                  borderRadius: 12,
                  border: isToday
                    ? `1px solid rgba(201,168,76,0.55)`
                    : isSelected
                    ? `1px solid rgba(20,184,166,0.55)`
                    : '1px solid transparent',
                  background: isSelected
                    ? `linear-gradient(135deg, rgba(20,184,166,0.18), rgba(14,160,148,0.12))`
                    : isToday
                    ? 'rgba(201,168,76,0.08)'
                    : isShabbat
                    ? 'rgba(255,240,210,0.03)'
                    : 'transparent',
                  opacity: isPast && !isToday ? 0.45 : 1,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: 0,
                  transition: 'background 0.15s, border-color 0.15s',
                  position: 'relative',
                }}
              >
                {/* Day number circle */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isToday
                    ? `linear-gradient(135deg, ${GOLD}, #e8c76a)`
                    : isSelected
                    ? `linear-gradient(135deg, ${TEAL}, #0ea5a0)`
                    : 'transparent',
                  boxShadow: isToday
                    ? `0 0 16px rgba(201,168,76,0.55), 0 0 6px rgba(201,168,76,0.30)`
                    : isSelected
                    ? `0 0 12px rgba(20,184,166,0.40)`
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: 16,
                    fontWeight: isToday || isSelected ? 700 : 500,
                    color: isToday
                      ? '#0a0a0a'
                      : isSelected
                      ? '#ffffff'
                      : isShabbat
                      ? `rgba(201,168,76,0.80)`
                      : 'rgba(255,255,255,0.82)',
                    fontFamily: "'DM Sans',sans-serif",
                    lineHeight: 1,
                  }}>{day}</span>
                </div>
                {/* Appointment dots */}
                {dots.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 5 }}>
                    {dots.slice(0, 3).map(a => (
                      <div key={a.id} style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: a.color,
                        boxShadow: `0 0 4px ${a.color}88`,
                      }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SELECTED DAY APPOINTMENTS
      ══════════════════════════════════════════ */}
      <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
        {/* Section label */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: `rgba(201,168,76,0.80)`,
            fontFamily: "'DM Sans',sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>אירועים</span>
          <span style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.40)',
            fontFamily: "'Heebo',sans-serif",
          }}>{formatHebrewDate(selectedDay).split(',')[0]}</span>
        </div>

        {selectedAppts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '28px 0',
            color: 'rgba(255,255,255,0.28)',
            fontSize: 14,
            fontFamily: "'Heebo',sans-serif",
            fontStyle: 'italic',
          }}>אין אירועים היום</div>
        ) : (
          selectedAppts.map(a => (
            <ApptCard
              key={a.id}
              appt={a}
              onDelete={() => { soundTap(); deleteAppointment(a.id); reload() }}
            />
          ))
        )}
      </div>

      {/* ══════════════════════════════════════════
          UPCOMING APPOINTMENTS
      ══════════════════════════════════════════ */}
      {upcomingAppts.length > 0 && (
        <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: `rgba(201,168,76,0.80)`,
            fontFamily: "'DM Sans',sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>בקרוב</div>
          {upcomingAppts.map(a => (
            <div key={a.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px 12px 0',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.07)',
              overflow: 'hidden',
              marginBottom: 8,
              position: 'relative',
            } as React.CSSProperties}>
              {/* Left stripe */}
              <div style={{
                width: 3,
                alignSelf: 'stretch',
                background: a.color,
                borderRadius: '0 2px 2px 0',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 20, flexShrink: 0 }}>{a.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: "'DM Sans','Heebo',sans-serif",
                }}>{a.title}</div>
                <div style={{
                  fontSize: 12,
                  color: TEAL,
                  fontFamily: "'DM Sans',sans-serif",
                  marginTop: 2,
                  fontWeight: 500,
                }}>
                  {formatHebrewDate(a.date).split(',')[0]} · {a.time}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { soundTap(); deleteAppointment(a.id); reload() }}
                aria-label="מחקי פגישה"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.30)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════
          ADD APPOINTMENT BUTTON + VOICE + ALERT SETTINGS
      ══════════════════════════════════════════ */}
      <div style={{
        padding: '24px 16px calc(28px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        {/* Feature 1: Alert minutes setting */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(201,168,76,0.15)',
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.65)',
            fontFamily: "'Heebo',sans-serif",
            direction: 'rtl',
          }}>🔔 התראה</span>
          <select
            value={alertMinutes}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              setAlertMinutes(v)
              localStorage.setItem('abubank-alert-minutes', String(v))
            }}
            style={{
              background: 'rgba(201,168,76,0.10)',
              border: '1px solid rgba(201,168,76,0.25)',
              borderRadius: 10,
              color: GOLD,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif",
              padding: '6px 10px',
              cursor: 'pointer',
              outline: 'none',
              colorScheme: 'dark' as React.CSSProperties['colorScheme'],
              direction: 'rtl',
            } as React.CSSProperties}
          >
            <option value={15}>15 דקות לפני</option>
            <option value={30}>30 דקות לפני</option>
            <option value={60}>60 דקות לפני</option>
            <option value={120}>120 דקות לפני</option>
          </select>
        </div>

        {/* Primary add button — full-width gold pill */}
        <button
          type="button"
          onClick={() => { soundOpen(); setShowManual(true) }}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 28,
            border: 'none',
            background: `linear-gradient(135deg, #b8932a 0%, ${GOLD} 25%, #e8c76a 50%, ${GOLD} 75%, #b8932a 100%)`,
            backgroundSize: '200% 100%',
            color: 'rgba(0,0,0,0.85)',
            fontSize: 17,
            fontWeight: 700,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: `0 4px 24px rgba(201,168,76,0.35), 0 2px 8px rgba(0,0,0,0.30)`,
            animation: 'shimmer 3.5s ease-in-out infinite',
          } as React.CSSProperties}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>
          הוספת אירוע
        </button>

        {/* Voice record button */}
        <button
          type="button"
          onClick={handleVoiceRecord}
          style={{
            width: '100%',
            height: 52,
            borderRadius: 26,
            border: isRecording
              ? '1px solid rgba(239,68,68,0.45)'
              : '1px solid rgba(255,255,255,0.10)',
            background: isRecording
              ? 'rgba(239,68,68,0.12)'
              : 'rgba(255,255,255,0.05)',
            color: isRecording ? '#fca5a5' : 'rgba(255,255,255,0.55)',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'Heebo',sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'background 0.2s, border-color 0.2s, color 0.2s',
          }}
        >
          {/* Pulsing red orb when recording */}
          {isRecording ? (
            <span style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#ef4444',
              display: 'inline-block',
              animation: 'pulseOrb 1s ease-in-out infinite',
              flexShrink: 0,
            }} />
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1 }}>🎤</span>
          )}
          {isRecording ? 'לחצי לסיום...' : 'הוספה בקול'}
        </button>
      </div>

      {/* ══════════════════════════════════════════
          VOICE STATUS TOAST
      ══════════════════════════════════════════ */}
      {voiceStatus && !voiceParsed && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
          background: 'rgba(5,10,24,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid rgba(201,168,76,0.30)`,
          borderRadius: 18,
          padding: '12px 22px',
          color: 'rgba(255,255,255,0.88)',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "'Heebo',sans-serif",
          direction: 'rtl',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: `0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(201,168,76,0.12)`,
        } as React.CSSProperties}>
          {voiceStatus}
        </div>
      )}

      {/* ══════════════════════════════════════════
          SAVE SUCCESS TOAST
      ══════════════════════════════════════════ */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
          background: 'rgba(5,10,24,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid rgba(20,184,166,0.40)`,
          borderRadius: 18,
          padding: '12px 22px',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "'Heebo',sans-serif",
          direction: 'rtl',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: `0 8px 32px rgba(0,0,0,0.50), 0 0 16px rgba(20,184,166,0.15)`,
          animation: 'fadeSlideUp 0.30s ease both',
        } as React.CSSProperties}>
          האירוע נשמר
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}
      {showManual && (
        <ManualModal
          defaultDate={selectedDay}
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      )}

      {voiceParsed && (
        <VoiceCard
          parsed={voiceParsed}
          onConfirm={handleVoiceConfirm}
          onCancel={() => { setVoiceParsed(null); setVoiceStatus('') }}
        />
      )}

      {/* ══════════════════════════════════════════
          KEYFRAMES
      ══════════════════════════════════════════ */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulseOrb {
          0%, 100% { opacity: 1;   transform: scale(1);    box-shadow: 0 0 0 0 rgba(239,68,68,0.60); }
          50%       { opacity: 0.7; transform: scale(1.15); box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%;   }
          50%       { background-position: 100% 50%; }
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
      `}</style>
    </div>
  )
}
