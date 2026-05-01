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
import { shapeCreateConfirmReadback } from '../AbuAI/responseShaper'
import { parseCorrection, applyCorrection } from './correctionParser'
import { pickUpdateAck, CANCEL_RESPONSE, UNRELATED_RESPONSE, pickClarifyQuestion } from '../AbuAI/conversationLayer'
import { speak } from '../../services/voice'
import { Toast } from '../../components/Toast'
import { AbuTime } from './AbuTime'
import { PageShell } from '../../components/PageShell'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SeniorButton } from '../../components/SeniorButton'
import { EmptyState } from '../../components/EmptyState'
import { StatusPill } from '../../components/StatusPill'
import { BackButton } from '../../components/BackButton'
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
  const [voiceParsed, setVoiceParsed] = useState<{ title: string; date: string | null; time: string | null; emoji: string; location?: string | null; notes?: string | null; personName?: string | null; ambiguousTime?: boolean; confidence?: number; source?: 'local' | 'llm' | 'fallback' | null } | null>(null)
  const [rawTranscript, setRawTranscript] = useState<string>('')
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'parsing' | 'parsed' | 'error'>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [ambiguousDraft, setAmbiguousDraft] = useState<{ title: string; date: string | null; time: string; emoji: string; location: string | null; notes: string | null } | null>(null)
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [correctionAck, setCorrectionAck] = useState<string | null>(null)
  const correctingRef = useRef(false)
  const lastAckRef = useRef<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
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

  async function handleReparse(transcript: string) {
    if (!transcript.trim()) {
      setVoiceError('אין טקסט לנתח.')
      setVoiceState('error')
      return
    }
    setVoiceError(null)
    setVoiceState('parsing')
    try {
      const parsed = await parseAppointmentText(transcript)
      setRawTranscript(transcript)
      if (parsed.ambiguousTime && parsed.time) {
        setAmbiguousDraft({
          title: parsed.title, date: parsed.date, time: parsed.time,
          emoji: parsed.emoji, location: parsed.location, notes: parsed.notes,
        })
        setVoiceParsed(null)
        setVoiceState('idle')
        return
      }
      setVoiceParsed(parsed)
      setVoiceState('parsed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setVoiceError(`שגיאת ניתוח: ${msg}`)
      setVoiceState('error')
    }
  }

  async function handleVoiceRecord() {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }
    if (voiceStatus) return
    setVoiceError(null)
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
        setVoiceState('transcribing')
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        if (blob.size < 1000) {
          setVoiceError('ההקלטה קצרה מדי. נסי שוב.')
          setVoiceState('error')
          setVoiceStatus('')
          return
        }
        setVoiceStatus('מעבדת...')
        try {
          const transcribed = await transcribeAudio(blob)
          if (!transcribed || !transcribed.trim()) {
            setVoiceError('לא שמעתי כלום')
            setVoiceState('error')
            setVoiceStatus('')
            return
          }
          if (!correctingRef.current) setRawTranscript(transcribed)
          setVoiceState('parsing')

          if (correctingRef.current && voiceParsed) {
            const todayISO = getTodayStr()
            const result = parseCorrection(transcribed, {
              title: voiceParsed.title,
              date: voiceParsed.date,
              time: voiceParsed.time,
              emoji: voiceParsed.emoji,
              location: voiceParsed.location ?? null,
              notes: voiceParsed.notes ?? null,
            }, todayISO)
            correctingRef.current = false
            setIsCorrecting(false)
            setVoiceStatus('')
            if (result.kind === 'cancel') {
              speak(CANCEL_RESPONSE).catch(() => {})
              setCorrectionAck(null)
              setVoiceParsed(null)
              return
            }
            if (result.kind === 'confirm') {
              if (voiceParsed.title && voiceParsed.date && voiceParsed.time) {
                handleVoiceConfirm({
                  title: voiceParsed.title,
                  date: voiceParsed.date,
                  time: voiceParsed.time,
                  emoji: voiceParsed.emoji,
                  ...(voiceParsed.location ? { location: voiceParsed.location } : {}),
                  ...(voiceParsed.notes ? { notes: voiceParsed.notes } : {}),
                })
              }
              return
            }
            if (result.kind === 'clarify') {
              const q = pickClarifyQuestion({
                title: voiceParsed.title,
                date: voiceParsed.date,
                time: voiceParsed.time,
                location: voiceParsed.location ?? null,
              })
              speak(q).catch(() => {})
              setVoiceStatus(q)
              setTimeout(() => setVoiceStatus(''), 4500)
              return
            }
            if (result.kind === 'unrelated') {
              speak(UNRELATED_RESPONSE).catch(() => {})
              setVoiceStatus(UNRELATED_RESPONSE)
              setTimeout(() => setVoiceStatus(''), 3500)
              return
            }
            const ack = pickUpdateAck({ avoid: lastAckRef.current })
            lastAckRef.current = ack
            setCorrectionAck(ack)
            const merged = applyCorrection({
              title: voiceParsed.title,
              date: voiceParsed.date,
              time: voiceParsed.time,
              emoji: voiceParsed.emoji,
              location: voiceParsed.location ?? null,
              notes: voiceParsed.notes ?? null,
            }, result.updates)
            setVoiceParsed({
              ...merged,
              location: merged.location ?? null,
              notes: merged.notes ?? null,
            })
            return
          }

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
          if (parsed.ambiguousTime && parsed.time) {
            setVoiceStatus('')
            setAmbiguousDraft({
              title: parsed.title,
              date: parsed.date,
              time: parsed.time,
              emoji: parsed.emoji,
              location: parsed.location,
              notes: parsed.notes,
            })
            return
          }
          setVoiceParsed(parsed)
          setVoiceState('parsed')
        } catch (e) {
          correctingRef.current = false
          setIsCorrecting(false)
          const msg = e instanceof Error ? e.message : 'לא הצלחתי להבין. נסי שוב לאט יותר'
          setVoiceError(msg)
          setVoiceState('error')
          setVoiceStatus('')
        }
      }
      mr.start()
      setIsRecording(true)
      setVoiceState('recording')
      setVoiceStatus('מקשיבה... (לחצי שוב לסיום)')
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'צריך לאשר גישה למיקרופון'
        : err instanceof DOMException && err.name === 'NotFoundError'
        ? 'לא נמצא מיקרופון'
        : err instanceof Error
        ? `מיקרופון לא זמין: ${err.message}`
        : 'מיקרופון לא זמין — נסי ב-HTTPS'
      setVoiceError(msg)
      setVoiceState('error')
      setVoiceStatus('')
    }
  }

  function handleVoiceConfirm(final: { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }) {
    addAppointment(final)
    reload()
    setVoiceParsed(null)
    setVoiceStatus('')
    setVoiceError(null)
    setVoiceState('idle')
    setCorrectionAck(null)
    lastAckRef.current = null
    playChime()
    soundSuccess()
    showToast()
  }

  function startCorrection() {
    if (isRecording) return
    correctingRef.current = true
    setIsCorrecting(true)
    void handleVoiceRecord()
  }

  function resolveAmbiguity(period: 'pm' | 'am') {
    if (!ambiguousDraft) return
    const [hStr, mStr] = ambiguousDraft.time.split(':')
    let h = parseInt(hStr ?? '0', 10)
    const m = parseInt(mStr ?? '0', 10)
    if (period === 'pm' && h >= 1 && h <= 11) h += 12
    if (period === 'am' && h === 12) h = 0
    const finalTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    setVoiceParsed({
      title: ambiguousDraft.title,
      date: ambiguousDraft.date,
      time: finalTime,
      emoji: ambiguousDraft.emoji,
      location: ambiguousDraft.location,
      notes: ambiguousDraft.notes,
    })
    setAmbiguousDraft(null)
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
    <PageShell scrollable>

      {/* ALERT BANNERS — max 2 stacked */}
      {activeAlerts.length > 0 && (
        <div style={{ position: 'fixed', top: 72, left: 0, right: 0, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeAlerts.map(alert => (
            <div key={alert.id} style={{
              background: 'rgba(12,10,8,0.97)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderBottom: '2px solid rgba(201,168,76,0.60)',
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
              animation: 'alertSlideIn 0.3s ease-out both',
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

      <ScreenHeader
        title="Abu יומן"
        left={<BackButton onPress={() => setScreen(Screen.Home)} />}
        right={<>

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
          <InfoButton
            title="מדריך היומן"
            lines={[
              '🟡 נקודה זהב = אירוע (תור, פגישה)',
              '🩶 נקודה אפורה = אירוע שעבר',
              '🩷 נקודה ורודה = יום הולדת משפחתי',
              '⬜ מסגרת זהב חזקה = היום',
              '⬜ מסגרת זהב עדינה = יום שנבחר',
              '◾ תאים עמומים = ימים שעברו',
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
        </>}
      />

      {/* Alert time selector — inline, minimal */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '4px 16px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: 'rgba(201,168,76,0.55)', fontFamily: "'Heebo',sans-serif" }}>🔔</span>
        <select
          value={alertMinutes}
          onChange={e => { const v = parseInt(e.target.value, 10); setAlertMinutes(v); localStorage.setItem('abubank-alert-minutes', String(v)) }}
          style={{
            background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.18)',
            borderRadius: 8, color: GOLD, fontSize: 13, fontWeight: 600,
            fontFamily: "'DM Sans',sans-serif", padding: '4px 10px',
            cursor: 'pointer', outline: 'none', direction: 'rtl',
          } as React.CSSProperties}
        >
          <option value={15}>15 דק׳</option>
          <option value={30}>30 דק׳</option>
          <option value={60}>60 דק׳</option>
          <option value={120}>120 דק׳</option>
        </select>
      </div>

      {/* ABU TIME — "מה קורה לי?" (includes birthday info via "הדבר הבא") */}
      <AbuTime appointments={appointments} today={today} forceOpen={abuTimeOpen} onToggle={setAbuTimeOpen} />

      {/* MONTH NAVIGATOR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 6px', flexShrink: 0, position: 'relative',
      }}>
        <button
          type="button" onClick={nextMonth} aria-label="חודש הבא"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,250,240,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.22)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.20)',
            color: 'rgba(201,168,76,0.75)', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s',
          } as React.CSSProperties}
        >‹</button>

        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 30, fontWeight: 600, fontStyle: 'italic', letterSpacing: '0.02em',
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
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,250,240,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(201,168,76,0.22)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.20)',
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
        boxShadow: 'inset 0 1px 0 rgba(255,250,240,0.06), 0 4px 24px rgba(0,0,0,0.25), 0 0 40px rgba(201,168,76,0.03)',
        overflow: 'hidden',
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
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Day number */}
                <div style={{
                  width: isToday ? 38 : 34, height: isToday ? 38 : 34, borderRadius: '50%',
                  background: isToday
                    ? 'linear-gradient(135deg, #f0d878 0%, #e8c76a 20%, #D4A853 45%, #C9A84C 65%, #e8c76a 85%, #f0d878 100%)'
                    : 'transparent',
                  backgroundSize: isToday ? '250% 100%' : undefined,
                  animation: isToday ? 'todayShimmer 3s ease infinite' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: isToday ? 21 : 19,
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'rgba(201,168,76,0.70)', fontFamily: "'Heebo',sans-serif" }}>אירועים</span>
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
          <EmptyState icon="✨" message="יום פנוי" detail="לחצי למטה להוסיף אירוע" />
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

      {/* FOOTER — always visible */}
      <div style={{
        position: 'sticky', bottom: 0,
        flexShrink: 0,
        padding: '12px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        background: 'linear-gradient(to top, rgba(5,10,24,0.97) 60%, rgba(5,10,24,0) 100%)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        zIndex: 20,
      } as React.CSSProperties}>
        {/* Status pill — visible only when recording or processing */}
        {(isRecording || (voiceStatus && !voiceParsed && !isRecording)) && (
          isRecording
            ? <StatusPill variant="red" icon="🔴" label="מקשיבה..." />
            : <StatusPill variant="gold" label={voiceStatus} />
        )}

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <SeniorButton variant="ghost" onClick={() => { soundOpen(); setEditingAppt(null); setShowManual(true) }}>
            ＋ הוספה ידנית
          </SeniorButton>

          <button type="button" onClick={handleVoiceRecord}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            aria-label="הוספת אירוע בקול"
            style={{
              width: 60, height: 60, borderRadius: '50%',
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
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
              </svg>
            )}
          </button>
        </div>
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

      {voiceParsed && (() => {
        const baseConfirm = shapeCreateConfirmReadback({
          title: voiceParsed.title,
          personName: voiceParsed.personName ?? null,
          date: voiceParsed.date,
          time: voiceParsed.time,
          location: voiceParsed.location ?? null,
          notes: voiceParsed.notes ?? null,
          ambiguousTime: voiceParsed.ambiguousTime ?? false,
        })
        const fullText = correctionAck ? `${correctionAck}\n${baseConfirm}` : baseConfirm
        return (
          <VoiceCard
            parsed={voiceParsed}
            existingAppts={appointments}
            onConfirm={handleVoiceConfirm}
            onCancel={() => {
              speak(CANCEL_RESPONSE).catch(() => {})
              setVoiceParsed(null)
              setVoiceStatus('')
              setVoiceError(null)
              setVoiceState('idle')
              correctingRef.current = false
              setIsCorrecting(false)
              setCorrectionAck(null)
              lastAckRef.current = null
            }}
            confirmationText={fullText}
            onCorrection={startCorrection}
            isCorrecting={isCorrecting || isRecording}
            rawTranscript={rawTranscript}
            voiceState={voiceState}
            voiceError={voiceError}
            onReparse={handleReparse}
            onSpokenDone={() => {
              // Auto-listen for spoken confirmation only when the card has just
              // been (re)spoken AND we're not already recording or in error.
              if (!isRecording && !correctingRef.current && voiceState !== 'error') {
                startCorrection()
              }
            }}
          />
        )
      })()}

      {ambiguousDraft && (() => {
        const [hStr] = ambiguousDraft.time.split(':')
        const h = parseInt(hStr ?? '0', 10)
        const HOUR_WORDS_HE = ['שתים עשרה','אחת','שתיים','שלוש','ארבע','חמש','שש','שבע','שמונה','תשע','עשר','אחת עשרה']
        const hourWord = HOUR_WORDS_HE[h % 12] ?? String(h)
        return (
          <div onClick={() => setAmbiguousDraft(null)} style={{
            position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.84)',
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
            }}>
              <div data-testid="ambiguity-question" style={{ fontSize: 20, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.5 }}>
                זה {hourWord} בצהריים או {hourWord} בלילה?
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => resolveAmbiguity('am')} style={{
                  flex: 1, padding: '15px', borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
                  color: CREAM, fontSize: 18, fontWeight: 700,
                  fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56,
                }}>בלילה</button>
                <button type="button" onClick={() => resolveAmbiguity('pm')} style={{
                  flex: 1, padding: '15px', borderRadius: 14, border: 'none',
                  background: `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)`,
                  color: 'rgba(0,0,0,0.85)', fontSize: 18, fontWeight: 700,
                  fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 56,
                }}>בצהריים</button>
              </div>
            </div>
          </div>
        )
      })()}

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
    </PageShell>
  )
}
