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
  getUpcomingBirthdays,
  getMoonPhase,
  getHebrewHoliday,
  APPT_COLORS,
  type Appointment,
} from './service'
import { transcribeAudio, getSupportedMimeType } from '../AbuAI/service'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap, soundSuccess, soundOpen, soundAlert } from '../../services/sounds'
import { InfoButton } from '../../components/InfoButton'
import { injectSharedKeyframes } from '../../design/animations'

const GOLD = '#C9A84C'
const BRIGHT_GOLD = '#D4A853'
const TEAL = '#14b8a6'
const BG = '#0C0A08'
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
        background: 'rgba(255,250,240,0.04)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: hovered
          ? '1px solid rgba(201,168,76,0.30)'
          : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '14px 16px 14px 0',
        position: 'relative',
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered
          ? `0 4px 24px rgba(201,168,76,0.10), inset 0 1px 0 rgba(255,250,240,0.04)`
          : 'inset 0 1px 0 rgba(255,250,240,0.04), 0 2px 16px rgba(0,0,0,0.25)',
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
          color: CREAM,
          fontFamily: "'DM Sans','Heebo',sans-serif",
          marginBottom: 3,
        }}>{appt.title}</div>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: GOLD,
          fontFamily: "'DM Sans',sans-serif",
        }}>{appt.time}</div>
        {appt.notes && (
          <div style={{
            fontSize: 14,
            color: 'rgba(245,240,232,0.55)',
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
          } as React.CSSProperties}>אירוע חדש</span>
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
              fontSize: 12, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase',
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
              fontSize: 12, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
              fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase',
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

        <div>
          <label style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(201,168,76,0.70)',
            fontFamily: "'DM Sans',sans-serif", letterSpacing: '0.05em',
            textTransform: 'uppercase', display: 'block', marginBottom: 10,
          }}>צבע</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {APPT_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorIdx(i)}
                aria-label={`צבע ${i + 1}`}
                style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'transparent',
                  border: 'none', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
                }}
              >
                <span style={{
                  display: 'block', width: 28, height: 28, borderRadius: '50%', background: c,
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
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.84)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      } as React.CSSProperties}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%', maxWidth: 480,
          background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
          border: '1px solid rgba(201,168,76,0.32)',
          borderBottom: 'none',
          borderRadius: '24px 24px 0 0',
          padding: 'calc(32px + env(safe-area-inset-bottom, 0px)) 20px 28px',
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 -8px 40px rgba(201,168,76,0.12), 0 -2px 0 rgba(201,168,76,0.18)',
          animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
        }}
      >
        <div style={{
          fontSize: 18, fontWeight: 700, color: CREAM,
          fontFamily: "'Heebo',sans-serif", textAlign: 'center',
        }}>
          <span style={{ marginInlineEnd: 8, fontSize: 20 }}>🎤</span>
          שמעתי נכון?
        </div>

        <div style={{
          background: 'rgba(255,250,240,0.04)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(201,168,76,0.25)', borderRadius: 16,
          padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'center',
          boxShadow: '0 0 24px rgba(201,168,76,0.07), inset 0 1px 0 rgba(255,250,240,0.04)',
        } as React.CSSProperties}>
          <span style={{ fontSize: 38, flexShrink: 0 }}>{parsed.emoji}</span>
          <div>
            <div style={{
              fontSize: 19, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif",
            }}>{parsed.title}</div>
            <div style={{
              fontSize: 14, color: TEAL, fontFamily: "'DM Sans',sans-serif",
              marginTop: 5, fontWeight: 600,
            }}>
              {formatHebrewDate(parsed.date)} · {parsed.time}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '15px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.50)',
              fontSize: 16, fontWeight: 600, fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer', minHeight: 56,
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 2, padding: '15px', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`,
              color: 'rgba(0,0,0,0.85)',
              fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: 'pointer', boxShadow: '0 4px 20px rgba(201,168,76,0.40)', minHeight: 56,
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

  // ─── v17.3: Premium gimmicks ────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 6)  return { text: 'לילה טוב, Martita 🌙', color: 'rgba(147,130,220,0.85)' }
    if (h < 12) return { text: 'בוקר טוב, Martita ☀️', color: 'rgba(212,168,83,0.90)' }
    if (h < 17) return { text: 'צהריים טובים, Martita 🌤️', color: 'rgba(20,184,166,0.90)' }
    if (h < 21) return { text: 'ערב טוב, Martita 🌅', color: 'rgba(251,146,60,0.90)' }
    return { text: 'לילה טוב, Martita 🌙', color: 'rgba(147,130,220,0.85)' }
  }, [])

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(appointments, 30), [appointments])
  const nextBirthday = upcomingBirthdays[0] ?? null

  // Month slide animation
  const [slideDir, setSlideDir] = useState<'none' | 'left' | 'right'>('none')
  const [slideKey, setSlideKey] = useState(0)

  const reload = useCallback(() => setAppointments(loadAppointments()), [])

  // ─── Feature 1: Alert interval ───────────────────────────────────────────────
  useEffect(() => { injectSharedKeyframes() }, [])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const allAppts = loadAppointments()
      for (const appt of allAppts) {
        if (alertedIdsRef.current.has(appt.id)) continue
        const apptTime = new Date(`${appt.date}T${appt.time}:00`).getTime()
        if (isNaN(apptTime)) continue
        const diff = apptTime - now
        if (diff > 0 && diff <= alertMinutes * 60_000) {
          alertedIdsRef.current.add(appt.id)
          const minutesLeft = Math.round(diff / 60_000)
          setActiveAlert({ id: appt.id, title: appt.title, minutesLeft })
          soundAlert()
          break
        }
      }
    }
    check()
    const interval = setInterval(check, 60_000)
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

  const hebrewMonthLabel = formatHebrewMonth(year, month)

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
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

      {/* ALERT BANNER */}
      {activeAlert && (
        <div style={{
          position: 'fixed', top: 72, left: 0, right: 0, zIndex: 100,
          background: 'rgba(12,10,8,0.97)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '2px solid rgba(201,168,76,0.60)',
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
          animation: 'alertSlideIn 0.35s cubic-bezier(0.34,1.2,0.64,1) both',
        } as React.CSSProperties}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>🔔</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: 15, fontWeight: 700, color: GOLD,
              fontFamily: "'Heebo',sans-serif", direction: 'rtl',
            }}>
              תזכורת: {activeAlert.title} בעוד {activeAlert.minutesLeft} דקות
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveAlert(null)}
            aria-label="סגרי התראה"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.30)',
              color: GOLD, fontSize: 18, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >×</button>
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
            width: 56, height: 44,
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
          <span style={{ fontSize: 13 }}>חזרה</span>
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

        {/* Left side: Martita photo + InfoButton */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <img
            src={martitaPhoto}
            alt="Martita"
            onError={handleMartitaImgError}
            style={{
              width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(201,168,76,0.50), 0 2px 14px rgba(0,0,0,0.45)',
            }}
          />
        </div>

        {/* Bottom glow strip */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(201,168,76,0.35) 30%, rgba(212,168,83,0.50) 50%, rgba(201,168,76,0.35) 70%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </header>

      <InfoButton
        title="Abu יומן"
        lines={['יומן אישי עם תזכורות. הוסיפי אירועים ביד או בקול.', 'התראות אוטומטיות לפני כל אירוע.']}
        howTo={['לחצי על יום בלוח לראות אירועים', 'לחצי על מיקרופון לתיאור קולי של האירוע', 'לחצי הוספה ידנית להזנה ידנית', 'שנות זמן ההתראה בתחתית המסך']}
        position="top-left"
      />

      {/* v17.3: Greeting + Birthday Countdown */}
      <div style={{ textAlign: 'center', padding: '8px 16px 0', flexShrink: 0 }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: greeting.color,
          fontFamily: "'Heebo',sans-serif",
        }}>{greeting.text}</span>
      </div>
      {nextBirthday && (
        <div style={{
          margin: '4px 16px 0', padding: '7px 14px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(167,139,250,0.08) 100%)',
          border: '1px solid rgba(244,114,182,0.22)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          animation: 'fadeSlideUp 0.4s ease 0.15s both',
        }}>
          <span style={{ fontSize: 18 }}>🎂</span>
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#F472B6',
            fontFamily: "'Heebo',sans-serif",
          }}>
            {nextBirthday.daysUntil === 0
              ? `!היום יום ההולדת של ${nextBirthday.title} 🎉`
              : `${nextBirthday.daysUntil} ימים ליום ההולדת של ${nextBirthday.title}`}
          </span>
        </div>
      )}

      {/* MONTH NAVIGATOR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 16px 14px', flexShrink: 0,
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
            fontSize: 42, fontWeight: 600, fontStyle: 'italic', letterSpacing: '0.02em',
            background: `linear-gradient(135deg, #e8d5a0 0%, ${BRIGHT_GOLD} 35%, #f0e0a0 65%, ${GOLD} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            lineHeight: 1.1,
          } as React.CSSProperties}>{hebrewMonthLabel.split(' ')[0]}</div>
          <div style={{
            fontSize: 14, color: 'rgba(201,168,76,0.55)',
            fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginTop: 2,
          }}>{hebrewMonthLabel.split(' ')[1]}</div>
        </div>

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

      {/* CALENDAR GRID — with slide animation */}
      <div key={slideKey} style={{
        margin: '0 12px', padding: '12px 8px',
        animation: slideDir === 'left' ? 'slideFromLeft 0.22s ease both'
                 : slideDir === 'right' ? 'slideFromRight 0.22s ease both'
                 : 'none',
        background: 'rgba(255,250,240,0.02)',
        borderRadius: 16, border: '1px solid rgba(201,168,76,0.10)', flexShrink: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
          {DAY_HEADERS.map((h, idx) => (
            <div key={h} style={{
              textAlign: 'center', fontSize: 12, fontWeight: 600,
              color: idx === 6 ? 'rgba(201,168,76,0.85)' : 'rgba(201,168,76,0.50)',
              padding: '4px 0', fontFamily: "'Heebo',sans-serif",
              letterSpacing: '1px',
              borderBottom: idx === 6 ? '1.5px solid rgba(201,168,76,0.25)' : 'none',
            }}>{idx === 6 ? `🕯️ ${h}` : h}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} style={{ minHeight: 48 }} />
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const isSelected = ds === selectedDay && !isToday
            const isPast = ds < today
            const dots = apptsByDate[ds] ?? []
            const isShabbat = idx % 7 === 6
            const holiday = getHebrewHoliday(ds)
            const moon = getMoonPhase(year, month, day)
            return (
              <button
                key={ds}
                type="button"
                onClick={() => { setSelectedDay(ds); soundTap() }}
                style={{
                  minHeight: 48, borderRadius: 14, position: 'relative',
                  border: isToday
                    ? '1.5px solid rgba(201,168,76,0.60)'
                    : isSelected
                    ? '1.5px solid rgba(20,184,166,0.50)'
                    : '1px solid transparent',
                  background: isToday
                    ? 'linear-gradient(145deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.04) 100%)'
                    : isSelected
                    ? 'linear-gradient(145deg, rgba(20,184,166,0.15) 0%, rgba(20,184,166,0.05) 100%)'
                    : dots.length > 0
                    ? 'rgba(255,250,240,0.025)'
                    : isShabbat ? 'rgba(201,168,76,0.02)' : 'transparent',
                  opacity: isPast && !isToday ? 0.4 : 1,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 2, padding: '2px 0',
                  transition: 'all 0.15s ease',
                  boxShadow: isToday
                    ? undefined  // handled by animation
                    : isSelected
                    ? '0 0 0 3px rgba(20,184,166,0.08)'
                    : 'none',
                }}
              >
                {/* Moon phase — top-left corner */}
                <span style={{
                  position: 'absolute', top: 1, left: 2,
                  fontSize: 7, lineHeight: 1, opacity: 0.40,
                  pointerEvents: 'none',
                }}>{moon}</span>

                {/* Day number circle */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isToday
                    ? 'linear-gradient(135deg, #e8c76a 0%, #D4A853 30%, #C9A84C 60%, #e8c76a 100%)'
                    : 'transparent',
                  backgroundSize: isToday ? '200% 100%' : undefined,
                  animation: isToday ? 'todayShimmer 3s ease infinite, todayHalo 3s ease-in-out infinite' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: isToday ? 18 : 17,
                    fontWeight: isToday ? 800 : isSelected ? 700 : 500,
                    color: isToday ? '#0C0A08'
                      : isSelected ? TEAL
                      : isShabbat ? 'rgba(201,168,76,0.80)'
                      : 'rgba(245,240,232,0.85)',
                    fontFamily: "'DM Sans',sans-serif", lineHeight: 1,
                    textShadow: isToday ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                  }}>{day}</span>
                </div>

                {/* Holiday marker */}
                {holiday && (
                  <span style={{
                    fontSize: 7, fontWeight: 700, color: GOLD,
                    fontFamily: "'Heebo',sans-serif",
                    lineHeight: 1, marginTop: -2, opacity: 0.85,
                  }}>✡</span>
                )}

                {/* Event color bars */}
                {dots.length > 0 && !holiday && (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', height: 4, marginTop: -1 }}>
                    {dots.slice(0, 3).map(a => (
                      <div key={a.id} style={{
                        width: dots.length === 1 ? 14 : dots.length === 2 ? 10 : 7,
                        height: 3, borderRadius: 2,
                        background: a.color,
                        boxShadow: `0 0 4px ${a.color}55`,
                      }} />
                    ))}
                    {dots.length > 3 && (
                      <div style={{
                        width: 4, height: 3, borderRadius: 2,
                        background: 'rgba(245,240,232,0.30)',
                      }} />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* SELECTED DAY APPOINTMENTS */}
      <div style={{ padding: '22px 16px 0', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 700, color: 'rgba(201,168,76,0.60)',
            fontFamily: "'DM Sans',sans-serif", letterSpacing: '1.5px', textTransform: 'uppercase',
          }}>אירועים</span>
          <span style={{
            fontSize: 13, color: 'rgba(245,240,232,0.40)', fontFamily: "'Heebo',sans-serif",
          }}>{formatHebrewDate(selectedDay).split(',')[0]}</span>
        </div>

        {selectedAppts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '28px 0',
            color: 'rgba(201,168,76,0.35)', fontSize: 15,
            fontFamily: "'Heebo',sans-serif", fontStyle: 'italic',
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

      {/* UPCOMING APPOINTMENTS */}
      {upcomingAppts.length > 0 && (
        <div style={{ padding: '20px 16px 0', flexShrink: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'rgba(201,168,76,0.60)',
            fontFamily: "'DM Sans',sans-serif", letterSpacing: '1.5px',
            textTransform: 'uppercase', marginBottom: 14,
          }}>בקרוב</div>
          {upcomingAppts.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px 12px 0', borderRadius: 12,
              background: 'rgba(255,250,240,0.03)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
              marginBottom: 8, position: 'relative',
              boxShadow: 'inset 0 1px 0 rgba(255,250,240,0.03)',
            } as React.CSSProperties}>
              <div style={{
                width: 3, alignSelf: 'stretch', background: a.color,
                borderRadius: '0 2px 2px 0', flexShrink: 0,
              }} />
              <span style={{ fontSize: 20, flexShrink: 0 }}>{a.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: CREAM,
                  fontFamily: "'DM Sans','Heebo',sans-serif",
                }}>{a.title}</div>
                <div style={{
                  fontSize: 12, color: TEAL, fontFamily: "'DM Sans',sans-serif",
                  marginTop: 2, fontWeight: 500,
                }}>
                  {formatHebrewDate(a.date).split(',')[0]} · {a.time}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { soundTap(); deleteAppointment(a.id); reload() }}
                aria-label="מחקי פגישה"
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.30)', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* ALERT SETTINGS ROW */}
      <div style={{
        margin: '20px 16px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 44, borderRadius: 12,
        background: 'rgba(255,250,240,0.02)', border: '1px solid rgba(201,168,76,0.12)',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 600, color: 'rgba(245,240,232,0.55)',
          fontFamily: "'Heebo',sans-serif", direction: 'rtl',
        }}>🔔 התראה</span>
        <select
          value={alertMinutes}
          onChange={e => {
            const v = parseInt(e.target.value, 10)
            setAlertMinutes(v)
            localStorage.setItem('abubank-alert-minutes', String(v))
          }}
          style={{
            background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 10, color: GOLD, fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans',sans-serif", padding: '5px 10px',
            cursor: 'pointer', outline: 'none',
            colorScheme: 'dark' as React.CSSProperties['colorScheme'], direction: 'rtl',
          } as React.CSSProperties}
        >
          <option value={15}>15 דקות לפני</option>
          <option value={30}>30 דקות לפני</option>
          <option value={60}>60 דקות לפני</option>
          <option value={120}>120 דקות לפני</option>
        </select>
      </div>

      {/* HERO VOICE BUTTON */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '20px 0 calc(28px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0, marginTop: 'auto',
      }}>
        <button
          type="button"
          onClick={handleVoiceRecord}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: isRecording
              ? 'linear-gradient(145deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(145deg, #D4A853 0%, #C9A84C 45%, #B8912A 100%)',
            border: 'none',
            boxShadow: isRecording
              ? '0 0 0 8px rgba(239,68,68,0.12), 0 0 0 16px rgba(239,68,68,0.06), 0 8px 32px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,180,180,0.25)'
              : '0 0 0 8px rgba(201,168,76,0.10), 0 0 0 16px rgba(201,168,76,0.05), 0 8px 32px rgba(201,168,76,0.40), inset 0 1px 0 rgba(255,240,180,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease',
            animation: isRecording ? 'recordPulse 1.2s ease-in-out infinite' : 'none',
          }}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          aria-label="הוספת אירוע בקול"
        >
          {isRecording ? (
            <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none"
              stroke="white" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="11" rx="3"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          )}
        </button>

        <span style={{
          fontSize: 14, fontWeight: 700,
          color: isRecording ? 'rgba(252,165,165,0.90)' : 'rgba(201,168,76,0.85)',
          fontFamily: "'Heebo',sans-serif", letterSpacing: '0.5px', transition: 'color 0.2s',
        }}>
          {isRecording ? 'מקשיבה... (לחצי לסיום)' : 'ספרי לי על האירוע'}
        </span>

        <button
          type="button"
          onClick={() => { soundOpen(); setShowManual(true) }}
          style={{
            marginTop: 4, padding: '8px 20px', borderRadius: 20,
            background: 'transparent', border: '1px solid rgba(201,168,76,0.28)',
            color: 'rgba(245,240,232,0.55)', fontSize: 13,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            minHeight: 44, minWidth: 120,
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >＋ הוספה ידנית</button>
      </div>

      {/* VOICE STATUS TOAST */}
      {voiceStatus && !voiceParsed && !isRecording && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, pointerEvents: 'none',
          background: 'rgba(12,10,8,0.94)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(201,168,76,0.30)', borderRadius: 18, padding: '12px 22px',
          color: 'rgba(245,240,232,0.88)', fontSize: 15, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif", direction: 'rtl', whiteSpace: 'nowrap',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,168,76,0.12)',
        } as React.CSSProperties}>
          {voiceStatus}
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
        @keyframes todayHalo {
          0%, 100% { box-shadow: 0 0 0 3px rgba(201,168,76,0.25), 0 0 12px rgba(201,168,76,0.15), 0 0 0 6px rgba(201,168,76,0.08); }
          50%      { box-shadow: 0 0 0 4px rgba(201,168,76,0.40), 0 0 20px rgba(201,168,76,0.30), 0 0 0 8px rgba(201,168,76,0.12); }
        }
        @keyframes slideFromLeft {
          from { transform: translateX(-25px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideFromRight {
          from { transform: translateX(25px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(870px) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
