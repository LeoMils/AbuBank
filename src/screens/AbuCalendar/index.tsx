import { useState, useEffect, useRef, useCallback } from 'react'
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

const GOLD = '#C9A84C'
const TEAL = '#14b8a6'
const BG = '#050A18'

// Hebrew short day names — Sunday first (matching JS getDay())
const DAY_HEADERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

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
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: `${appt.color}18`,
      border: `1px solid ${appt.color}44`,
      borderLeft: `4px solid ${appt.color}`,
      borderRadius: 14, padding: '14px 12px',
      position: 'relative',
      marginBottom: 8,
    }}>
      <span style={{ fontSize: 28, lineHeight: 1 }}>{appt.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.95)',
          fontFamily: "'Heebo',sans-serif",
        }}>{appt.title}</div>
        <div style={{
          fontSize: 15, color: 'rgba(255,255,255,0.60)',
          fontFamily: "'Heebo',sans-serif", marginTop: 2,
        }}>{appt.time}</div>
        {appt.notes && (
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.45)',
            fontFamily: "'Heebo',sans-serif", marginTop: 4,
          }}>{appt.notes}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="מחקי פגישה"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: 'none',
          color: 'rgba(255,255,255,0.50)', fontSize: 16,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
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

  const chosenColor = APPT_COLORS[colorIdx] ?? APPT_COLORS[0]!

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%', maxWidth: 480,
          background: 'linear-gradient(180deg, #0d1832, #07102a)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{
          fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
          fontFamily: "'Heebo',sans-serif", textAlign: 'center',
        }}>📝 פגישה חדשה</div>

        <input
          type="text"
          placeholder="שם הפגישה..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', fontSize: 18, fontFamily: "'Heebo',sans-serif",
            colorScheme: 'dark', boxSizing: 'border-box',
            outline: 'none', direction: 'rtl',
          }}
          autoFocus
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif" }}>תאריך</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '12px 10px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontSize: 16, fontFamily: "'Heebo',sans-serif",
                colorScheme: 'dark', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif" }}>שעה</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                width: '100%', padding: '12px 10px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontSize: 16, fontFamily: "'Heebo',sans-serif",
                colorScheme: 'dark', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: "'Heebo',sans-serif", display: 'block', marginBottom: 8 }}>צבע</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {APPT_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorIdx(i)}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: c, border: 'none',
                  cursor: 'pointer',
                  outline: colorIdx === i ? `3px solid white` : '3px solid transparent',
                  outlineOffset: 2,
                  boxShadow: colorIdx === i ? `0 0 12px ${c}88` : 'none',
                  transition: 'outline 0.15s, box-shadow 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="הערות (אופציונלי)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', fontSize: 16, fontFamily: "'Heebo',sans-serif",
            colorScheme: 'dark', boxSizing: 'border-box',
            outline: 'none', direction: 'rtl',
          }}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim()}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: title.trim()
              ? `linear-gradient(135deg, ${chosenColor}, ${chosenColor}bb)`
              : 'rgba(255,255,255,0.08)',
            color: title.trim() ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.25)',
            fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          שמרי פגישה
        </button>
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
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        dir="rtl"
        style={{
          width: '100%', maxWidth: 480,
          background: 'linear-gradient(180deg, #0d1832, #07102a)',
          border: '1px solid rgba(196,181,253,0.20)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{
          fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.92)',
          fontFamily: "'Heebo',sans-serif", textAlign: 'center',
        }}>🎤 שמעתי נכון?</div>

        <div style={{
          background: 'rgba(196,181,253,0.08)',
          border: '1px solid rgba(196,181,253,0.25)',
          borderRadius: 14, padding: '16px 20px',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          <span style={{ fontSize: 36 }}>{parsed.emoji}</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.95)', fontFamily: "'Heebo',sans-serif" }}>{parsed.title}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>
              {formatHebrewDate(parsed.date)} · {parsed.time}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px', borderRadius: 12, border: 'none',
              background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)',
              fontSize: 17, fontWeight: 600, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            }}
          >ביטול</button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 2, padding: '14px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #A78BFA, #7c3aed)',
              color: 'white', fontSize: 17, fontWeight: 700,
              fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
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

  const reload = useCallback(() => setAppointments(loadAppointments()), [])

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
  // Pad to complete weeks
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
    showToast()
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  return (
    <div
      dir="rtl"
      style={{
        height: '100%', width: '100%', overflowY: 'auto', overflowX: 'hidden',
        background: BG,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Heebo',sans-serif",
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* ─── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(7,13,30,0.95), rgba(5,10,24,0.90))',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => setScreen(Screen.Home)}
          aria-label="חזרי לדף הבית"
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.80)', fontSize: 20,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, direction: 'ltr' }}>
          <span style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 30, fontWeight: 600, letterSpacing: '2px',
            background: 'linear-gradient(135deg, #5EEAD4 0%, #14B8A6 50%, #5EEAD4 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          } as React.CSSProperties}>Abu</span>
          <span style={{
            fontFamily: "'Heebo',sans-serif",
            fontSize: 26, fontWeight: 700, letterSpacing: '1px',
            background: 'linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 40%, #a78bfa 70%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          } as React.CSSProperties}> יומן</span>
        </div>

        {/* Add button */}
        <button
          type="button"
          onClick={() => setShowManual(true)}
          aria-label="הוסיפי פגישה"
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #c4b5fd44, #7c3aed44)',
            color: '#c4b5fd', fontSize: 24,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </header>

      {/* ─── MONTH NAVIGATOR ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px 8px',
        flexShrink: 0,
      }}>
        <button type="button" onClick={nextMonth} aria-label="חודש הבא"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.60)', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>›</button>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.92)', fontFamily: "'Heebo',sans-serif" }}>
          {formatHebrewMonth(year, month)}
        </span>
        <button type="button" onClick={prevMonth} aria-label="חודש קודם"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.60)', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>‹</button>
      </div>

      {/* ─── CALENDAR GRID ──────────────────────────────────────────────────── */}
      <div style={{ padding: '0 12px', flexShrink: 0 }}>
        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
          {DAY_HEADERS.map(h => (
            <div key={h} style={{
              textAlign: 'center', fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.40)', padding: '4px 0',
              fontFamily: "'Heebo',sans-serif",
            }}>{h}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} style={{ height: 44 }} />
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const isSelected = ds === selectedDay
            const dots = apptsByDate[ds] ?? []
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setSelectedDay(ds)}
                style={{
                  height: 44, borderRadius: 10, border: 'none',
                  background: isSelected
                    ? 'rgba(20,184,166,0.15)'
                    : isToday
                    ? 'rgba(201,168,76,0.12)'
                    : 'transparent',
                  outline: isSelected ? `2px solid ${TEAL}` : 'none',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  position: 'relative',
                  padding: 0,
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: isToday ? GOLD : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: 15, fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#000' : isSelected ? TEAL : 'rgba(255,255,255,0.82)',
                    fontFamily: "'Heebo',sans-serif",
                  }}>{day}</span>
                </div>
                {/* Appointment dots */}
                {dots.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {dots.slice(0, 3).map(a => (
                      <div key={a.id} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: a.color,
                      }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── SELECTED DAY APPOINTMENTS ──────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
          marginBottom: 10, fontFamily: "'Heebo',sans-serif",
        }}>
          {formatHebrewDate(selectedDay)}
        </div>

        {selectedAppts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'rgba(255,255,255,0.35)', fontSize: 16,
            fontFamily: "'Heebo',sans-serif",
          }}>אין פגישות ביום זה 😊</div>
        ) : (
          selectedAppts.map(a => (
            <ApptCard
              key={a.id}
              appt={a}
              onDelete={() => { deleteAppointment(a.id); reload() }}
            />
          ))
        )}
      </div>

      {/* ─── UPCOMING APPOINTMENTS ──────────────────────────────────────────── */}
      {upcomingAppts.length > 0 && (
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
            marginBottom: 10, fontFamily: "'Heebo',sans-serif",
          }}>🗓️ בקרוב</div>
          {upcomingAppts.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: `${a.color}12`,
              border: `1px solid ${a.color}30`,
              borderRight: `3px solid ${a.color}`,
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 22 }}>{a.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.88)', fontFamily: "'Heebo',sans-serif" }}>{a.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontFamily: "'Heebo',sans-serif" }}>
                  {formatHebrewDate(a.date)} · {a.time}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { deleteAppointment(a.id); reload() }}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: 'none',
                  color: 'rgba(255,255,255,0.35)', fontSize: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* ─── ADD BUTTONS ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: 12, flexShrink: 0, marginTop: 'auto',
      }}>
        <button
          type="button"
          onClick={() => setShowManual(true)}
          style={{
            flex: 1, padding: '15px 8px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, rgba(196,181,253,0.15), rgba(124,58,237,0.20))',
            border2: '1px solid rgba(196,181,253,0.25)',
            color: '#c4b5fd', fontSize: 15, fontWeight: 700,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          } as React.CSSProperties}
        >
          <span style={{ fontSize: 22 }}>📝</span>
          הוסיפי ידנית
        </button>

        <button
          type="button"
          onClick={handleVoiceRecord}
          style={{
            flex: 1, padding: '15px 8px', borderRadius: 14, border: 'none',
            background: isRecording
              ? 'linear-gradient(135deg, rgba(239,68,68,0.30), rgba(185,28,28,0.30))'
              : 'linear-gradient(135deg, rgba(196,181,253,0.15), rgba(124,58,237,0.20))',
            color: isRecording ? '#fca5a5' : '#c4b5fd',
            fontSize: 15, fontWeight: 700,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          } as React.CSSProperties}
        >
          <span style={{ fontSize: 22, animation: isRecording ? 'pulse 1s infinite' : 'none' }}>🎤</span>
          {isRecording ? 'עוצרת...' : 'הוסיפי בקול'}
        </button>
      </div>

      {/* Voice status */}
      {voiceStatus && !voiceParsed && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, pointerEvents: 'none',
          background: 'rgba(124,58,237,0.20)',
          border: '1px solid rgba(196,181,253,0.35)',
          backdropFilter: 'blur(8px)', borderRadius: 16,
          padding: '12px 22px',
          color: 'rgba(255,255,255,0.92)', fontSize: 15, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif", direction: 'rtl',
          whiteSpace: 'nowrap', textAlign: 'center',
        }}>
          {voiceStatus}
        </div>
      )}

      {/* Save toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, pointerEvents: 'none',
          background: 'rgba(52,211,153,0.18)',
          border: '1px solid rgba(52,211,153,0.45)',
          backdropFilter: 'blur(8px)', borderRadius: 16,
          padding: '12px 22px',
          color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 600,
          fontFamily: "'Heebo',sans-serif", direction: 'rtl',
          whiteSpace: 'nowrap', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        }}>
          📅 הפגישה נשמרה!
        </div>
      )}

      {/* Modals */}
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

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}
