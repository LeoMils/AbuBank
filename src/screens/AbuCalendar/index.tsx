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
import { processVoiceTranscript } from './voiceAutoCreate'
import { resolvePersonPhrase } from './familyResolve'
import { userFacingError } from '../../services/platformHealth'
import { mediateVoiceCaptureError } from '../../services/errorMediation'
import { APP_VERSION } from '../../version'
import {
  createInitialTrace,
  pushStep,
  stageLabel,
  type VoiceStage,
  type VoiceTrace,
} from './voiceTrace'
import { DayDetailSheet } from './DayDetailSheet'
import { transcribeCalendarAudio } from './calendarTranscribe'
import { normalizeCalendarTranscript } from './calendarTranscriptCorrection'
import { getSupportedMimeType } from '../AbuAI/service'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { soundTap, soundSuccess, soundOpen, soundAlert } from '../../services/sounds'
import { injectSharedKeyframes } from '../../design/animations'
import { InfoButton } from '../../components/InfoButton'
import { ApptCard } from './ApptCard'
import { ManualModal } from './ManualModal'
import { VoiceAddFlow, type VoiceDraft } from './VoiceAddFlow'
import { sanitizeTitleForSave } from './localParser'
import { Toast } from '../../components/Toast'
import { AbuTime } from './AbuTime'
import { PageShell } from '../../components/PageShell'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SeniorButton } from '../../components/SeniorButton'
import { EmptyState } from '../../components/EmptyState'
import { BackButton } from '../../components/BackButton'
import { GOLD, BRIGHT_GOLD, BG, CREAM, TEXT_SECONDARY, DAY_HEADERS, getTodayStr, daysInMonth, firstDayOfMonth, dateStr, getTimeState, type ApptTimeState } from './constants'




type VoiceRelation = { status: 'resolved' | 'ambiguous' | 'missing'; phrase: string; candidates?: string[] }

