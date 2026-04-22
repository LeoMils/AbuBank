import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import {
  loadAppointmentsWithFamily,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  playChime,
  parseAppointmentText,
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
import { InfoButton } from '../../components/InfoButton'
import { ApptCard } from './ApptCard'
import { ManualModal } from './ManualModal'
import { VoiceCard } from './VoiceCard'
import { Toast } from '../../components/Toast'
import { AbuTime } from './AbuTime'
import { GOLD, BRIGHT_GOLD, BG, CREAM, DAY_HEADERS, getTodayStr, daysInMonth, firstDayOfMonth, dateStr, getTimeState, type ApptTimeState } from './constants'




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
  const [abuTimeOpen, setAbuTimeOpen] = useState(false)
  const [undoAppt, setUndoAppt] = useState<Appointment | null>(null)
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

  function showToast() { setToast(true) }

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
    setUndoAppt(appt)
  }

  function handleUndo() {
    if (!undoAppt) return
    addAppointment({ title: undoAppt.title, date: undoAppt.date, time: undoAppt.time, emoji: undoAppt.emoji, notes: undoAppt.notes || '' })
    reload()
    setUndoAppt(null)
  }

  async function handleVoiceRecord() {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }
    if (voiceStatus) return
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
          // Check if this is a schedule query ("מה קורה לי?")
          const { isScheduleQuery: isQuery } = await import('./intentParser')
          if (isQuery(transcribed)) {
            setVoiceStatus('')
            setAbuTimeOpen(true)
            return
          }
          setVoiceStatus('מנתחת...')
          const parsed = await parseAppointmentText(transcribed)
          if (parsed.confidence < 0.5) {
            setVoiceStatus('לא הבנתי בדיוק. נסי להגיד יום, שעה ומה האירוע.')
            setTimeout(() => setVoiceStatus(''), 4000)
            return
          }
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
          <InfoButton
            title="מדריך היומן"
            lines={[
              '🟡 נקודה זהב = אירוע (תור, פגישה)',
              '🩶 נקודה אפורה = אירוע שעבר',
              '🩷 נקודה ורודה = יום הולדת משפחתי',
              '⬜ מסגרת זהב חזקה = היום',
              '⬜ מסגרת זהב עדינה = יום שנבחר',
              '📅 תאים עמומים = ימים שעברו',
              '🩵 פס טורקיז = אירוע עכשיו (ברשימת האירועים)',
              '🔔 התראה קולית לפני כל אירוע',
            ]}
            howTo={[
              'לחצי על יום לראות את האירועים שלו',
              'לחצי על המיקרופון ותגידי מה להוסיף',
              'לחצי ＋ להוסיף אירוע בכתב',
              'לחצי על אירוע כדי לערוך אותו',
              'לחצי × כדי למחוק (4 שניות לביטול)',
            ]}
            positionStyle={{ top: 80, left: 14 }}
          />
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

      {/* ABU TIME — "מה קורה לי?" */}
      <AbuTime appointments={appointments} today={today} forceOpen={abuTimeOpen} onToggle={setAbuTimeOpen} />

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
                    ? '2px solid rgba(201,168,76,0.40)'
                    : holiday
                    ? '1px solid rgba(201,168,76,0.18)'
                    : hasBirthday
                    ? '1px solid rgba(244,114,182,0.25)'
                    : '1px solid rgba(255,255,255,0.03)',
                  background: isToday
                    ? 'rgba(201,168,76,0.14)'
                    : isSelected
                    ? 'rgba(201,168,76,0.08)'
                    : holiday
                    ? 'rgba(201,168,76,0.05)'
                    : hasBirthday
                    ? 'rgba(244,114,182,0.07)'
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
                    ? 'inset 0 1px 0 rgba(201,168,76,0.08)'
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
                      : isSelected ? 'rgba(201,168,76,0.95)'
                      : holiday ? GOLD
                      : isShabbat ? 'rgba(201,168,76,0.85)'
                      : isFriday ? 'rgba(245,240,232,0.70)'
                      : 'rgba(245,240,232,0.88)',
                    fontFamily: "'DM Sans',sans-serif", lineHeight: 1,
                    textShadow: isToday ? '0 1px 3px rgba(0,0,0,0.30)' : 'none',
                  }}>{day}</span>
                </div>

                {/* Dot indicator — color-coded by type + past/future */}
                {dots.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 1,
                    background: isPast && !isToday
                      ? 'rgba(245,240,232,0.25)'
                      : hasBirthday ? '#F472B6'
                      : GOLD,
                    boxShadow: isPast && !isToday
                      ? 'none'
                      : hasBirthday
                      ? '0 0 6px rgba(244,114,182,0.50)'
                      : '0 0 4px rgba(201,168,76,0.45)',
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
            const timeState = getTimeState(a.date, a.time, today, Date.now())
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

      <Toast
        message="האירוע נמחק"
        visible={!!undoAppt}
        onDismiss={() => setUndoAppt(null)}
        variant="undo"
        onUndo={handleUndo}
        duration={4000}
      />

      <Toast
        message="האירוע נשמר"
        visible={toast}
        onDismiss={() => setToast(false)}
        variant="success"
      />

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
