import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import {
  loadAppointmentsWithFamily,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  playChime,
  formatHebrewMonth,
  formatShortHebrewDate,
  getHebrewHoliday,
  createAppointmentSafe,
  formatCreatedConfirmation,
  formatCreateFailure,
  type Appointment,
} from './service'
import { APP_VERSION } from '../../version'
import { DayDetailSheet } from './DayDetailSheet'
// ── ONE VOICE ENGINE (D7): the calendar mic ROUTES to Abu AI — the single speech
// engine. The former in-screen STT capture (mic recording + calendar transcription +
// the parser action-switch + the voice reminder-confirm branch) was REMOVED so a
// second speech engine can never exist in this product. Abu AI's cognitiveRuntime
// owns appointment create/read/modify + reminders on the SAME AbuCalendar/service
// store. Enforced by singleVoiceEntry.test.ts (a mutation mutant proves its teeth).
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap, soundOpen, soundAlert, soundSaveCalendar } from '../../services/sounds'
import { injectSharedKeyframes } from '../../design/animations'
import { InfoButton } from '../../components/InfoButton'
import { ApptCard } from './ApptCard'
import { ManualModal } from './ManualModal'
import { ReminderDueEngine, ReminderBoard, registerNotificationTapHandler } from './reminders'
import { Toast } from '../../components/Toast'
import { AbuTime } from './AbuTime'
import { PageShell } from '../../components/PageShell'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SeniorButton } from '../../components/SeniorButton'
import { EmptyState } from '../../components/EmptyState'
import { BackButton } from '../../components/BackButton'
import { PAGE_BG } from '../../design/theme'
import { AbuLogo } from '../../design/logos/AbuLogo'
import { GOLD, BRIGHT_GOLD, BG, CREAM, TEXT_SECONDARY, DAY_HEADERS, getTodayStr, daysInMonth, firstDayOfMonth, dateStr, getTimeState, type ApptTimeState } from './constants'