// Resolve a spoken family phrase ("הבת של מור") to a verified name, or carry it
// as ambiguous/missing. Never invents; resolved names replace the phrase in the
// title so the saved event reads "פגישה עם <שם>".
function resolveDraftPerson(draft: { title: string; personPhrase?: string | null }): { title: string; personName: string | null; relation?: VoiceRelation } {
  const phrase = draft.personPhrase ?? null
  if (!phrase) return { title: draft.title, personName: null }
  const r = resolvePersonPhrase(phrase)
  if (r.status === 'resolved') return { title: draft.title.replace(phrase, r.name), personName: r.name, relation: { status: 'resolved', phrase } }
  if (r.status === 'ambiguous') return { title: draft.title, personName: phrase, relation: { status: 'ambiguous', phrase, candidates: r.candidates } }
  if (r.status === 'missing') return { title: draft.title, personName: phrase, relation: { status: 'missing', phrase } }
  return { title: draft.title, personName: null }
}


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
  const [voiceParsed, setVoiceParsed] = useState<VoiceDraft | null>(null)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing' | 'parsing' | 'parsed' | 'error'>('idle')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [ambiguousDraft, setAmbiguousDraft] = useState<{ title: string; date: string | null; time: string; emoji: string; location: string | null; notes: string | null } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [abuTimeOpen, setAbuTimeOpen] = useState(false)
  const [savedConfirmation, setSavedConfirmation] = useState<{ title: string; date: string; time: string } | null>(null)
  const [undoAppt, setUndoAppt] = useState<Appointment | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // P0.6 — visible voice trace. Renders inside AbuCalendar's voice
  // action area no matter where the pipeline fails, so the user always
  // sees WHY a recording didn't create a meeting.
  const voiceTraceRef = useRef<VoiceTrace>(createInitialTrace(APP_VERSION.version))
  function updateTrace(patch: Partial<VoiceTrace>, step?: string) {
    const next: VoiceTrace = { ...voiceTraceRef.current, ...patch }
    voiceTraceRef.current = step ? pushStep(next, step) : next
  }
  function setStage(stage: VoiceStage, customMessage?: string, step?: string) {
    updateTrace({ finalVoiceStage: stage, visibleMessage: customMessage ?? stageLabel(stage) }, step ?? `stage:${stage}`)
  }
  function setVoiceFailure(message: string, step: string) {
    updateTrace({ finalVoiceStage: 'error', error: message, visibleMessage: message }, step)
    setVoiceError(message)
    setVoiceState('error')
  }

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
      soundSuccess()
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
    soundSuccess()
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

  async function handleVoiceRecord(opts?: { bypassGuard?: boolean }) {
    // P0.6 — STOP path. The user tapped the red button. Make the
    // "stopping" state visible IMMEDIATELY so no tap ever feels silent.
    if (isRecording) {
      updateTrace({
        stopPressedAt: new Date().toISOString(),
        recorderStateBeforeStop: mediaRecorderRef.current?.state ?? null,
      }, 'stop_pressed')
      setStage('stopping')
      const rec = mediaRecorderRef.current
      if (!rec) {
        setVoiceFailure('לא מצאתי הקלטה פעילה. נסי שוב.', 'recorder_missing')
        setIsRecording(false)
        return
      }
      if (rec.state !== 'recording') {
        updateTrace({ recorderStateAfterStop: rec.state }, `recorder_state_not_recording:${rec.state}`)
        setVoiceFailure('ההקלטה כבר נעצרה. נסי שוב.', 'recorder_not_recording')
        setIsRecording(false)
        return
      }
      try {
        rec.stop()
        updateTrace({ recorderStateAfterStop: rec.state }, 'recorder_stop_called')
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        setVoiceFailure('ההקלטה נכשלה. נסי שוב.', `recorder_stop_threw:${m}`)
        setIsRecording(false)
      }
      return
    }
    // Fresh trace for a new recording session.
    const fresh = createInitialTrace(APP_VERSION.version)
    voiceTraceRef.current = fresh
    setVoiceError(null)
    // P0.6 — MediaRecorder availability guard.
    if (typeof MediaRecorder === 'undefined') {
      setVoiceFailure('הקלטה קולית לא נתמכת בדפדפן הזה.', 'media_recorder_unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      updateTrace({ mimeType: mimeType || '(default)', startedAt: new Date().toISOString() }, `recording_started mime:${mimeType || 'default'}`)
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        try {
          updateTrace({ onstopFired: true }, 'onstop_fired')
          stream.getTracks().forEach(t => t.stop())
          setIsRecording(false)
          setStage('processing')
          setVoiceState('transcribing')
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          updateTrace({ chunksCount: chunksRef.current.length, blobSize: blob.size }, `blob_created chunks:${chunksRef.current.length} size:${blob.size}`)
          if (chunksRef.current.length === 0 || blob.size === 0) {
            setVoiceFailure('לא נקלט שמע בהקלטה. נסי שוב קרוב יותר למיקרופון.', 'no_audio_captured')
            return
          }
          if (blob.size < 1000) {
            setVoiceFailure('ההקלטה קצרה מדי. נסי שוב.', `blob_too_small:${blob.size}`)
            return
          }
        try {
          // P0.6 — visible "transcribing" stage + watchdog. P0.7 —
          // quality-first Hebrew Whisper (large-v3 + verbose_json +
          // domain prompt) with fallback to turbo, and a deterministic
          // domain-correction pass before the parser.
          setStage('transcribing')
          updateTrace({ transcribeStarted: new Date().toISOString() }, 'transcribe_started')
          const WATCHDOG_MS = 20_000
          let watchdog: ReturnType<typeof setTimeout> | null = null
          const asr = await Promise.race<Awaited<ReturnType<typeof transcribeCalendarAudio>>>([
            transcribeCalendarAudio(blob, { languageHint: 'he' }),
            new Promise<Awaited<ReturnType<typeof transcribeCalendarAudio>>>((_, reject) => {
              watchdog = setTimeout(() => reject(new Error('transcribe_timeout')), WATCHDOG_MS)
            }),
          ]).finally(() => { if (watchdog) clearTimeout(watchdog) })
          const rawTranscript = asr.text
          // P0.7 — deterministic domain correction for known family
          // names + Israeli places. Conservative: only replace tokens
          // that appear in the curated rule set.
          const norm = normalizeCalendarTranscript(rawTranscript)
          const transcribed = norm.corrected
          updateTrace({
            transcribeFinished: new Date().toISOString(),
            transcript: transcribed,
            transcriptLength: transcribed.length,
            rawTranscript: norm.rawText,
            correctedTranscript: transcribed,
            asrModel: asr.model,
            asrFallbackUsed: asr.asrFallbackUsed,
            languageHint: asr.languageHint,
            avgLogprob: asr.avgLogprob ?? null,
            noSpeechProb: asr.noSpeechProb ?? null,
            compressionRatio: asr.compressionRatio ?? null,
            correctionsApplied: norm.correctionsApplied,
          }, `transcript_received model:${asr.model} corrections:${norm.correctionsApplied.length}`)
          if (!transcribed || !transcribed.trim()) {
            setVoiceFailure('לא הצלחתי להבין את ההקלטה. ננסה שוב?', 'transcript_empty')
            return
          }
          setVoiceState('parsing')

          // Check if this is a schedule query ("מה קורה לי?")
          const { isScheduleQuery: isQuery } = await import('./intentParser')
          if (isQuery(transcribed)) {
            setAbuTimeOpen(true)
            return
          }
          // P0.1 — Route the final transcript through processVoiceTranscript.
          // This returns one of six explicit actions so the UI never
          // silently drops. Auto-creation is gated on a real create-verb
          // ("תקבעי / תוסיפי / agregá / agendá / add / schedule") AND a
          // complete, unambiguous intent — same safety as the typed path.
          setStage('parsing')
          const todayISO = getTodayStr()
          const decision = processVoiceTranscript(transcribed, todayISO, { rawTranscript: norm.rawText, asr: { avgLogprob: asr.avgLogprob ?? null, noSpeechProb: asr.noSpeechProb ?? null, compressionRatio: asr.compressionRatio ?? null } })
          updateTrace({ parseDecision: decision.action, ...(('semantic' in decision && decision.semantic) ? { semanticIntent: decision.semantic.intent, semanticSource: decision.semantic.semanticSource, extractionConfidence: decision.semantic.extractionConfidence, extractedTitle: decision.semantic.extractedTitle, extractedDate: decision.semantic.extractedDate, extractedStartTime: decision.semantic.extractedStartTime, extractedEndTime: decision.semantic.extractedEndTime, extractedLocation: decision.semantic.extractedLocation, extractedPeople: decision.semantic.extractedPeople, extractedNotes: decision.semantic.extractedNotes, missingFields: decision.semantic.missingFields, clarificationQuestion: decision.semantic.clarificationQuestion, llmFallbackUsed: decision.semantic.llmFallbackUsed, validationResult: decision.semantic.validationResult, semanticRawInput: decision.semantic.semanticRawInput, semanticCorrectedInput: decision.semantic.semanticCorrectedInput } : {}) }, `parse_decision:${decision.action}`)
          switch (decision.action) {
            case 'auto_created': {
              setStage('creating', undefined, 'create_started')
              reload()
              // Jump the calendar view to the new event's date so the
              // user can immediately see it.
              setSelectedDay(decision.appointment.date)
              setVoiceParsed(null)
              setVoiceError(null)
              setVoiceState('idle')
              playChime()
              soundSuccess()
              const lang = detectConfirmationLang(decision.appointment.title)
              const successMsg = formatCreatedConfirmation({
                title: decision.appointment.title,
                date: decision.appointment.date,
                time: decision.appointment.time,
              }, lang)
              showSuccessToast(successMsg)
              updateTrace({ createResult: `ok:${decision.appointment.id}` }, 'create_finished')
              setStage('success', successMsg)
              return
            }
            case 'needs_am_pm': {
              updateTrace({}, 'needs_am_pm')
              setStage('idle', 'מחכה לאישור בוקר או צהריים.', 'awaiting_am_pm')
              setAmbiguousDraft({
                title: decision.draft.title,
                date: decision.draft.date,
                time: decision.draft.time!,
                emoji: decision.draft.emoji,
                location: decision.draft.location,
                notes: decision.draft.notes,
              })
              return
            }
            case 'needs_clarification': {
              // Show the VoiceCard with whatever was parsed AND a visible
              // clarification question. The user can fix the missing
              // field inline; no silent timeout-dismiss.
              updateTrace({}, `needs_clarification:${decision.missing.join('|')}`)
              {
                const res = resolveDraftPerson(decision.draft)
                setVoiceParsed({
                  title: res.title,
                  date: decision.draft.date,
                  time: decision.draft.time,
                  emoji: decision.draft.emoji,
                  location: decision.draft.location ?? null,
                  notes: decision.draft.notes ?? null,
                  personName: res.personName,
                  ...(res.relation ? { relation: res.relation } : {}),
                })
              }
              setVoiceState('parsed')
              setStage('idle', decision.question, 'showing_clarification_question')
              return
            }
            case 'show_confirm_card': {
              // Passive utterance — complete but no explicit create-verb.
              // Show the VoiceCard so the user explicitly confirms.
              updateTrace({}, 'show_confirm_card')
              {
                const res = resolveDraftPerson(decision.draft)
                setVoiceParsed({
                  title: res.title,
                  date: decision.draft.date,
                  time: decision.draft.time,
                  emoji: decision.draft.emoji,
                  location: decision.draft.location ?? null,
                  notes: decision.draft.notes ?? null,
                  personName: res.personName,
                  ...(res.relation ? { relation: res.relation } : {}),
                })
              }
              setVoiceState('parsed')
              setStage('idle', 'מחכה לאישור שלך לפני שמירה.', 'awaiting_confirm_tap')
              return
            }
            case 'failed_to_save': {
              const lang = detectConfirmationLang(decision.draft.title)
              const failMsg = formatCreateFailure('storage_failed', lang)
              showFailureToast(failMsg)
              setVoiceFailure(failMsg, `create_failed:${decision.reason}`)
              setVoiceParsed({
                title: decision.draft.title,
                date: decision.draft.date,
                time: decision.draft.time,
                emoji: decision.draft.emoji,
                location: decision.draft.location ?? null,
                notes: decision.draft.notes ?? null,
              })
              return
            }
            case 'not_calendar': {
              setVoiceFailure('לא זיהיתי משהו לקבוע ביומן.', 'not_calendar')
              return
            }
            case 'low_confidence': {
              setVoiceFailure('לא שמעתי מספיק ברור. תוכלי להגיד שוב?', 'low_confidence')
              return
            }
            case 'failed_to_understand': {
              const failMsg = 'לא הצלחתי להבין את ההקלטה. ננסה שוב?'
              setVoiceFailure(failMsg, 'failed_to_understand')
              setVoiceParsed({
                title: '', date: null, time: null, emoji: '📌',
              })
              return
            }
          }
        } catch (e) {
          // P0.5/6 — translate known transcription failures into the
          // honest user-facing copy from platformHealth.userFacingError,
          // so the user always sees WHY the recording didn't work.
          const raw = e instanceof Error ? e.message : ''
          let friendly: string
          let step: string
          if (raw === 'transcribe_timeout' || raw.includes('transcribe_timeout')) {
            friendly = 'התמלול לוקח יותר מדי זמן. נסי שוב.'
            step = 'transcribe_timeout'
          } else if (raw.includes('מפתח API לתמלול לא הוגדר')) {
            friendly = userFacingError('voice_transcribe_key_missing', 'he')
            step = 'transcribe_key_missing'
          } else if (raw.includes('מפתח API לא תקין')
                  || raw.includes('יותר מדי בקשות')
                  || /transcrib/i.test(raw)) {
            friendly = mediateVoiceCaptureError(e, 'transcription')
            step = `transcribe_failed:${raw.slice(0, 40)}`
          } else if (raw) {
            friendly = mediateVoiceCaptureError(e, 'transcription')
            step = `caught_error:${raw.slice(0, 40)}`
          } else {
            friendly = mediateVoiceCaptureError(e, 'transcription')
            step = 'caught_unknown_error'
          }
          setVoiceFailure(friendly, step)
        }
        } catch (outerErr) {
          // Defense in depth: if anything inside onstop throws (e.g. a
          // bug in trace push), still surface a visible failure rather
          // than fall through to a silent UI.
          const m = outerErr instanceof Error ? outerErr.message : String(outerErr)
          setVoiceFailure('משהו השתבש בעיבוד ההקלטה. נסי שוב.', `onstop_threw:${m.slice(0, 50)}`)
        }
      }
      mr.start()
      setIsRecording(true)
      setVoiceState('recording')
      setStage('recording')
    } catch (err) {
      const msg = mediateVoiceCaptureError(err, 'permission_or_device')
      setVoiceFailure(msg, `getusermedia_failed:${err instanceof Error ? err.name : 'unknown'}`)
    }
  }

  function handleVoiceConfirm(final: { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }) {
    const cleanTitle = sanitizeTitleForSave(final.title, undefined)
    const result = createAppointmentSafe({ ...final, title: cleanTitle })
    if (!result.ok) {
      const lang = detectConfirmationLang(final.title)
      showFailureToast(formatCreateFailure(result.code, lang))
      return
    }
    reload()
    setSelectedDay(result.appointment.date)
    setVoiceParsed(null)
    setVoiceError(null)
    setVoiceState('idle')
    playChime()
    soundSuccess()
    setSavedConfirmation({
      title: result.appointment.title,
      date: result.appointment.date,
      time: result.appointment.time,
    })
  }

  function handleVoiceCancel() {
    setVoiceParsed(null)
    setVoiceError(null)
    setVoiceState('idle')
    setAmbiguousDraft(null)
  }

  function handleVoiceManualAdd() {
    handleVoiceCancel()
    soundOpen()
    setEditingAppt(null)
    setShowManual(true)
  }

  function handleVoiceRetry() {
    setVoiceParsed(null)
    setVoiceError(null)
    setVoiceState('idle')
    void handleVoiceRecord({ bypassGuard: true })
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
    <PageShell scrollable>

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

      {/* SELECTED DAY — bottom-sheet (replaces the inline list + sticky footer).
          Owns its own scroll; ADD/mic/voice-trace live inside it only. */}
      <DayDetailSheet
        open={sheetOpen}
        onClose={() => { if (isRecording) return; setSheetOpen(false) }}
        title={formatShortHebrewDate(selectedDay)}
        footer={
          <>
            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <SeniorButton variant="ghost" onClick={() => { soundOpen(); setEditingAppt(null); setShowManual(true) }}>
                ＋ הוספה ידנית
              </SeniorButton>

              <button type="button" onClick={() => handleVoiceRecord()}
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

      <VoiceAddFlow
        isRecording={isRecording}
        isProcessing={voiceState === 'transcribing' || voiceState === 'parsing'}
        parsed={voiceParsed}
        voiceError={voiceError}
        ambiguousDraft={ambiguousDraft}
        savedConfirmation={savedConfirmation}
        existingAppts={appointments}
        onToggleRecord={() => void handleVoiceRecord()}
        onConfirm={handleVoiceConfirm}
        onCancel={handleVoiceCancel}
        onRetry={handleVoiceRetry}
        onManualAdd={handleVoiceManualAdd}
        onResolveAmPm={resolveAmbiguity}
        onSavedClose={() => setSavedConfirmation(null)}
        onSavedShowDay={() => { setSelectedDay(savedConfirmation!.date); setSheetOpen(true); setSavedConfirmation(null) }}
        onPickPerson={(name: string) => setVoiceParsed(prev => (prev?.relation) ? { ...prev, title: prev.title.replace(prev.relation.phrase, name), personName: name, relation: { status: 'resolved', phrase: prev.relation.phrase } } : prev)}
        onKeepPhrase={() => setVoiceParsed(prev => (prev?.relation) ? { ...prev, personName: prev.relation.phrase, relation: { status: 'missing', phrase: prev.relation.phrase } } : prev)}
      />

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