// ─── Main AbuCalendar Screen ───────────────────────────────────────────────────
export function AbuCalendar() {
  const setScreen = useAppStore(s => s.setScreen)
  const today = getTodayStr()
  const todayDate = new Date()

  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState(today)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadAppointmentsWithFamily(todayDate.getFullYear()))
  const [showManual, setShowManual] = useState(false)
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [toast, setToast] = useState(false)
  // P0 — structured toast message so the user sees title/date/time
  // (or the honest failure copy) instead of a generic "saved" string.
  const [toastMessage, setToastMessage] = useState<string>('האירוע נשמר')
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success')
  const [abuTimeOpen, setAbuTimeOpen] = useState(false)
  const [undoAppt, setUndoAppt] = useState<Appointment | null>(null)

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

  // Register native notification tap handler — opens the reminder when
  // user taps the lock-screen notification. No-op on web.
  useEffect(() => {
    registerNotificationTapHandler((_reminderId) => {
      // Navigate to calendar screen — the ReminderDueEngine will show
      // the popup for any due reminders on next checkDue cycle (30s).
      // Force an immediate check by triggering a state update.
      setSelectedDay(new Date().toISOString().slice(0, 10))
    })
  }, [])
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

  // P0 — show a specific success message (title + date + time) or an
  // honest failure message. Variant flips colour from gold → red.
  function showSuccessToast(message: string) {
    setToastMessage(message)
    setToastVariant('success')
    setToast(true)
  }
  function showFailureToast(message: string) {
    setToastMessage(message)
    setToastVariant('error')
    setToast(true)
  }

  // P0 — language detection for confirmation/failure copy. Defaults to
  // Hebrew (Martita's primary). Spanish/English detection is intentionally
  // narrow: only fires when the input clearly looks ES/EN.
  function detectConfirmationLang(text: string): 'he' | 'es' | 'en' {
    const t = text.trim()
    if (!t) return 'he'
    if (/[֐-׿]/.test(t)) return 'he'
    if (/[áéíóúñ¿¡]/i.test(t) || /\b(reuni[oó]n|m[eé]dico|ma[ñn]ana|hoy|a las)\b/i.test(t)) return 'es'
    if (/\b(meeting|tomorrow|today|at \d)\b/i.test(t)) return 'en'
    return 'he'
  }

  function handleManualSave(appt: Omit<Appointment, 'id' | 'color'>) {
    if (editingAppt) {
      // Editing path is unchanged: we already have a valid event id.
      updateAppointment(editingAppt.id, appt)
      reload()
      setShowManual(false)
      setEditingAppt(null)
      playChime()
      soundSaveCalendar()
      showToast()
      return
    }
    // P0 — single safe-create path. Validates, persists, round-trips.
    const result = createAppointmentSafe(appt)
    if (!result.ok) {
      const lang = detectConfirmationLang(appt.title)
      showFailureToast(formatCreateFailure(result.code, lang))
      return
    }
    reload()
    // P0.1 visibility fix — jump the calendar view to the new event's
    // date so the user can see what was created.
    setSelectedDay(result.appointment.date)
    setShowManual(false)
    setEditingAppt(null)
    playChime()
    soundSaveCalendar()
    const lang = detectConfirmationLang(appt.title)
    showSuccessToast(formatCreatedConfirmation(
      { title: result.appointment.title, date: result.appointment.date, time: result.appointment.time },
      lang,
    ))
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


  const hebrewMonthLabel = formatHebrewMonth(year, month)

  // Next-thing glance (primary view): next upcoming event + today's count,
  // computed from the current year's merged set so it stays correct while the
  // user navigates other months.
  const glanceSource = useMemo(() => loadAppointmentsWithFamily(todayDate.getFullYear()), [appointments]) // eslint-disable-line react-hooks/exhaustive-deps
  const nextEvent = useMemo(() => (
    glanceSource
      .filter(a => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] ?? null
  ), [glanceSource, today])
  const todayCount = useMemo(() => glanceSource.filter(a => a.date === today).length, [glanceSource, today])

  return (
    <PageShell scrollable background={PAGE_BG}>

      <ScreenHeader
        title="Abu יומן"
        left={<>
          <BackButton onPress={() => setScreen(Screen.Home)} />
          {/* Shared Abu-family emblem (M4 logo system) so the calendar reads as one
              product with the hub — sits beside the back control on the header. */}
          <AbuLogo app="calendar" size={34} style={{ flexShrink: 0 }} />
        </>}
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
              '▪ ריבוע זהב = אירוע (תור, פגישה)',
              '● עיגול ורוד מלא = יום הולדת משפחתי',
              '◯ עיגול ריק = יום זיכרון',
              '🔢 מספר ליד הסימן = כמה אירועים יש ביום',
              '🩶 סימן אפור = אירוע שעבר',
              '⬜ מסגרת זהב חזקה = היום',
              '⬜ מסגרת זהב עדינה = יום שנבחר',
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

      {/* ALERT BANNERS — reflowing top inset (in-flow; never paints over chrome) */}
      {activeAlerts.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeAlerts.map(alert => (
            <div key={alert.id} style={{
              background: 'rgba(12,10,8,0.97)',
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

      {/* Alert time selector — inline, minimal */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '4px 16px', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: 'rgba(201,168,76,0.55)', fontFamily: "'Heebo',sans-serif" }}>🔔</span>
        <select
          value={alertMinutes}
          onChange={e => { const v = parseInt(e.target.value, 10); setAlertMinutes(v); try { localStorage.setItem('abubank-alert-minutes', String(v)) } catch { /* quota */ } }}
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

      {/* NEXT-THING GLANCE — single next event + today's count. Primary view
          carries no list; tapping jumps to that day and opens the sheet. */}
      <button
        type="button"
        onClick={() => { if (nextEvent) { const [y, m] = nextEvent.date.split('-').map(Number); setYear(y!); setMonth(m!); setSelectedDay(nextEvent.date); setSheetOpen(true) } }}
        aria-label={nextEvent ? `הדבר הבא: ${nextEvent.title}${todayCount > 0 ? `, ${todayCount} אירועים היום` : ''}` : 'אין אירועים קרובים'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          width: 'calc(100% - 32px)', margin: '2px auto 0', padding: '10px 14px',
          borderRadius: 14, background: 'rgba(201,168,76,0.06)',
          border: '1px solid rgba(201,168,76,0.16)', textAlign: 'right',
          cursor: nextEvent ? 'pointer' : 'default', fontFamily: "'Heebo',sans-serif",
        }}
      >
        <span style={{ fontSize: 22, flexShrink: 0 }}>{nextEvent ? nextEvent.emoji : '🗓️'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_SECONDARY }}>הדבר הבא</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nextEvent
              ? `${nextEvent.title} · ${nextEvent.date === today ? 'היום' : nextEvent.date.split('-').reverse().slice(0, 2).join('/')}`
              : 'אין אירועים קרובים'}
          </div>
        </div>
        {todayCount > 0 && (
          <span style={{
            fontSize: 13, fontWeight: 700, color: GOLD, flexShrink: 0,
            background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.30)',
            borderRadius: 10, padding: '3px 10px',
          }}>היום: {todayCount}</span>
        )}
      </button>

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
              color: idx === 6 ? GOLD : idx === 5 ? BRIGHT_GOLD : TEXT_SECONDARY,
              padding: '4px 0', fontFamily: "'Heebo',sans-serif",
              borderBottom: idx === 6 ? '1.5px solid rgba(201,168,76,0.30)' : idx === 5 ? '1px solid rgba(201,168,76,0.12)' : 'none',
            }}>{h}</div>
          ))}
        </div>

        {/* Day cells grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} style={{ minHeight: 64 }} />
            const ds = dateStr(year, month, day)
            const isToday = ds === today
            const isSelected = ds === selectedDay && !isToday
            const isPast = ds < today
            const dots = apptsByDate[ds] ?? []
            const isShabbat = idx % 7 === 6
            const isFriday = idx % 7 === 5
            const holiday = getHebrewHoliday(ds)
            const hasBirthday = dots.some(a => a.type === 'birthday')
            const hasMemorial = dots.some(a => a.type === 'memory')
            const cellDelay = `${(idx % 7) * 0.02}s`
            return (
              <button
                key={ds}
                type="button"
                onClick={() => { setSelectedDay(ds); soundTap(); setSheetOpen(true) }}
                aria-label={`${day} ${formatHebrewMonth(year, month)}${holiday ? `, ${holiday}` : ''}${dots.length ? `, ${dots.length} אירועים` : ''}`}
                aria-current={isToday ? 'date' : undefined}
                style={{
                  minHeight: 64, borderRadius: 14, position: 'relative',
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
                      : isShabbat ? GOLD
                      : isFriday ? TEXT_SECONDARY
                      : CREAM,
                    fontFamily: "'DM Sans',sans-serif", lineHeight: 1,
                    textShadow: isToday ? '0 1px 3px rgba(0,0,0,0.30)' : 'none',
                  }}>{day}</span>
                </div>

                {/* Event indicator — shape encodes type (not color-only):
                    birthday = filled circle, memorial = ring, regular = square.
                    Count digit shown when >1 event on the day. */}
                {dots.length > 0 && (() => {
                  const pastDim = isPast && !isToday
                  const isMemorialOnly = hasMemorial && !hasBirthday
                  const isRegularOnly = !hasBirthday && !hasMemorial
                  const shapeColor = pastDim ? 'rgba(245,240,232,0.45)' : hasBirthday ? '#F472B6' : GOLD
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1, height: 10 }}>
                      <span style={{
                        width: isMemorialOnly ? 7 : 6,
                        height: isMemorialOnly ? 7 : 6,
                        borderRadius: isRegularOnly ? 2 : '50%',
                        background: isMemorialOnly ? 'transparent' : shapeColor,
                        border: isMemorialOnly ? `1.5px solid ${shapeColor}` : 'none',
                        boxShadow: pastDim ? 'none' : hasBirthday ? '0 0 6px rgba(244,114,182,0.50)' : '0 0 4px rgba(201,168,76,0.45)',
                        display: 'inline-block', flexShrink: 0, boxSizing: 'border-box',
                      }} />
                      {dots.length > 1 && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, lineHeight: 1,
                          color: pastDim ? 'rgba(245,240,232,0.45)' : TEXT_SECONDARY,
                          fontFamily: "'DM Sans',sans-serif",
                        }}>{dots.length}</span>
                      )}
                    </div>
                  )
                })()}
              </button>
            )
          })}
        </div>
      </div>

      {/* REMINDER BOARD — today / overdue / recurring sections */}
      <ReminderBoard />

      {/* Spacer so the fixed bottom action bar never covers the last calendar row */}
      <div style={{ height: 88, flexShrink: 0 }} aria-hidden="true" />

      {/* SELECTED DAY — bottom-sheet (replaces the inline list + sticky footer).
          Owns its own scroll; ADD/mic/voice-trace live inside it only. */}
      <DayDetailSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={formatShortHebrewDate(selectedDay)}
        footer={
          <>
            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <SeniorButton variant="ghost" onClick={() => { soundOpen(); setEditingAppt(null); setShowManual(true) }}>
                ＋ הוספה ידנית
              </SeniorButton>

              {/* ONE VOICE ENGINE (D7): the mic opens Abu AI — the single speech engine —
                  which creates/reads/edits events on the SAME store. No in-screen capture. */}
              <button type="button" onClick={() => { soundOpen(); setScreen(Screen.AbuAI) }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
                onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                aria-label="הוספת אירוע בדיבור עם Abu"
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'linear-gradient(145deg, #D4A853 0%, #C9A84C 45%, #B8912A 100%)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(201,168,76,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  transition: 'transform 0.12s ease, background 0.2s ease',
                }}
              >
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
                </svg>
              </button>
            </div>
          </>
        }
      >
        {/* AbuTime briefing — collapsed / opt-in inside the sheet */}
        <AbuTime appointments={appointments} today={today} forceOpen={abuTimeOpen} onToggle={setAbuTimeOpen} />

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: GOLD, fontFamily: "'Heebo',sans-serif" }}>אירועים</span>
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
      </DayDetailSheet>

      <Toast
        message="האירוע נמחק"
        visible={!!undoAppt}
        onDismiss={() => setUndoAppt(null)}
        variant="undo"
        onUndo={handleUndo}
        duration={4000}
      />

      <Toast
        message={toastMessage}
        visible={toast}
        onDismiss={() => setToast(false)}
        variant={toastVariant}
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

      {/* REMINDER DUE ENGINE — polls every 30s, shows popup when due */}
      <ReminderDueEngine />

      {/* PRIMARY ADD — main-screen fixed bottom bar, always visible without day tap.
          The mic opens Abu AI (D7 · one voice engine); typed add stays here. */}
      {!sheetOpen && (
        <div
          data-testid="main-add-bar"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: 'linear-gradient(to top, rgba(5,10,24,0.98) 0%, rgba(5,10,24,0.85) 100%)',
            borderTop: '1px solid rgba(201,168,76,0.20)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            padding: '10px 24px calc(10px + env(safe-area-inset-bottom, 0px))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
          } as React.CSSProperties}
        >
          <SeniorButton
            variant="ghost"
            onClick={() => { soundOpen(); setEditingAppt(null); setShowManual(true) }}
          >＋ הוספה ידנית</SeniorButton>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <button
              type="button"
              onClick={() => { soundOpen(); setScreen(Screen.AbuAI) }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              aria-label="לדבר עם Abu כדי להוסיף אירוע"
              data-testid="main-mic-btn"
              style={{
                width: 64, height: 64, borderRadius: '50%', border: 'none',
                background: 'linear-gradient(145deg, #D4A853 0%, #C9A84C 45%, #B8912A 100%)',
                boxShadow: '0 4px 20px rgba(201,168,76,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.12s ease, background 0.2s ease',
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="2" width="6" height="11" rx="3"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="8" y1="22" x2="16" y2="22"/>
              </svg>
            </button>
            <span style={{ fontSize: 12, color: 'rgba(201,168,76,0.65)', fontFamily: "'Heebo',sans-serif", fontWeight: 600 }}>דברי אליי</span>
          </div>
        </div>
      )}

      {import.meta.env.DEV && (
        <div
          data-testid="dev-version-badge"
          style={{
            position: 'fixed', bottom: 8, left: 8,
            fontSize: 9, color: 'rgba(201,168,76,0.45)', fontFamily: 'monospace',
            zIndex: 9999, userSelect: 'none', pointerEvents: 'none',
          }}
        >v{APP_VERSION.version} · {APP_VERSION.commitHint === 'local' ? 'local build' : APP_VERSION.commitHint}</div>
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
    </PageShell>
  )
}
