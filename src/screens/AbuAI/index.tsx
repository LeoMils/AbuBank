import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { sendMessage, streamMessage, transcribeAudio, SttExhaustedError, resetSttFailureCount, isPersonalQuery, containsUngroundedClaim, tryGroundedAnswer, groundedLLMAnswer, SYSTEM_PROMPT, VOICE_SUFFIX, loadSummary, saveSummary, updateSummaryFromMessages, generateLLMSummary, type ConversationSummary } from './service'
import { getProactiveSeed } from './proactive'
import { isOnlineCurrentInfoQuery, shouldBlockOnlineForPersonal } from './onlineIntent'
import { answerOnlineCurrentInfo, _recordOnlineError } from './onlineProvider'
import { chooseContentWorld } from './contentWorldEngine'
import { compileHumanAnswer } from './answerCompiler'
import { makeOpenEvidence } from './evidencePacket'
import { shapeVoiceSafe } from './voiceShaper'
import { getTodayEvents, getTomorrowEvents, getBirthdayFor } from './tools'
import { startMicStream, createRecorder, assembleBlob, cleanupIndividualRefs } from '../../services/recording'
import { speakVoiceMode as _speakVoiceMode, streamSpeakVoiceMode as _streamSpeakVoiceMode, stopSpeaking, unlockIOSAudio, createSilenceDetector } from '../../services/voice'

/** speakVoiceMode with 15s safety timeout — prevents stuck speaking state */
async function speakVoiceMode(text: string): Promise<void> {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('TTS_TIMEOUT')), 15000)
  )
  try {
    await Promise.race([_speakVoiceMode(text), timeout])
  } catch (err) {
    stopSpeaking()
    console.warn('[VOICE] TTS timed out or failed, stopping playback:', err)
  }
}
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import type { ChatMessage } from './types'
import type { SilenceDetector } from '../../services/voice'
import { injectSharedKeyframes } from '../../design/animations'
import { soundProcessing, soundSuccess } from '../../services/sounds'
import { RealtimeVoiceSession } from '../../services/realtimeVoice'
import type { RealtimeState } from '../../services/realtimeVoice'
import { mediateError } from '../../services/errorMediation'
import { mediateVoiceCaptureError } from '../../services/errorMediation'
import { traceStart, traceSet, traceEnd, getLastTraceText } from '../../services/voiceDiagLog'
import type { MediatedError } from '../../services/errorMediation'
import { ChatBubble } from './ChatBubble'
import { BackButton } from '../../components/BackButton'
import { ScreenHeader } from '../../components/ScreenHeader'
import { GOLD, BG, SURFACE, TEXT, TEXT_MUTED } from './constants'
import { type CalendarCreateState, IDLE_STATE, isCreateIntent, isRecurringIntent, startCreate, resolvePendingMessage, isConfirm, isCancel, isSearchIntent, searchAppointments, isDeleteIntent, isModifyIntent } from './calendarCreate'
import { shapeCreateConfirm, shapeCreateSaved, shapeCreateCancelled, shapeCreateUnclear, shapeCreateClarify, timeInWords } from './responseShaper'
import { detectReminderIntent, parseReminder } from '../AbuCalendar/reminders/reminderParser'
import { createReminder, createDefaultAlertPolicy } from '../AbuCalendar/reminders/reminderStore'
import type { ReminderDraft } from '../AbuCalendar/reminders/types'
import { routePersonalQuery } from './router'
import { addAppointment, deleteAppointment, updateAppointment, loadAppointments, findConflicts } from '../AbuCalendar/service'
import { adviseFreeSpeech } from './freeSpeechAdvisory'
import { resolvePronouns } from './pronounResolver'
import { resolveFollowUp } from './contextResolver'

let msgCounter = 0
function nextId(): string {
  return `m${++msgCounter}-${Date.now()}`
}

// ─── Voice State Machine ─────────────────────────────────────────────────────
// Explicit states with instrumented transitions
type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'RESPONDING' | 'INTERRUPTED' | 'RECOVERING' | 'ERROR'

const VOICE_STATE_LOG: Array<{ from: VoiceState; to: VoiceState; ts: number; reason: string }> = []

function logVoiceTransition(from: VoiceState, to: VoiceState, reason: string) {
  const entry = { from, to, ts: Date.now(), reason }
  VOICE_STATE_LOG.push(entry)
  if (VOICE_STATE_LOG.length > 100) VOICE_STATE_LOG.shift()
  console.log(`[VoiceState] ${from} → ${to} (${reason}) +${VOICE_STATE_LOG.length > 1 ? Date.now() - VOICE_STATE_LOG[VOICE_STATE_LOG.length - 2]!.ts : 0}ms`)
}

// ─── CSS keyframes injected once ─────────────────────────────────────────────
const KEYFRAMES_ID = 'abuai-anim'

const KEYFRAMES = `
  .abuai-chat-scroll { scrollbar-width: none; }
  .abuai-chat-scroll::-webkit-scrollbar { display: none; }

  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes dotPulse {
    0%,80%,100% { opacity: 0.25; transform: scale(0.75); }
    40%         { opacity: 1; transform: scale(1.0); }
  }
  @keyframes waveBar {
    0%,100% { transform: scaleY(0.25); }
    50%     { transform: scaleY(1.0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes subtleBreath {
    0%,100% { filter: brightness(1) saturate(1); }
    50%     { filter: brightness(1.06) saturate(1.08); }
  }
`

// ─── Voice greeting — short, calm, adult ──────────────────────────────────────
function getVoiceGreeting(): string {
  const h = new Date().getHours()
  const timeGreet = h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'
  return `${timeGreet}, Martita. אני כאן.`
}

export function AbuAI() {
  const setScreen = useAppStore(s => s.setScreen)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('abuai-conversation-history')
      if (!saved) return []
      const parsed = JSON.parse(saved) as ChatMessage[]
      // Only keep last 50 messages to prevent storage bloat
      return parsed.slice(-50)
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Voice conversation mode — explicit state machine (v20)
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'greeting' | 'listening' | 'processing' | 'speaking' | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE')
  const [audioLevel, setAudioLevel] = useState(0)
  const [listenCountdown, setListenCountdown] = useState<number | null>(null)
  const [lastHeardText, setLastHeardText] = useState('')  // v20: transcript feedback
  const [streamingText, setStreamingText] = useState('')   // v20: streaming response text

  // ─── Conversation Summary (long-term context) ─────────────────────
  const [conversationSummary, setConversationSummary] = useState<ConversationSummary | null>(() => loadSummary())

  // Update summary: pattern-matching every 10 msgs, LLM-generated every 20 msgs
  useEffect(() => {
    if (messages.length > 0 && messages.length % 10 === 0) {
      const msgData = messages.map(m => ({ role: m.role, content: m.content }))
      if (messages.length % 20 === 0) {
        // Every 20 messages: generate LLM summary (async, non-blocking)
        generateLLMSummary(msgData, conversationSummary).then(updated => {
          setConversationSummary(updated)
          saveSummary(updated)
        }).catch(() => {
          // Fallback to pattern summary
          const updated = updateSummaryFromMessages(msgData, conversationSummary)
          setConversationSummary(updated)
          saveSummary(updated)
        })
      } else {
        // Every 10 messages: pattern-matching summary (instant)
        const updated = updateSummaryFromMessages(msgData, conversationSummary)
        setConversationSummary(updated)
        saveSummary(updated)
      }
    }
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calendar create conversation state machine
  const [createState, setCreateState] = useState<CalendarCreateState>(IDLE_STATE)
  // ─── Reminder creation from AbuAI ─────────────────────────────────
  const [pendingReminder, setPendingReminder] = useState<ReminderDraft | null>(null)

  // Mirror of createState for the async hands-free voice loop (closures
  // capture a stale state value otherwise).
  const createStateRef = useRef<CalendarCreateState>(IDLE_STATE)
  useEffect(() => { createStateRef.current = createState }, [createState])

  // v20.2: OpenAI Realtime API (WebRTC) — true real-time conversation
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('idle')
  const [realtimeTranscript, setRealtimeTranscript] = useState('')
  const realtimeRef = useRef<RealtimeVoiceSession | null>(null)
  // Realtime disabled: it bypasses runtime grounding (tryGroundedAnswer).
  // Personal queries in Realtime go directly to OpenAI audio with no tool interception.
  // Do not re-enable until personal-query interception is implemented for Realtime.
  // To re-enable: set localStorage 'abubank-realtime-enabled' = 'true'
  const useRealtime = false

  // Auto-clear stale cooldowns on mount — ensures fresh state
  useEffect(() => {
    for (const key of ['abu-openai-quota-failed', 'abu-openai-tts-quota-failed', 'abu-groq-cooldown', 'abu-gemini-cooldown']) {
      const ts = localStorage.getItem(key)
      if (ts && (Date.now() - parseInt(ts, 10)) > 300_000) {
        localStorage.removeItem(key)
        console.log(`[AbuAI] Cleared stale cooldown: ${key}`)
      }
    }
  }, [])

  // Auto-backup reminder — gentle nudge if >7 days since last backup and data exists
  useEffect(() => {
    try {
      const lastBackup = localStorage.getItem('abubank-last-backup')
      const hasAppointments = localStorage.getItem('abubank-calendar-appointments')
      if (hasAppointments && (!lastBackup || Date.now() - new Date(lastBackup).getTime() > 7 * 86400000)) {
        setTimeout(() => {
          setMessages(prev => {
            if (prev.length > 2) return prev
            return [...prev, {
              id: nextId(),
              role: 'assistant' as const,
              content: 'טיפ קטן — כדאי לגבות את הנתונים שלך מדי פעם. תמצאי את זה בהגדרות.',
              timestamp: Date.now(),
            }]
          })
        }, 2000)
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist conversation history to localStorage
  useEffect(() => {
    if (messages.length === 0) return
    try {
      const toSave = messages.slice(-50)
      localStorage.setItem('abuai-conversation-history', JSON.stringify(toSave))
    } catch { /* quota exceeded — silently skip */ }
  }, [messages])

  const clearConversation = useCallback(() => {
    setMessages([])
    try { localStorage.removeItem('abuai-conversation-history') } catch {}
  }, [])

  // v25.2: Simplified — noise mode defaults to quiet, user can change manually
  type VoiceEnvMode = 'quiet' | 'noisy' | 'listen'
  const [noiseMode, setNoiseMode] = useState<VoiceEnvMode>('quiet') // always start quiet
  const cycleNoiseMode = useCallback(() => {
    setNoiseMode(prev => {
      const order: VoiceEnvMode[] = ['quiet', 'noisy', 'listen']
      const next = order[(order.indexOf(prev) + 1) % order.length]!
      localStorage.setItem('abu-noise-mode', next)
      if (realtimeRef.current) {
        realtimeRef.current.disconnect()
        realtimeRef.current = null
      }
      return next
    })
  }, [])
  // Keep toggleNoiseMode for backwards compat with existing calls
  const toggleNoiseMode = cycleNoiseMode

  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])
  const voiceSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const voiceModeRef = useRef(false)
  const voiceStateRef = useRef<VoiceState>('IDLE')
  const silenceRef = useRef<SilenceDetector | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const abortControllerRef = useRef<AbortController | null>(null) // v20: for interruption
  const startVoiceListeningRef = useRef<() => void>(() => {}) // v20: stable ref for interrupt→listen
  const wsEmptyCountRef = useRef(0) // v30.10: Web Speech empty-result backoff counter
  // B1 patch: track the last proactive seed id so repeated boredom / loneliness
  // queries deterministically rotate to a different seed.
  const lastProactiveSeedIdRef = useRef<string | null>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])

  // Sync voice state ref
  const transitionVoice = useCallback((to: VoiceState, reason: string) => {
    const from = voiceStateRef.current
    if (from === to) return
    logVoiceTransition(from, to, reason)
    voiceStateRef.current = to
    setVoiceState(to)
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  // Inject keyframes
  useEffect(() => {
    injectSharedKeyframes()
    if (!document.getElementById(KEYFRAMES_ID)) {
      const style = document.createElement('style')
      style.id = KEYFRAMES_ID
      style.textContent = KEYFRAMES
      document.head.appendChild(style)
    }
    return () => {
      const el = document.getElementById(KEYFRAMES_ID)
      if (el) el.remove()
    }
  }, [])

  useEffect(() => {
    if (!voiceMode) setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // P0 fix: recover voice mode after phone call / tab switch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && voiceModeRef.current) {
        // Page hidden (phone call, tab switch) — clean up voice resources
        cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
        stopSpeaking()
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch {}
          recognitionRef.current = null
        }
      } else if (!document.hidden && voiceModeRef.current) {
        // Page visible again — restart listening with a spoken nudge
        transitionVoice('RECOVERING', 'visibility-return')
        setVoicePhase('processing')
        setTimeout(() => {
          if (voiceModeRef.current) {
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'חזרת! אני פה. דברי.', timestamp: Date.now() }])
            transitionVoice('LISTENING', 'visibility-recovered')
            startVoiceListeningRef.current()
          }
        }, 500)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Text chat ────────────────────────────────────────────────────────────

  // v20.1: Streaming text chat — token-by-token with auto-scroll
  const [isStreaming, setIsStreaming] = useState(false)
  const streamingMsgIdRef = useRef<string | null>(null)

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  })

  const handleSend = async (text?: string) => {
    let msgText = (text ?? input).trim()
    if (!msgText || loading) return
    traceStart()
    traceSet({ rawTranscript: msgText, sttProvider: 'none' }) // text mode — no STT

    // ─── Cross-turn pronoun resolution ──────────────────────────────────
    // "תזכירי לי להתקשר אליו" after talking about נועם → resolves to
    // "תזכירי לי להתקשר לנועם". Scans recent messages for last mentioned
    // family member. Must run before intent detection.
    const { resolved, personName: _resolvedPerson } = resolvePronouns(msgText, messages)
    if (resolved !== msgText) msgText = resolved

    // ─── Cross-turn follow-up resolution ─────────────────────────────────
    // "ומחר?" after "מה יש לי היום?" → expands to "מה יש לי מחר?"
    // "ומור?" after "מי זה נועם?" → expands to "ספרי לי על מור"
    const followUp = resolveFollowUp(msgText, messages)
    if (followUp.wasFollowUp) msgText = followUp.resolved

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: msgText, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const aiMsgId = nextId()
    streamingMsgIdRef.current = aiMsgId
    let accumulated = ''

    try {
      // ─── Calendar Create State Machine ────────────────────────────────────
      if (createState.phase !== 'idle') {
        // Forgiving recovery: cancel / confirm / replace-with-new-request /
        // local read while pending / unclear → clarify. Never blindly repeat
        // the same confirmation.
        const pendingRoute = routePersonalQuery(msgText)
        const isCalendarRead = pendingRoute.type.startsWith('calendar_') && pendingRoute.type !== 'calendar_create'
        const resolution = resolvePendingMessage(createState, msgText, isCalendarRead)

        const pushAssistant = (content: string) => {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content, timestamp: Date.now() }])
          setLoading(false)
          streamingMsgIdRef.current = null
        }

        if (resolution.action === 'cancel') {
          setCreateState(IDLE_STATE)
          pushAssistant(shapeCreateCancelled())
          return
        }
        if (resolution.action === 'save') {
          const d = resolution.draft
          addAppointment({ title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅' })
          soundSuccess()
          setCreateState(IDLE_STATE)
          const savedText = shapeCreateSaved(d)
          traceSet({ route: 'calendar_create', calendarAction: 'save', calendarStorageWrite: true, groundedAnswerUsed: true, finalResponse: savedText })
          traceEnd()
          pushAssistant(savedText)
          return
        }
        if (resolution.action === 'replace' || resolution.action === 'update') {
          setCreateState(resolution.state)
          pushAssistant(
            resolution.state.phase === 'confirming'
              ? shapeCreateConfirm(resolution.state.draft)
              : shapeCreateClarify(resolution.state.missing, resolution.state.draft),
          )
          return
        }
        if (resolution.action === 'read') {
          // Trusted local calendar path — never server/LLM. Pending draft is
          // preserved so a following "כן" can still confirm it.
          pushAssistant(tryGroundedAnswer(msgText) ?? shapeCreateUnclear())
          return
        }
        // resolution.action === 'clarify'
        pushAssistant(shapeCreateUnclear())
        return
      }

      // ─── Free Speech first-pass advisory (P04) ──────────────────────────
      // Runs routeFreeSpeech() as a safe classifier. Intercepts cross-domain
      // intents (calendar create, WhatsApp, navigation, unclear) with
      // no-side-effect responses. Falls through for AbuAI-native domains.
      const advisory = adviseFreeSpeech(msgText)
      if (advisory.response !== null) {
        const advisoryMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: advisory.response, timestamp: Date.now() }
        setMessages(prev => [...prev, advisoryMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Reminder pending (confirmation or time follow-up) ────────────
      if (pendingReminder) {
        const pushAssistant = (content: string) => {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content, timestamp: Date.now() }])
          setLoading(false)
          streamingMsgIdRef.current = null
        }

        // Case 1: waiting for time ("מתי להזכיר לך?")
        if (!pendingReminder.dueAt) {
          // Try to parse the user's answer as a time/date for the pending title
          const combined = `תזכירי לי ${msgText} ${pendingReminder.title ?? ''}`
          const _n = new Date(); const _p = (n: number) => String(n).padStart(2,'0')
          const todayStr = `${_n.getFullYear()}-${_p(_n.getMonth()+1)}-${_p(_n.getDate())}`
          const reParsed = parseReminder(combined, todayStr)
          if (reParsed.dueAt && reParsed.title) {
            // Resolved! Show confirmation
            setPendingReminder(reParsed)
            pushAssistant(`${reParsed.readbackText}\n\nלשמור?`)
            return
          }
          if (isCancel(msgText)) {
            setPendingReminder(null)
            pushAssistant('בסדר, ביטלתי.')
            return
          }
          // Still can't parse time — ask again
          pushAssistant('לא תפסתי מתי. תגידי למשל "מחר בערב" או "בעוד שעה".')
          return
        }

        // Case 2: waiting for confirmation ("לשמור?")
        if (isConfirm(msgText)) {
          const { saved } = createReminder({
            category: pendingReminder.category,
            title: pendingReminder.title ?? '',
            dueAt: pendingReminder.dueAt ?? new Date().toISOString(),
            displayDateLabel: pendingReminder.displayDateLabel ?? '',
            displayTimeLabel: pendingReminder.displayTimeLabel ?? '',
            ...(pendingReminder.recurrence ? { recurrence: pendingReminder.recurrence } : {}),
            alertPolicy: { ...createDefaultAlertPolicy(), ...pendingReminder.alertPolicyDraft },
          })
          setPendingReminder(null)
          if (saved) {
            soundSuccess()
            pushAssistant(`רשמתי. אזכיר לך ${pendingReminder.title ?? ''}.`)
          } else {
            pushAssistant('לא הצלחתי לשמור את התזכורת. נסי שוב.')
          }
          return
        }
        if (isCancel(msgText)) {
          setPendingReminder(null)
          pushAssistant('בסדר, ביטלתי.')
          return
        }
        // Not confirm/cancel — cancel pending and continue normally
        setPendingReminder(null)
      }

      // ─── Unresolved pronoun guard ─────────────────────────────────────
      // If a create intent still has an unresolved pronoun (אליו/אליה/שלו/שלה)
      // after pronoun resolution failed, ask who instead of creating with
      // a raw pronoun like "להתקשר אליה".
      const UNRESOLVED_PRONOUN = /(?<![֐-׿])(אליו|אליה|שלו|שלה|אותו|אותה|איתו|איתה)(?![֐-׿])/
      if (isCreateIntent(msgText) && UNRESOLVED_PRONOUN.test(msgText) && !_resolvedPerson) {
        const pronoun = msgText.match(UNRESOLVED_PRONOUN)?.[1] ?? ''
        const genderHint = /אליה|שלה|אותה|איתה/.test(pronoun) ? 'למי את מתכוונת?' : 'למי את מתכוונת?'
        const aiMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: genderHint, timestamp: Date.now() }
        setMessages(prev => [...prev, aiMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Reminder intent detection (before appointment create) ─────
      if (isCreateIntent(msgText) && detectReminderIntent(msgText) === 'reminder') {
        const _n = new Date(); const _p = (n: number) => String(n).padStart(2,'0')
        const todayStr = `${_n.getFullYear()}-${_p(_n.getMonth()+1)}-${_p(_n.getDate())}`

        // Family birthday fusion: "שבוע לפני יום ההולדת של נועם" →
        // resolve birthday from family data, subtract offset, inject concrete date.
        let reminderText = msgText
        const bdayFusionMatch = msgText.match(/(?:(\S+)\s+)?לפני\s+יום ה?הולדת של\s+(\S+)/)
        if (bdayFusionMatch) {
          const offsetWord = bdayFusionMatch[1] ?? 'שבוע'
          const personName = bdayFusionMatch[2]!
          const bdayResult = getBirthdayFor(personName)
          // Extract MM-DD from summary text (format: "יום ההולדת של X — MM-DD.")
          const dateMatch = bdayResult.summary.match(/(\d{2})-(\d{2})/)
          if (bdayResult.found && dateMatch) {
            const offsetDays = /שבוע/.test(offsetWord) ? 7
              : /יומיים/.test(offsetWord) ? 2
              : /חודש/.test(offsetWord) ? 30
              : /שלושה/.test(offsetWord) ? 3
              : 7
            const mm = parseInt(dateMatch[1]!, 10)
            const dd = parseInt(dateMatch[2]!, 10)
            const thisYear = new Date().getFullYear()
            let bdayDate = new Date(thisYear, mm - 1, dd)
            if (bdayDate.getTime() < Date.now()) bdayDate = new Date(thisYear + 1, mm - 1, dd)
            bdayDate.setDate(bdayDate.getDate() - offsetDays)
            const resolvedDate = `${bdayDate.getFullYear()}-${_p(bdayDate.getMonth()+1)}-${_p(bdayDate.getDate())}`
            reminderText = msgText.replace(bdayFusionMatch[0], `ב-${resolvedDate}`)
          }
        }

        const draft = parseReminder(reminderText, todayStr)
        const pushAssistant = (content: string) => {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content, timestamp: Date.now() }])
          setLoading(false)
          streamingMsgIdRef.current = null
        }
        // If all fields present and no ambiguity → ask confirmation
        if (draft.dueAt && draft.title && !draft.ambiguity && draft.missingFields.length === 0) {
          setPendingReminder(draft)
          pushAssistant(`${draft.readbackText}\n\nלשמור?`)
          return
        }
        // Missing time → store partial draft and ask
        if (draft.missingFields.includes('time')) {
          setPendingReminder(draft) // dueAt is undefined → triggers time follow-up
          pushAssistant(`הבנתי: ${draft.title ?? msgText}\nמתי להזכיר לך?`)
          return
        }
        // Other missing/ambiguous → general ask
        pushAssistant(draft.readbackText ? `${draft.readbackText}\nלשמור?` : 'לא הצלחתי להבין. מתי להזכיר לך?')
        if (draft.dueAt && draft.title) setPendingReminder(draft)
        return
      }

      // ─── Calendar Search ──────────────────────────────────────────────────
      if (isSearchIntent(msgText)) {
        const result = searchAppointments(msgText)
        setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: result, timestamp: Date.now() }])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Calendar Delete ──────────────────────────────────────────────────
      if (isDeleteIntent(msgText)) {
        const appts = loadAppointments()
        const nameMatch = msgText.match(/עם\s+(\S+)|אצל\s+(\S+)/)
        const searchTerm = nameMatch?.[1] ?? nameMatch?.[2] ?? ''

        const matches = searchTerm
          ? appts.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
          : appts.slice(-1) // last created if no name specified

        if (matches.length === 0) {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: 'אין פגישה כזו ביומן.', timestamp: Date.now() }])
        } else if (matches.length === 1) {
          deleteAppointment(matches[0]!.id)
          const time = matches[0]!.time ? ` ${timeInWords(matches[0]!.time)}` : ''
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: `מחקתי את ${matches[0]!.title}${time}.`, timestamp: Date.now() }])
        } else {
          const lines = matches.map((m, i) => `${i + 1}. ${m.title} — ${m.date}`)
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: `יש כמה אפשרויות:\n${lines.join('\n')}\nאיזו למחוק?`, timestamp: Date.now() }])
        }
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Calendar Modify ─────────────────────────────────────────────────
      if (isModifyIntent(msgText)) {
        const appts = loadAppointments()
        if (appts.length === 0) {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: 'אין כלום ביומן לשנות.', timestamp: Date.now() }])
          setLoading(false)
          streamingMsgIdRef.current = null
          return
        }

        // Find target appointment (by name or last created)
        const nameMatch = msgText.match(/את\s+(ה?(פגישה|תור|ביקור)\s+)?(?:עם\s+)?(\S+)/i)
        const searchName = nameMatch?.[3] ?? ''
        let target = searchName
          ? appts.find(a => a.title.toLowerCase().includes(searchName.toLowerCase()))
          : appts[appts.length - 1]

        if (!target) target = appts[appts.length - 1]!

        // Parse new date/time from the modify request
        const { parseCreateDate, parseHebrewTimeDetailed } = await import('./calendarCreate')

        const newDate = parseCreateDate(msgText)
        const newTimeResult = parseHebrewTimeDetailed ? parseHebrewTimeDetailed(msgText) : null
        const newTime = newTimeResult?.time ?? null

        // Apply changes
        const updates: Partial<typeof target> = {}
        if (newDate) updates.date = newDate
        if (newTime) updates.time = newTime

        if (Object.keys(updates).length === 0) {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: 'לא הבנתי מה לשנות. תגידי לאיזה יום או שעה להזיז.', timestamp: Date.now() }])
        } else {
          updateAppointment(target.id, updates)
          // Use friendly date label (מחר, ביום רביעי) instead of raw YYYY-MM-DD
          const today = new Date().toISOString().split('T')[0]!
          const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0]!
          let dateStr = ''
          if (updates.date) {
            if (updates.date === today) dateStr = ' להיום'
            else if (updates.date === tmrw) dateStr = ' למחר'
            else dateStr = ` ל${updates.date}`
          }
          const timeStr = updates.time ? ` ${timeInWords(updates.time)}` : ''
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: `עדכנתי: ${target!.title}${dateStr}${timeStr}.`, timestamp: Date.now() }])
        }
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // Check for new create intent (appointments only — reminders handled above)
      if (isCreateIntent(msgText) && isRecurringIntent(msgText)) {
        const { extractRecurringDay, getNextOccurrences } = await import('./calendarCreate')
        const recurDay = extractRecurringDay(msgText)
        if (recurDay !== null) {
          // Parse title and time from the text
          const next = startCreate(msgText)
          const title = next.draft.title || 'פגישה'
          const time = next.draft.time || null
          const dates = getNextOccurrences(recurDay, 4)
          // Create 4 individual events
          for (const date of dates) {
            addAppointment({ title, date, time: time || '09:00', emoji: next.draft.emoji || '📅', type: 'regular' })
          }
          const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
          const timeStr = time ? ` בשעה ${time}` : ''
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: `קבעתי ${title} כל יום ${dayNames[recurDay]}${timeStr} ל-4 השבועות הקרובים.`, timestamp: Date.now() }])
        } else {
          setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: 'באיזה יום בשבוע? למשל: "כל יום שלישי בעשר"', timestamp: Date.now() }])
        }
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }
      if (isCreateIntent(msgText)) {
        const next = startCreate(msgText)
        setCreateState(next)
        let response = next.phase === 'confirming'
          ? shapeCreateConfirm(next.draft)
          : shapeCreateClarify(next.missing, next.draft)
        // Conflict detection — warn if same date+time already has an event
        if (next.phase === 'confirming' && next.draft.date && next.draft.time) {
          const conflicts = findConflicts(next.draft.date, next.draft.time)
          if (conflicts.length > 0) {
            const conflictText = conflicts.map(c => c.title).join(', ')
            response = `שימי לב — כבר יש לך ${conflictText} באותו זמן.\n${response}`
          }
        }
        const createMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: response, timestamp: Date.now() }
        setMessages(prev => [...prev, createMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Existing grounded answer path ────────────────────────────────────
      // Personal queries → try grounded answer first, then LLM-paraphrase for
      // family/calendar answers (text mode only) so responses sound natural
      // instead of database-like. Voice mode skips paraphrasing for speed.
      const groundedAnswer = tryGroundedAnswer(msgText)
      if (groundedAnswer !== null) {
        const route = routePersonalQuery(msgText)
        const isCal = route.type.startsWith('calendar_')
        const isFamily = route.type.startsWith('family_') || route.type === 'birthday_lookup' || route.type === 'memorial_lookup'

        let finalResponse = groundedAnswer
        if (isFamily || isCal) {
          // LLM paraphrase: warm, natural response grounded in verified facts
          finalResponse = await groundedLLMAnswer(
            msgText,
            groundedAnswer,
            messages.map(m => ({ role: m.role, content: m.content })),
            groundedAnswer,
          )
        }

        traceSet({ route: route.type, groundedAnswerUsed: true, groundedAnswer, calendarAction: isCal ? 'read' : 'none', calendarStorageRead: isCal, finalResponse })
        traceEnd()
        const groundedMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: finalResponse, timestamp: Date.now() }
        setMessages(prev => [...prev, groundedMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Conversation recall ("מה אמרתי לך קודם?") ─────────────────────
      // Local-first: intelligently summarize what was discussed, not raw dump.
      const RECALL_RE = /מה אמרתי|על מי דיברנו|מה קבענו|למי אמרתי|what did I say|de qu[eé] hablamos/i
      if (RECALL_RE.test(msgText)) {
        const recent = messages.slice(-20, -1) // exclude current msg
        let recallContent: string

        if (recent.length === 0) {
          recallContent = 'עוד לא דיברנו על משהו בשיחה הזו.'
        } else {
          const parts: string[] = []

          // Find family members discussed
          const { loadGraph } = await import('./familyGraph')
          const graph = loadGraph()
          const mentioned = new Set<string>()
          for (const m of recent) {
            for (const node of graph) {
              if (m.content.includes(node.hebrew)) mentioned.add(node.hebrew)
            }
          }
          if (mentioned.size > 0) {
            parts.push(`דיברנו על ${Array.from(mentioned).join(', ')}`)
          }

          // Find calendar topics discussed
          const calKeywords = recent.some(m => /יומן|היום|מחר|השבוע|פגישה|תור/.test(m.content))
          if (calKeywords) parts.push('בדקנו את היומן')

          // Find reminders/appointments created
          const reminders = recent.some(m => m.role === 'assistant' && /רשמתי|קבעתי|אזכיר/.test(m.content))
          if (reminders) parts.push('קבענו תזכורת או פגישה')

          // Find last user statement
          const lastUserMsgs = recent.filter(m => m.role === 'user').slice(-3)
          if (lastUserMsgs.length > 0 && parts.length === 0) {
            parts.push(`אמרת: "${lastUserMsgs[lastUserMsgs.length - 1]!.content}"`)
          }

          recallContent = parts.length > 0
            ? parts.join('. ') + '.'
            : 'לא זוכרת נושא ברור שדיברנו עליו.'
        }
        const recallMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: recallContent, timestamp: Date.now() }
        setMessages(prev => [...prev, recallMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── B1 patch: proactive layer ────────────────────────────────────────
      // After grounding fails, check if the input is one of the warmth
      // intents (boredom / loneliness / no_topic / ideas). The proactive
      // helper is purely deterministic — no LLM, no API. Rotates via
      // `lastProactiveSeedIdRef` so a repeated "Estoy aburrida" never
      // returns the same seed twice in a row.
      const proactiveSeed = getProactiveSeed(msgText, {
        previousSeedId: lastProactiveSeedIdRef.current,
      })
      if (proactiveSeed) {
        lastProactiveSeedIdRef.current = proactiveSeed.id
        // Route emotional responses through LLM for natural variation
        // The seed text serves as grounded context (tone + intent)
        if (!voiceMode) {
          const enhanced = await groundedLLMAnswer(
            msgText,
            `Intent: ${proactiveSeed.intent}. Suggested response style: ${proactiveSeed.text}`,
            messages.map(m => ({ role: m.role, content: m.content })),
            proactiveSeed.text,
          )
          const proactiveMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: enhanced, timestamp: Date.now() }
          setMessages(prev => [...prev, proactiveMsg])
        } else {
          // Voice mode: use deterministic seed for speed
          const proactiveMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: proactiveSeed.text, timestamp: Date.now() }
          setMessages(prev => [...prev, proactiveMsg])
        }
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── B2.3 patch: content world for vague open prompts ────────────────
      // "Hola", "no sé", "שלום", "hi" — short greetings AbuAI should answer
      // with a calm 2–3 option opening instead of paying for a full LLM
      // call. We ONLY enter this branch when:
      //   • the input is non-personal (grounded path already missed)
      //   • the proactive layer did not match (estoy aburrida etc.)
      //   • the input is NOT a live-info query (films now / weather / news)
      //   • the content world picks `open_chat` AND ships gentle options
      //     (named content cues like film / cooking / podcast fall
      //     through to the open LLM stream so the model can be rich).
      if (!isOnlineCurrentInfoQuery(msgText) || shouldBlockOnlineForPersonal(msgText)) {
        const world = chooseContentWorld(msgText)
        if (world.contentMode === 'open_chat' && world.suggestedOpening && world.gentleOptions.length > 0) {
          const compiled = compileHumanAnswer(
            msgText,
            makeOpenEvidence('content_world_engine'),
            { lang: world.language, allowFollowUp: true },
            world,
          )
          const contentMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: compiled.text, timestamp: Date.now() }
          setMessages(prev => [...prev, contentMsg])
          setLoading(false)
          streamingMsgIdRef.current = null
          return
        }
      }

      // ─── B2 patch: online current-info layer ─────────────────────────────
      // Live questions (cinema / weather / news / "this week" / "open now")
      // need a real web lookup. The server endpoint /api/abuai-online holds
      // the OPENAI_API_KEY (server-side) and uses the OpenAI Responses API
      // with the built-in web_search tool. Personal/family/calendar queries
      // are blocked client-side AND server-side as defense in depth.
      if (isOnlineCurrentInfoQuery(msgText) && !shouldBlockOnlineForPersonal(msgText)) {
        const placeholderMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: 'רגע, בודקת אונליין...', timestamp: Date.now() }
        setMessages(prev => [...prev, placeholderMsg])
        const online = await answerOnlineCurrentInfo(msgText, { locationHint: 'Kfar Saba area, Israel' })
        if (online.ok) {
          _recordOnlineError(null)
          // Render the answer + sources (if any) appended on a new line so
          // Martita sees where the info came from, but the speech-friendly
          // text stays in the answer body.
          let body = online.answer
          if (online.sources && online.sources.length > 0) {
            const list = online.sources
              .slice(0, 3)
              .map((s) => s.title ? `• ${s.title}${s.url ? ` (${s.url})` : ''}` : (s.url ? `• ${s.url}` : ''))
              .filter((s) => s.length > 0)
              .join('\n')
            if (list) body = `${online.answer}\n\nמקורות:\n${list}`
          }
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(m => m.id === aiMsgId)
            if (idx !== -1) updated[idx] = { ...updated[idx]!, content: body }
            return updated
          })
        } else {
          _recordOnlineError(online.errorCode)
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(m => m.id === aiMsgId)
            if (idx !== -1) updated[idx] = { ...updated[idx]!, content: online.userMessage }
            return updated
          })
        }
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      // ─── Hard guard: temporal current-data queries without online tool ───
      // If the query asks for live/changing data (exchange rates, sports
      // scores, temperature) but the online detector did not catch it,
      // refuse honestly instead of sending to the LLM which might fabricate.
      const TEMPORAL_CURRENT = /שער ה?דולר|שער ה?יורו|מי ניצח|תוצאות ה?(משחק|ליגה|גביע)|מה הטמפרטורה (היום|עכשיו)|כמה מעלות (היום|עכשיו)|מה (ה?מחיר|העלות) של|בורסה היום|מניות|bitcoin|ביטקוין/i
      if (TEMPORAL_CURRENT.test(msgText) && !isOnlineCurrentInfoQuery(msgText)) {
        const honestMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: 'אני לא יכולה לבדוק את זה כרגע. תשאלי אותי שוב מאוחר יותר.', timestamp: Date.now() }
        setMessages(prev => [...prev, honestMsg])
        setLoading(false)
        streamingMsgIdRef.current = null
        return
      }

      if (isPersonalQuery(msgText)) {
        const placeholderMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: 'רגע, אני בודקת...', timestamp: Date.now() }
        setMessages(prev => [...prev, placeholderMsg])

        try {
          const response = await sendMessage(newMessages, false)
          accumulated = response
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(m => m.id === aiMsgId)
            if (idx !== -1) updated[idx] = { ...updated[idx]!, content: response }
            return updated
          })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'משהו לא עבד. ננסה שוב?'
          setMessages(prev => {
            const updated = [...prev]
            const idx = updated.findIndex(m => m.id === aiMsgId)
            if (idx !== -1) updated[idx] = { ...updated[idx]!, content: errMsg }
            return updated
          })
        } finally {
          setLoading(false)
        }
        streamingMsgIdRef.current = null
        return
      }

      // General questions → stream for responsiveness
      traceSet({ route: 'non_personal', groundedAnswerUsed: false, llmProvider: 'openai-server' })
      const placeholderMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '▍', timestamp: Date.now() }
      setMessages(prev => [...prev, placeholderMsg])
      setLoading(false)
      setIsStreaming(true)

      for await (const token of streamMessage(newMessages, false)) {
        accumulated += token
        setMessages(prev => {
          const updated = [...prev]
          const idx = updated.findIndex(m => m.id === aiMsgId)
          if (idx !== -1) {
            updated[idx] = { ...updated[idx]!, content: accumulated + '▍' }
          }
          return updated
        })
      }

      // Remove cursor, set final content — with truth guard
      setMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === aiMsgId)
        if (idx !== -1) {
          let finalContent = accumulated.trim()
          if (finalContent && containsUngroundedClaim(finalContent, false)) {
            finalContent = 'אני לא יכולה לבדוק את היומן כרגע. תפתחי את היומן או תשאלי אותי בכתב.'
          }
          if (finalContent) {
            updated[idx] = { ...updated[idx]!, content: finalContent }
          } else {
            // Empty response — show mediated error
            const mediated = mediateError('empty response')
            updated[idx] = { ...updated[idx]!, content: mediated.message, error: mediated }
          }
        }
        return updated
      })
      traceSet({ finalResponse: accumulated.trim() || null })
      traceEnd()
    } catch (err: unknown) {
      traceSet({ llmError: err instanceof Error ? err.message : String(err), finalResponse: accumulated.trim() || null, error: err instanceof Error ? err.message : String(err) })
      traceEnd()
      // v27: Mediate error — always Hebrew, always with action buttons
      const mediated: MediatedError = mediateError(err)
      setMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === aiMsgId)
        if (idx !== -1) {
          if (accumulated.trim()) {
            // Keep partial response + append error card as separate message
            updated[idx] = { ...updated[idx]!, content: accumulated.trim() }
            return [...updated, { id: nextId(), role: 'assistant', content: mediated.message, timestamp: Date.now(), error: mediated }]
          }
          updated[idx] = { ...updated[idx]!, content: mediated.message, error: mediated }
        }
        return updated
      })
    } finally {
      setLoading(false)
      setIsStreaming(false)
      streamingMsgIdRef.current = null
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Manual voice recording (fills text input) ────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await startMicStream()
      streamRef.current = stream
      const recorder = createRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (streamRef.current === stream) {
          try { stream.getTracks().forEach(t => t.stop()) } catch {}
          streamRef.current = null
        }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setRecording(false)

        const blob = assembleBlob(chunksRef.current, recorder)
        if (blob.size < 1000) return

        setTranscribing(true)
        try {
          const text = await transcribeAudio(blob)
          if (text.trim()) setInput(prev => prev ? `${prev} ${text}` : text)
        } catch (err) {
          // Never fail silently — show a friendly local fallback so Martita
          // knows she can simply type instead.
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: mediateVoiceCaptureError(err, 'transcription'), timestamp: Date.now() }])
        } finally {
          setTranscribing(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }

      recorder.start(100)
      setRecordingTime(0)
      setRecording(true)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: mediateVoiceCaptureError(err, 'permission_or_device'), timestamp: Date.now() }])
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop()
  }, [])

  const handleMicTap = () => {
    // Unified voice entry: mic button starts voice conversation mode
    // instead of dictation-to-text. One mental model for Martita.
    if (recording) stopRecording()
    else if (!loading && !transcribing) handleVoiceTap()
  }

  // ─── Voice Conversation Mode ──────────────────────────────────────────────

  const cleanupVoiceResources = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    setListenCountdown(null)
    cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
  }, [])

  // v20: Interrupt handler — stops TTS/LLM and resumes listening immediately
  const interruptAndListen = useCallback(() => {
    if (!voiceModeRef.current) return
    transitionVoice('INTERRUPTED', 'user-tap')

    // Abort any in-flight LLM request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Stop any TTS playback
    stopSpeaking()
    setIsSpeaking(false)
    setStreamingText('')

    // Cleanup any active mic/recognition from previous listen
    cleanupVoiceResources()

    // Small delay then resume listening via ref
    transitionVoice('RECOVERING', 'post-interrupt')
    setTimeout(() => {
      if (voiceModeRef.current) {
        startVoiceListeningRef.current()
      }
    }, 250)
  }, [cleanupVoiceResources, transitionVoice])

  const startVoiceListening = useCallback(() => {
    if (!voiceModeRef.current) return
    transitionVoice('LISTENING', 'start-listen')
    setVoicePhase('listening')
    setAudioLevel(0)
    setListenCountdown(null)
    setStreamingText('')

    const handleText = async (text: string) => {
      if (!voiceModeRef.current) return
      const lower = text.trim()
      if (/^(ביי|להתראות|תודה|עצור|עצרי|סטופ|stop|bye)$/i.test(lower)) {
        exitVoiceMode(); return
      }

      // ─── Self-listening guard ──────────────────────────────────────────
      // The mic can hear AbuAI's own TTS output and feed it back as input.
      // Reject transcripts that match known assistant phrases.
      const SELF_PHRASES = /רגע.*לא הצלחתי|לא הצלחתי.*בואי ננסה|בואי ננסה שוב|לא שמעתי טוב|התמלול לא עובד|משהו לא עבד|ננסה שוב/
      if (SELF_PHRASES.test(lower)) {
        console.warn('[VOICE] Self-listening blocked:', lower.slice(0, 40))
        if (voiceModeRef.current) startVoiceListening()
        return
      }
      // Also reject if TTS is currently playing (use ref to avoid stale closure)
      if (voiceStateRef.current === 'RESPONDING') {
        console.warn('[VOICE] Ignored transcript while TTS speaking:', lower.slice(0, 40))
        return
      }

      setLastHeardText(text) // v20: Show what was heard

      // Cross-turn pronoun resolution (voice path)
      const { resolved: resolvedText } = resolvePronouns(text, messagesRef.current)
      let effectiveText = resolvedText !== text ? resolvedText : text

      // Cross-turn follow-up resolution (voice path)
      const voiceFollowUp = resolveFollowUp(effectiveText, messagesRef.current)
      if (voiceFollowUp.wasFollowUp) effectiveText = voiceFollowUp.resolved

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: effectiveText, timestamp: Date.now() }
      const currentMsgs = [...messagesRef.current, userMsg]
      setMessages(currentMsgs)

      // ─── Calendar create (voice) — SAME rules as typed text ──────────────
      // Voice create/confirmation must be confirmation-gated and local-first,
      // exactly like the text path. We reuse the identical state-machine
      // helpers (startCreate / resolvePendingMessage) so there is no weaker
      // voice-only parser.
      const cs = createStateRef.current

      // ─── Unresolved pronoun guard (voice) ────────────────────────────
      const VOICE_UNRESOLVED = /(?<![֐-׿])(אליו|אליה|שלו|שלה|אותו|אותה|איתו|איתה)(?![֐-׿])/
      if (isCreateIntent(effectiveText) && VOICE_UNRESOLVED.test(effectiveText) && resolvedText === text) {
        const askWho = 'למי את מתכוונת?'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: askWho, timestamp: Date.now() }])
        if (voiceModeRef.current) {
          transitionVoice('RESPONDING', 'ask-who')
          setVoicePhase('speaking'); setIsSpeaking(true); setStreamingText(askWho)
          await speakVoiceMode(askWho)
          setIsSpeaking(false); setStreamingText('')
          if (voiceModeRef.current) startVoiceListening()
        }
        return
      }

      // ─── Voice reminder (before appointment create) ──────────────────
      if (isCreateIntent(effectiveText) && detectReminderIntent(effectiveText) === 'reminder' && cs.phase === 'idle') {
        try {
          const _n = new Date(); const _p = (n: number) => String(n).padStart(2,'0')
          const todayStr = `${_n.getFullYear()}-${_p(_n.getMonth()+1)}-${_p(_n.getDate())}`
          const draft = parseReminder(effectiveText, todayStr)
          let response: string
          if (draft.dueAt && draft.title && !draft.ambiguity && draft.missingFields.length === 0) {
            setPendingReminder(draft)
            response = `${draft.readbackText}\n\nלשמור?`
          } else if (draft.missingFields.includes('time')) {
            setPendingReminder(draft) // dueAt undefined → triggers time follow-up
            response = `הבנתי: ${draft.title ?? text}\nמתי להזכיר לך?`
          } else {
            response = draft.readbackText ? `${draft.readbackText}\nלשמור?` : 'לא הצלחתי להבין. מתי להזכיר לך?'
            if (draft.dueAt && draft.title) setPendingReminder(draft)
          }
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }])
          if (!voiceModeRef.current) return
          transitionVoice('RESPONDING', 'reminder-turn')
          setVoicePhase('speaking'); setIsSpeaking(true); setStreamingText(response)
          await speakVoiceMode(shapeVoiceSafe(response))
          setIsSpeaking(false); setStreamingText('')
          if (!voiceModeRef.current) return
          await new Promise(r => setTimeout(r, 120))
          if (voiceModeRef.current) startVoiceListening()
        } catch {
          setIsSpeaking(false); setStreamingText('')
          if (voiceModeRef.current) { transitionVoice('RECOVERING', 'post-reminder-error'); startVoiceListening() }
        }
        return
      }

      // ─── Voice pending reminder confirmation ──────────────────────────
      if (pendingReminder && (isConfirm(effectiveText) || isCancel(effectiveText))) {
        try {
          let response: string
          if (isConfirm(effectiveText)) {
            const { saved } = createReminder({
              category: pendingReminder.category,
              title: pendingReminder.title ?? '',
              dueAt: pendingReminder.dueAt ?? new Date().toISOString(),
              displayDateLabel: pendingReminder.displayDateLabel ?? '',
              displayTimeLabel: pendingReminder.displayTimeLabel ?? '',
              ...(pendingReminder.recurrence ? { recurrence: pendingReminder.recurrence } : {}),
              alertPolicy: { ...createDefaultAlertPolicy(), ...pendingReminder.alertPolicyDraft },
            })
            setPendingReminder(null)
            response = saved ? `רשמתי. אזכיר לך ${pendingReminder.title ?? ''}.` : 'לא הצלחתי לשמור את התזכורת.'
            if (saved) soundSuccess()
          } else {
            setPendingReminder(null)
            response = 'בסדר, ביטלתי.'
          }
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }])
          if (!voiceModeRef.current) return
          transitionVoice('RESPONDING', 'reminder-confirm-turn')
          setVoicePhase('speaking'); setIsSpeaking(true); setStreamingText(response)
          await speakVoiceMode(shapeVoiceSafe(response))
          setIsSpeaking(false); setStreamingText('')
          if (!voiceModeRef.current) return
          await new Promise(r => setTimeout(r, 120))
          if (voiceModeRef.current) startVoiceListening()
        } catch {
          setIsSpeaking(false); setStreamingText('')
          if (voiceModeRef.current) { transitionVoice('RECOVERING', 'post-reminder-confirm-error'); startVoiceListening() }
        }
        return
      }

      // Recurring intent — honest limitation (voice flow)
      if (cs.phase === 'idle' && isCreateIntent(effectiveText) && isRecurringIntent(effectiveText)) {
        const recurResponse = 'כרגע אני יודעת לקבוע פגישה בודדת. תגידי לי את התאריך הספציפי ואני אקבע.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: recurResponse, timestamp: Date.now() }])
        if (!voiceModeRef.current) return
        transitionVoice('RESPONDING', 'recurring-limitation')
        setVoicePhase('speaking'); setIsSpeaking(true); setStreamingText(recurResponse)
        try {
          await speakVoiceMode(shapeVoiceSafe(recurResponse))
        } catch { /* ignore */ }
        setIsSpeaking(false); setStreamingText('')
        if (voiceModeRef.current) { await new Promise(r => setTimeout(r, 120)); startVoiceListening() }
        return
      }

      if (cs.phase !== 'idle' || isCreateIntent(effectiveText)) {
        try {
          let response: string
          if (cs.phase !== 'idle') {
            const r = routePersonalQuery(text)
            const isCalRead = r.type.startsWith('calendar_') && r.type !== 'calendar_create'
            const resolution = resolvePendingMessage(cs, text, isCalRead)
            if (resolution.action === 'cancel') {
              setCreateState(IDLE_STATE); createStateRef.current = IDLE_STATE
              response = shapeCreateCancelled()
            } else if (resolution.action === 'save') {
              const d = resolution.draft
              addAppointment({ title: d.title!, date: d.date!, time: d.time!, emoji: d.emoji ?? '📅' })
              soundSuccess()
              setCreateState(IDLE_STATE); createStateRef.current = IDLE_STATE
              response = shapeCreateSaved(d)
            } else if (resolution.action === 'replace' || resolution.action === 'update') {
              setCreateState(resolution.state); createStateRef.current = resolution.state
              response = resolution.state.phase === 'confirming'
                ? shapeCreateConfirm(resolution.state.draft)
                : shapeCreateClarify(resolution.state.missing, resolution.state.draft)
              // Conflict detection for voice flow updates
              if (resolution.state.phase === 'confirming' && resolution.state.draft.date && resolution.state.draft.time) {
                const conflicts = findConflicts(resolution.state.draft.date, resolution.state.draft.time)
                if (conflicts.length > 0) {
                  const conflictText = conflicts.map(c => c.title).join(', ')
                  response = `שימי לב — כבר יש לך ${conflictText} באותו זמן.\n${response}`
                }
              }
            } else if (resolution.action === 'read') {
              response = tryGroundedAnswer(text) ?? shapeCreateUnclear()
            } else {
              response = shapeCreateUnclear()
            }
          } else {
            const next = startCreate(text)
            setCreateState(next); createStateRef.current = next
            response = next.phase === 'confirming'
              ? shapeCreateConfirm(next.draft)
              : shapeCreateClarify(next.missing, next.draft)
            // Conflict detection for voice flow new create
            if (next.phase === 'confirming' && next.draft.date && next.draft.time) {
              const conflicts = findConflicts(next.draft.date, next.draft.time)
              if (conflicts.length > 0) {
                const conflictText = conflicts.map(c => c.title).join(', ')
                response = `שימי לב — כבר יש לך ${conflictText} באותו זמן.\n${response}`
              }
            }
          }
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }])
          if (!voiceModeRef.current) return
          transitionVoice('RESPONDING', 'create-turn')
          setVoicePhase('speaking'); setIsSpeaking(true); setStreamingText(response)
          await speakVoiceMode(shapeVoiceSafe(response))
          setIsSpeaking(false); setStreamingText('')
          if (!voiceModeRef.current) return
          await new Promise(r => setTimeout(r, 120))
          if (voiceModeRef.current) startVoiceListening()
        } catch {
          setIsSpeaking(false); setStreamingText('')
          if (voiceModeRef.current) {
            transitionVoice('RECOVERING', 'post-create-error')
            startVoiceListening()
          }
        }
        return
      }

      // v20.1: PROVEN non-streaming voice path — fast LLM + full TTS (no cutoff)
      try {
        transitionVoice('PROCESSING', 'got-text')
        setVoicePhase('processing')
        soundProcessing()

        // Create abort controller for interruption
        const ac = new AbortController()
        abortControllerRef.current = ac

        // Watchdog: force recovery if stuck >20s in processing
        const watchdog = setTimeout(() => {
          if (voiceModeRef.current && voiceStateRef.current === 'PROCESSING') {
            transitionVoice('RECOVERING', 'watchdog-20s')
            ac.abort()
            startVoiceListening()
          }
        }, 20000)

        // Try grounded answer first (no LLM for personal queries)
        // B1 voice ordering: grounded → proactive → LLM. Grounded ALWAYS
        // wins; the proactive layer never answers calendar / family /
        // personal questions because getProactiveSeed only fires on the
        // four warmth intents (boredom / no_topic / loneliness / ideas).
        const voiceGrounded = tryGroundedAnswer(text)
        let response: string
        if (voiceGrounded !== null) {
          // LLM paraphrase for natural spoken answers (falls back to deterministic if LLM fails)
          response = await groundedLLMAnswer(
            text,
            voiceGrounded,
            messages.map(m => ({ role: m.role, content: m.content })),
            voiceGrounded,
          )
        } else {
          const voiceProactive = getProactiveSeed(text, {
            previousSeedId: lastProactiveSeedIdRef.current,
          })
          // B2.3 voice: same content-world short-circuit as the text
          // path. Vague open prompts (hola / no sé) get a deterministic
          // opening spoken instead of a full LLM call. Voice mode skips
          // the bullet-list follow-up — speech sounds unnatural reading
          // "•". allowFollowUp = false ensures only the opening renders.
          const voiceWorld = (!isOnlineCurrentInfoQuery(text) || shouldBlockOnlineForPersonal(text))
            ? chooseContentWorld(text)
            : null
          const voiceWorldFires =
            voiceWorld !== null
            && voiceWorld.contentMode === 'open_chat'
            && voiceWorld.suggestedOpening !== ''
            && voiceWorld.gentleOptions.length > 0
          if (voiceProactive) {
            lastProactiveSeedIdRef.current = voiceProactive.id
            response = voiceProactive.text
          } else if (voiceWorldFires) {
            const compiled = compileHumanAnswer(
              text,
              makeOpenEvidence('content_world_engine'),
              { lang: voiceWorld!.language, allowFollowUp: false },
              voiceWorld!,
            )
            response = compiled.text
          } else if (isOnlineCurrentInfoQuery(text) && !shouldBlockOnlineForPersonal(text)) {
            // B2: online current-info via server endpoint. Voice mode
            // speaks the answer concisely; sources are not read aloud.
            const online = await answerOnlineCurrentInfo(text, { locationHint: 'Kfar Saba area, Israel' })
            if (online.ok) {
              _recordOnlineError(null)
              response = online.answer
            } else {
              _recordOnlineError(online.errorCode)
              response = online.userMessage
            }
          } else {
            // ── Streaming LLM + progressive TTS ──────────────────────
            // Stream tokens and speak each sentence as it completes.
            // First sentence plays while the rest is still generating,
            // cutting perceived latency roughly in half.
            if (ac.signal.aborted) { clearTimeout(watchdog); return } // abort-early guard

            transitionVoice('RESPONDING', 'stream-speak-start')
            setVoicePhase('speaking')
            setIsSpeaking(true)

            let streamedText = ''
            const streamAiMsgId = nextId()
            setMessages(prev => [...prev, { id: streamAiMsgId, role: 'assistant', content: '▍', timestamp: Date.now() }])

            // Async iterable that captures text and updates the chat bubble
            async function* capturedStream(): AsyncGenerator<string, void, undefined> {
              for await (const token of streamMessage(currentMsgs, true, ac.signal)) {
                if (ac.signal.aborted) return
                streamedText += token
                setStreamingText(streamedText)
                setMessages(prev => {
                  const updated = [...prev]
                  const idx = updated.findIndex(m => m.id === streamAiMsgId)
                  if (idx !== -1) updated[idx] = { ...updated[idx]!, content: streamedText }
                  return updated
                })
                yield token
              }
            }

            // streamSpeakVoiceMode detects sentence boundaries and fires
            // TTS per sentence while still consuming the token stream.
            clearTimeout(watchdog)
            await Promise.race([
              _streamSpeakVoiceMode(
                capturedStream(),
                (phase) => {
                  if (phase === 'done') { setIsSpeaking(false); setStreamingText('') }
                },
                ac.signal,
              ),
              new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('STREAM_TTS_TIMEOUT')), 20000)
              ),
            ]).catch(() => { stopSpeaking() })

            // Finalize chat message with full streamed text
            if (streamedText.trim()) {
              const finalContent = containsUngroundedClaim(streamedText.trim(), false)
                ? 'אני לא יכולה לבדוק את היומן כרגע. תפתחי את היומן או תשאלי אותי בכתב.'
                : streamedText.trim()
              setMessages(prev => {
                const updated = [...prev]
                const idx = updated.findIndex(m => m.id === streamAiMsgId)
                if (idx !== -1) updated[idx] = { ...updated[idx]!, content: finalContent }
                return updated
              })
            }

            setIsSpeaking(false)
            setStreamingText('')
            abortControllerRef.current = null

            if (!voiceModeRef.current) return
            await new Promise(r => setTimeout(r, 800))
            if (voiceModeRef.current) startVoiceListening()
            return // streaming TTS path complete — skip serial speak below
          }
        }
        clearTimeout(watchdog)

        if (ac.signal.aborted) return // interrupted during LLM call

        const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }
        setMessages(prev => [...prev, aiMsg])
        if (!voiceModeRef.current) return

        // Speak the full response (for grounded / proactive / content-world / online).
        // These are fast deterministic answers — serial TTS is fine.
        // B2.4: voice-safe shaping strips bullets, URLs, and multi-line
        // profile dumps, then caps at ≤ 2 sentences so the spoken answer
        // feels human instead of like a recited list.
        transitionVoice('RESPONDING', 'speak-start')
        setVoicePhase('speaking')
        setIsSpeaking(true)
        setStreamingText(response)

        const spokenText = shapeVoiceSafe(response)
        await speakVoiceMode(spokenText)

        setIsSpeaking(false)
        setStreamingText('')
        abortControllerRef.current = null

        if (!voiceModeRef.current) return
        // Post-TTS cooldown — wait for speaker audio to fade before mic resumes.
        // 800ms prevents the mic from picking up AbuAI's own voice (self-listening bug).
        await new Promise(r => setTimeout(r, 800))
        if (voiceModeRef.current) startVoiceListening()
      } catch (err) {
        abortControllerRef.current = null
        setIsSpeaking(false)
        setStreamingText('')
        if ((err as DOMException)?.name === 'AbortError') return // interrupted
        transitionVoice('ERROR', err instanceof Error ? err.message : 'unknown')
        const errText = err instanceof Error ? err.message : 'משהו לא עבד. ננסה שוב?'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: errText, timestamp: Date.now() }])
        if (voiceModeRef.current) {
          setVoicePhase('speaking'); setIsSpeaking(true)
          await speakVoiceMode(errText)
          setIsSpeaking(false)
          await new Promise(r => setTimeout(r, 120))
          if (voiceModeRef.current) {
            transitionVoice('RECOVERING', 'post-error')
            startVoiceListening()
          }
        }
      }
    }

    // v17.3: Web Speech API as PRIMARY (fastest turn detection), Whisper as FALLBACK
    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (WSR) {
      const rec = new WSR() as any
      // v20: Respect language setting from Settings
      const voiceLangSetting = localStorage.getItem('abu-voice-lang') || 'auto'
      rec.lang = voiceLangSetting === 'es' ? 'es-AR' : 'he-IL'
      rec.continuous = false
      rec.interimResults = true
      rec.maxAlternatives = 1

      let gotResult = false
      let finalTranscript = ''

      rec.onresult = (e: any) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (result.isFinal) {
            finalTranscript += result[0]?.transcript ?? ''
            gotResult = true
            wsEmptyCountRef.current = 0 // reset backoff on successful result
          } else {
            interim += result[0]?.transcript ?? ''
          }
        }
        if (interim) setAudioLevel(0.6)
        if (gotResult && finalTranscript.trim()) {
          recognitionRef.current = null
          setVoicePhase('processing')
          handleText(finalTranscript.trim())
          finalTranscript = ''
        }
      }

      rec.onerror = (e: any) => {
        recognitionRef.current = null
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          // Permission denied — never exit silently. Show + speak a friendly
          // Hebrew fallback that points Martita to the text box.
          const fallback = 'אני לא מצליחה לשמוע כרגע. אפשר לכתוב לי כאן.'
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: fallback, timestamp: Date.now() }])
          try { speakVoiceMode(fallback) } catch { /* TTS best-effort */ }
          exitVoiceMode()
        } else {
          // Web Speech failed — fall through to Whisper below
          if (voiceModeRef.current) startWhisperFallback()
        }
      }

      rec.onend = () => {
        recognitionRef.current = null
        if (!gotResult && voiceModeRef.current) {
          // No result from Web Speech — restart with backoff, max 5 empty rounds
          wsEmptyCountRef.current++
          if (wsEmptyCountRef.current >= 5) {
            wsEmptyCountRef.current = 0
            startWhisperFallback()
          } else {
            const delay = Math.min(50 * Math.pow(2, wsEmptyCountRef.current - 1), 800)
            setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, delay)
          }
        }
      }

      try {
        rec.start()
        recognitionRef.current = rec
        return
      } catch {
        recognitionRef.current = null
        // Fall through to Whisper
      }
    }

    // Whisper fallback (when Web Speech API not available or failed)
    startWhisperFallback()

    function startWhisperFallback() {
    ;(async () => {
      try {
        const stream = await startMicStream()
        streamRef.current = stream
        const recorder = createRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          if (streamRef.current === stream) {
            try { stream.getTracks().forEach(t => t.stop()) } catch {}
            streamRef.current = null
          }
          if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
          if (silenceRef.current) { try { silenceRef.current.stop() } catch {}; silenceRef.current = null }
          if (!voiceModeRef.current) return

          const blob = assembleBlob(chunksRef.current, recorder)
          if (blob.size < 300) {
            if (voiceModeRef.current) startVoiceListening()
            return
          }
          setVoicePhase('processing')
          try {
            const text = await transcribeAudio(blob)
            if (!text.trim()) {
              if (voiceModeRef.current) startVoiceListening()
              return
            }
            handleText(text.trim())
          } catch (err) {
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: mediateVoiceCaptureError(err, 'transcription'), timestamp: Date.now() }])
            // SttExhaustedError = all providers failed repeatedly → stop
            // listening to prevent infinite loop. Otherwise retry once.
            if (err instanceof SttExhaustedError) {
              console.warn('[AbuAI] STT exhausted, exiting voice mode')
              exitVoiceMode()
            } else if (voiceModeRef.current) {
              startVoiceListening()
            }
          }
        }

        recorder.start(100)

        // v17.3: Silence detection — 2s balance between patience and responsiveness
        const detector = createSilenceDetector(stream, () => {
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        }, noiseMode === 'noisy'
          ? { threshold: 40, silenceMs: 3000, maxMs: 15000, minActiveMs: 2500 }  // TV/noise: very strict
          : { threshold: 25, silenceMs: 3000, maxMs: 15000, minActiveMs: 2000 }  // quiet room — 3s for elderly pauses
        )
        silenceRef.current = detector

        // T1.3: Poll audio level for visual feedback (50ms intervals)
        if (levelRef.current) clearInterval(levelRef.current)
        levelRef.current = setInterval(() => {
          const lvl = detector.getLevel()
          setAudioLevel(Math.min(1, lvl / 60)) // normalize 0-60 → 0-1
        }, 50)

        // Visual countdown (max 30 seconds — elderly needs more time)
        const LISTEN_SEC = 30
        setListenCountdown(LISTEN_SEC)
        let cdSec = LISTEN_SEC
        const cdInterval = setInterval(() => {
          cdSec--
          if (cdSec > 0) {
            setListenCountdown(cdSec)
          } else {
            clearInterval(cdInterval)
            setListenCountdown(null)
          }
        }, 1000)
        const origStop = detector.stop
        detector.stop = () => { origStop(); clearInterval(cdInterval); setListenCountdown(null) }
      } catch (err) {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: mediateVoiceCaptureError(err, 'permission_or_device'), timestamp: Date.now() }])
        console.error('[AbuAI] getUserMedia error:', err)
        exitVoiceMode()
      }
    })()
    } // end startWhisperFallback
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // v20: Keep ref in sync for interruption→listen cycle
  startVoiceListeningRef.current = startVoiceListening

  // v17: WakeLock prevents screen dimming during voice mode
  const wakeLockRef = useRef<any>(null)
  const acquireWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch { /* silent — not critical */ }
  }
  const releaseWakeLock = () => {
    try { wakeLockRef.current?.release(); wakeLockRef.current = null } catch { /* silent */ }
  }

  // v30.2: Recompute on each voice session entry, not once at mount
  const buildRealtimeInstructions = useCallback(() => {
    let calendarSnapshot = ''
    try {
      const todayResult = getTodayEvents()
      const tmrwResult = getTomorrowEvents()
      calendarSnapshot = `\n═══ מידע אמיתי מהיומן (נכון לרגע זה) ═══\nהיום: ${todayResult.summary}\nמחר: ${tmrwResult.summary}\nזה המידע היחיד שיש לך. אל תמציאי מעבר לזה.\n`
    } catch {
      calendarSnapshot = '\n═══ יומן ═══\nאין לי גישה ליומן כרגע. אל תמציאי אירועים.\n'
    }

    // Select 5 representative few-shot pairs formatted as plain text
    const fewShotPairs = [
      { q: 'איך אני משלמת חשמל?', a: 'לחצי על "חברת החשמל" — נכנסת ישר לאתר שלהם, שם רואים את החשבון ומשלמים.' },
      { q: 'ספרי לי בדיחה', a: 'זקן נכנס לרופא ואומר: "דוקטור, כל מקום שאני נוגע — כואב!" הרופא בודק ואומר: "האצבע שלך שבורה."' },
      { q: 'אני מרגישה קצת בודדה היום', a: 'ימים כאלה יש. אני כאן.\n\nתתקשרי למור או ללאו — גם עשר דקות של שיחה משנות.' },
      { q: 'Cuéntame algo interesante', a: '¿Sabías que las abejas reconocen caras humanas? Las entrenan con fotos y las recuerdan horas después. Chiquitas pero brillantes.\n\nComo vos, Martita.' },
      { q: 'תסבירי לי מה זה AI', a: 'תוכנה שאימנו אותה על מיליארדי משפטים — ספרים, אתרים, שיחות — עד שהיא מתחילה "להבין" דפוסים ולענות. זה אני. לא קסם, סתם הרבה מאוד חישובים.' },
    ]
    const fewShotText = fewShotPairs
      .map(p => `שאלה: ${p.q}\nתשובה: ${p.a}`)
      .join('\n\n')

    return `${SYSTEM_PROMPT}${VOICE_SUFFIX}
${calendarSnapshot}
═══ כלל ברזל — יומן ═══
יש לך מידע אמיתי מהיומן למעלה. תשתמשי רק בו.
אם שואלים על יום שאין לך מידע עליו — תגידי:
"אני יודעת רק על היום ומחר. לשאר הימים, תפתחי את היומן."
לעולם אל תמציאי אירועים שלא מופיעים למעלה.
לעולם אל תמציאי אירועים, תורים, או פגישות.
לעולם אל תגידי "יש לך..." או "אני רואה ש..." על אירועים ביומן.
אם לא בדקת — לא קיים.

═══ VOICE DELIVERY — CRITICAL ═══
Voice style: Speak slowly, warmly, gently. Like a kind woman on a relaxed phone call with her close friend.
Pace: Slow and comfortable. Never rush. Pause naturally between sentences.
Tone: Soft, warm, intimate. Not professional. Not formal. Not a news anchor. A real person.
Emotion: Vary your tone — gentle when comforting, light when joking, thoughtful when explaining.
Breathing: Take natural breaths between phrases. Let silence exist between thoughts.
Hebrew: Native Israeli accent. Casual everyday Hebrew. Not literary. Not American-accented.
Spanish: Argentine Rioplatense accent. Use "vos". Warm, like an abuela from Buenos Aires.
NEVER: Sound robotic, monotone, rushed, overly cheerful, or like reading from a script.

═══ דוגמאות לשיחה ═══
${fewShotText}`
  }, [])

  // v21: Pipeline voice mode extracted so Realtime can fall back to it
  // v31: Speak greeting aloud — user tapped button so we have gesture context for iOS audio
  const startPipelineVoiceMode = useCallback(async () => {
    const todayKey = new Date().toISOString().split('T')[0]!
    const isFirstToday = localStorage.getItem('abuai-voice-date') !== todayKey
    if (isFirstToday) localStorage.setItem('abuai-voice-date', todayKey)

    const greeting = getVoiceGreeting()
    const greetMsg: ChatMessage = { id: nextId(), role: 'assistant', content: greeting, timestamp: Date.now() }
    setMessages(prev => [...prev, greetMsg])

    // Speak the greeting aloud before starting to listen
    transitionVoice('RESPONDING', 'greeting-speak')
    setVoicePhase('speaking')
    try {
      await speakVoiceMode(greeting)
    } catch { /* TTS failed, continue to listening anyway */ }

    // Now start listening — after TTS finishes so mic doesn't pick up speaker output
    transitionVoice('LISTENING', 'greeting-done-to-listen')
    setVoicePhase('listening')
    setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, 200)
  }, [startVoiceListening, transitionVoice])

  const enterVoiceMode = useCallback(() => {
    unlockIOSAudio()
    acquireWakeLock()
    setVoiceMode(true)
    voiceModeRef.current = true
    resetSttFailureCount() // fresh session — clear any previous STT failures

    // v25.2: SIMPLE DECISION — can we use Realtime or not?
    const quotaFlag = localStorage.getItem('abu-openai-quota-failed')
    const openaiAvailable = useRealtime && (!quotaFlag || (Date.now() - parseInt(quotaFlag, 10)) > 300_000)

    // Realtime disabled → use pipeline mode (STT → local-first router → LLM → TTS).
    // OpenAI is still available as LLM provider via sendMessage().
    if (!openaiAvailable) {
      console.log('[AbuAI] Pipeline voice mode (Realtime disabled). LLM providers: OpenAI → Groq → Gemini')
      startPipelineVoiceMode()
      return
    }

    // Use OpenAI Realtime API (WebRTC) if available
    if (useRealtime) {
      setRealtimeTranscript('')
      const session = new RealtimeVoiceSession(
        {
          onStateChange: (state) => {
            setRealtimeState(state)
            if (state === 'listening') setVoicePhase('listening')
            else if (state === 'speaking') { setVoicePhase('speaking'); setIsSpeaking(true) }
            else if (state === 'connecting') setVoicePhase('greeting')
            else if (state === 'error') setVoicePhase(null)

            if (state === 'listening') setIsSpeaking(false)

            // v24.3: Safety — if connection is stuck (no speaking event in 3 min), auto-exit
            // Normal conversation resets this timer every time AI speaks
            if (voiceSafetyTimerRef.current) { clearTimeout(voiceSafetyTimerRef.current); voiceSafetyTimerRef.current = null }
            if (state === 'listening') {
              voiceSafetyTimerRef.current = setTimeout(() => {
                console.log('[AbuAI] Connection may be dead — no activity for 3 min')
                exitVoiceMode()
              }, 180_000) // 3 minutes — only for broken connections, not normal pauses
            }
          },
          onUserTranscript: (text) => {
            setLastHeardText(text)
            setMessages(prev => [...prev, { id: nextId(), role: 'user', content: text, timestamp: Date.now() }])
          },
          onAssistantTranscript: (text) => {
            setRealtimeTranscript('')
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: text, timestamp: Date.now() }])
          },
          onAssistantDelta: (delta) => {
            setRealtimeTranscript(prev => prev + delta)
          },
          onError: (error) => {
            console.error('[Realtime] Error:', error)
            // v27: Mediate error — always Hebrew, always with action buttons
            const mediated = mediateError(error)
            if (mediated.category === 'quota' || mediated.category === 'auth' || mediated.category === 'rate-limit') {
              try { localStorage.setItem('abu-openai-quota-failed', String(Date.now())) } catch {}
            }
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: mediated.message, timestamp: Date.now(), error: mediated }])
          },
        },
        buildRealtimeInstructions(),
        // v25: onFatalError — Realtime died, remember + fall back to free pipeline
        () => {
          console.log('[AbuAI] Realtime failed, saving quota flag, falling back to free pipeline')
          try { localStorage.setItem('abu-openai-quota-failed', String(Date.now())) } catch { /* quota */ }
          realtimeRef.current = null
          setRealtimeState('idle')
          setRealtimeTranscript('')
          setVoicePhase(null) // clear any stale phase before pipeline sets its own
          setTimeout(() => startPipelineVoiceMode(), 100) // small delay to let state settle
        },
        noiseMode as 'quiet' | 'noisy',
      )
      realtimeRef.current = session
      session.connect()
      return
    }

    // No OpenAI key — use pipeline directly
    startPipelineVoiceMode()
  }, [startPipelineVoiceMode, useRealtime, buildRealtimeInstructions])

  const exitVoiceMode = useCallback(() => {
    // v22.5: Clear safety timer
    if (voiceSafetyTimerRef.current) { clearTimeout(voiceSafetyTimerRef.current); voiceSafetyTimerRef.current = null }
    // Disconnect Realtime session if active
    if (realtimeRef.current) {
      realtimeRef.current.disconnect()
      realtimeRef.current = null
      setRealtimeState('idle')
      setRealtimeTranscript('')
    }

    transitionVoice('IDLE', 'exit-voice-mode')
    voiceModeRef.current = false
    setVoiceMode(false)
    setVoicePhase(null)
    setAudioLevel(0)
    setIsSpeaking(false)
    setLastHeardText('')
    setStreamingText('')
    setPttActive(false)
    stopSpeaking()
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
    cleanupVoiceResources()
    releaseWakeLock()
  }, [cleanupVoiceResources, transitionVoice])

  const handleVoiceTap = () => {
    if (voiceMode) exitVoiceMode()
    else enterVoiceMode()
  }

  // v22.6: Push-to-talk state for noisy mode
  const [pttActive, setPttActive] = useState(false) // user is currently holding/speaking

  const handleOrbTap = () => {
    // Push-to-talk mode — tap to start/stop speaking
    if (realtimeRef.current?.isPushToTalk) {
      if (pttActive) {
        // Stop talking → send audio to AI
        realtimeRef.current.stopTalking()
        setPttActive(false)
        setVoicePhase('processing')
      } else if (voicePhase === 'listening' || voicePhase === 'processing') {
        // Start talking → clear buffer, listen
        realtimeRef.current.startTalking()
        setPttActive(true)
        setVoicePhase('listening')
      } else if (voicePhase === 'speaking') {
        // Interrupt AI
        realtimeRef.current.interrupt()
      }
      return
    }

    if (realtimeRef.current && realtimeState === 'speaking') {
      realtimeRef.current.interrupt()
      return
    }
    const state = voiceStateRef.current
    if (state === 'RESPONDING' || voicePhase === 'speaking') {
      interruptAndListen()
    } else if (voicePhase === 'listening') {
      exitVoiceMode()
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const hasInput = input.trim().length > 0
  const sendDisabled = !hasInput || loading
  const micDisabled = loading || transcribing

  // suppress unused warnings
  // Shared gold gradient text style
  const goldGradText: React.CSSProperties = {
    background: 'linear-gradient(135deg, #A7F3D0 0%, #34D399 20%, #10B981 45%, #14B8A6 60%, #0D9488 80%, #5EEAD4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 0 10px rgba(20,184,166,0.35))',
  }

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        maxWidth: 412,
        margin: '0 auto',
        overflow: 'hidden',
        background: BG,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Sans','Heebo',sans-serif",
        position: 'relative',
      }}
    >
      <ScreenHeader
        title="Abu AI"
        left={<BackButton onPress={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }} />}
        right={
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: voicePhase === 'listening'
              ? `${2 + audioLevel * 4}px solid #7EB4B8`
              : voicePhase === 'processing'
              ? '2.5px solid rgba(212,184,122,0.70)'
              : isSpeaking
              ? '2.5px solid rgba(20,184,166,0.80)'
              : voiceMode
              ? '2px solid #D4B87A'
              : '2px solid rgba(20,184,166,0.42)',
            boxShadow: voicePhase === 'listening'
              ? `0 0 0 ${2 + audioLevel * 3}px rgba(126,180,184,0.40), 0 0 ${12 + audioLevel * 20}px rgba(126,180,184,0.30)`
              : voicePhase === 'processing'
              ? '0 0 0 2px rgba(212,184,122,0.40), 0 0 20px rgba(212,184,122,0.25)'
              : isSpeaking
              ? `0 0 0 ${2 + audioLevel * 3}px rgba(20,184,166,0.75), 0 0 24px rgba(20,184,166,0.30)`
              : voiceMode
              ? '0 0 0 2px rgba(212,184,122,0.30), 0 0 16px rgba(212,184,122,0.15)'
              : '0 0 0 2px rgba(20,184,166,0.42), 0 0 16px rgba(20,184,166,0.12)',
            transition: 'box-shadow 0.15s ease, transform 0.1s ease, border 0.15s ease',
            transform: isSpeaking ? `scale(${1 + audioLevel * 0.12})` : undefined,
            overflow: 'hidden',
            background: '#1a140a',
            flexShrink: 0,
          }}>
            <img
              src={martitaPhoto}
              alt="Martita"
              loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', display: 'block' }}
              onError={handleMartitaImgError}
            />
          </div>
        }
      />

      {/* ─────────────────────── CHAT AREA ─────────────────────── */}
      <div
        ref={chatRef}
        className="abuai-chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px 16px 12px',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'transparent',
        }}
      >
        {/* ──────── EMPTY STATE ──────── */}
        {messages.length === 0 && !loading && !voiceMode && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 60,
            gap: 24,
            animation: 'fadeSlideUp 0.65s ease-out both',
          }}>
            {/* Monogram circle 120px with 2 ripple rings */}
            <div style={{
              position: 'relative',
              width: 120,
              height: 120,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Ripple ring 1 */}
              <div aria-hidden="true" style={{
                position: 'absolute',
                width: '168%', height: '168%',
                borderRadius: '50%',
                border: '1px solid rgba(20,184,166,0.28)',
              }} />
              {/* Static halo ring 2 */}
              <div aria-hidden="true" style={{
                position: 'absolute',
                borderRadius: '50%',
                border: '1px solid rgba(20,184,166,0.15)',
                width: '210%', height: '210%',
              }} />
              {/* Orb body */}
              <div style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.25) 0%, rgba(20,184,166,0.12) 38%, rgba(20,184,166,0.04) 62%, transparent 80%)',
                border: '1.5px solid rgba(20,184,166,0.55)',
                boxShadow: '0 0 0 1px rgba(20,184,166,0.18), 0 0 60px rgba(20,184,166,0.22), 0 0 120px rgba(20,184,166,0.10), inset 0 1px 0 rgba(255,250,240,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
                animation: 'subtleBreath 4s ease-in-out infinite',
              }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontSize: 58,
                  fontWeight: 600,
                  fontStyle: 'italic',
                  background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 30%, #C9A84C 70%, #F0C060 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 10px rgba(20,184,166,0.35))',
                }}>M</span>
              </div>
            </div>

            {/* Headline */}
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: TEXT,
              fontFamily: "'DM Sans',sans-serif",
              textAlign: 'center',
              direction: 'rtl',
              lineHeight: 1.5,
            }}>
              שלום{' '}
              <span style={{
                fontFamily: "'Cormorant Garamond',serif",
                fontStyle: 'italic',
                fontSize: 26,
                color: '#2DD4BF',
                WebkitTextFillColor: '#2DD4BF',
              }}>Martita</span>
            </div>

            {/* Subtitle */}
            <div style={{
              fontSize: 16,
              color: 'rgba(245,240,232,0.50)',
              textAlign: 'center',
              direction: 'rtl',
              lineHeight: 1.7,
              maxWidth: 260,
              fontFamily: "'Heebo',sans-serif",
            }}>
              שאלי אותי כל דבר — עברית, ספרדית, כל נושא
            </div>

            {/* Voice invitation card */}
            <div
              role="button"
              tabIndex={0}
              onClick={enterVoiceMode}
              onKeyDown={e => e.key === 'Enter' && enterVoiceMode()}
              style={{
                marginTop: 32,
                padding: '20px 28px',
                background: 'rgba(255,250,240,0.03)',
                border: '1px solid rgba(20,184,166,0.22)',
                borderRight: '3px solid rgba(20,184,166,0.55)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 24px rgba(20,184,166,0.08), inset 0 1px 0 rgba(255,250,240,0.04)',
                transition: 'transform 0.12s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Mic icon circle */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(20,184,166,0.12)',
                border: '1.5px solid rgba(20,184,166,0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
                  stroke={GOLD} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              {/* Text column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, direction: 'rtl' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, fontFamily: "'DM Sans',sans-serif" }}>
                  שיחה קולית
                </div>
                <div style={{ fontSize: 14, color: TEXT_MUTED, fontFamily: "'Heebo',sans-serif" }}>
                  דברי איתי ישירות
                </div>
              </div>
            </div>

            {/* v27.1: Noise environment toggle hidden (state kept for v28 refactor) */}
          </div>
        )}

        {/* ──────── CHAT MESSAGES ──────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {messages.map((msg, idx) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              isLast={idx === messages.length - 1}
              onRetry={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
              onHome={() => setScreen(Screen.Home)}
              onDismiss={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
            />
          ))}

          {/* Loading dots */}
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              marginBottom: 18,
              animation: 'msgIn 0.22s ease-out both',
            }}>
              <div style={{
                fontSize: 12,
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 600,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: 'rgba(20,184,166,0.55)',
                marginBottom: 5,
                paddingInline: 4,
                direction: 'ltr',
              }}>אבו AI</div>
              <div style={{
                padding: '14px 18px',
                borderRadius: '4px 18px 18px 18px',
                background: SURFACE,
                border: '1px solid rgba(20,184,166,0.12)',
                borderRight: '3px solid rgba(20,184,166,0.32)',
              }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: 'rgba(20,184,166,0.80)',
                      animation: `dotPulse 1.8s ease-in-out ${i * 0.22}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────── VOICE MODE FULLSCREEN OVERLAY ─────────────────────── */}
      {voiceMode && (
        <div
          onClick={() => {
            // v22.6: Push-to-talk — delegate to orb handler
            if (realtimeRef.current?.isPushToTalk) {
              handleOrbTap()
              return
            }
            // v22.5: Tap overlay → interrupt if speaking, EXIT if listening/stuck
            if (voicePhase === 'speaking') {
              if (realtimeRef.current) realtimeRef.current.interrupt()
              else interruptAndListen()
            } else if (voicePhase === 'listening' || voicePhase === 'processing') {
              exitVoiceMode()
            }
          }}
          style={{
            position: 'absolute',
            top: 76,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: BG,
            zIndex: 15,
            paddingBottom: 28,
            gap: 0,
            cursor: 'pointer',
          }}>

          {/* Large gold ring — 192px — v20: tappable for interruption */}
          <div
            role={voicePhase === 'speaking' ? 'button' : undefined}
            tabIndex={voicePhase === 'speaking' ? 0 : undefined}
            onClick={handleOrbTap}
            onKeyDown={e => e.key === 'Enter' && handleOrbTap()}
            aria-label={voicePhase === 'speaking' ? 'הפסיקי דיבור' : undefined}
            style={{
              position: 'relative',
              width: 192,
              height: 192,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              ...(voicePhase === 'speaking' || voicePhase === 'greeting' ? {
                border: '2px solid rgba(20,184,166,1.0)',
                boxShadow: '0 0 0 1px rgba(20,184,166,0.50), 0 0 80px rgba(20,184,166,0.35), 0 0 150px rgba(20,184,166,0.15), inset 0 1px 0 rgba(255,250,240,0.15)',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.28) 0%, rgba(20,184,166,0.16) 38%, rgba(20,184,166,0.06) 65%, transparent 82%)',
              } : {
                border: '1.5px solid rgba(20,184,166,0.55)',
                boxShadow: '0 0 0 1px rgba(20,184,166,0.18), 0 0 40px rgba(20,184,166,0.16), 0 0 80px rgba(20,184,166,0.07), inset 0 1px 0 rgba(255,250,240,0.08)',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.18) 0%, rgba(20,184,166,0.10) 40%, rgba(20,184,166,0.04) 62%, transparent 80%)',
              }),
              transition: 'border-color 0.5s ease, box-shadow 0.5s ease, background 0.5s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* LISTENING: Mic icon 64px, stroke=GOLD */}
              {voicePhase === 'listening' && (
                <svg viewBox="0 0 24 24" width="64" height="64" fill="none"
                  stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(20,184,166,0.60))' }}>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}

              {/* PROCESSING: Spinner */}
              {voicePhase === 'processing' && (
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '2.5px solid rgba(20,184,166,0.20)',
                  borderTop: `2.5px solid ${GOLD}`,
                  animation: 'spin 0.9s linear infinite',
                }} />
              )}

              {/* SPEAKING / GREETING: 7 wave bars */}
              {(voicePhase === 'speaking' || voicePhase === 'greeting') && (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 56 }}>
                  {[20, 32, 44, 56, 44, 32, 20].map((h, i) => (
                    <div key={i} style={{
                      width: 4,
                      background: GOLD,
                      borderRadius: 2,
                      height: `${h}px`,
                      transformOrigin: 'bottom',
                      animation: `waveBar ${0.95 + i * 0.08}s ease-in-out ${i * 0.11}s infinite`,
                    }} />
                  ))}
                </div>
              )}

              {/* NULL phase: spinner */}
              {!voicePhase && (
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '2.5px solid rgba(20,184,166,0.20)',
                  borderTop: `2.5px solid ${GOLD}`,
                  animation: 'spin 1.1s linear infinite',
                }} />
              )}
            </div>
          </div>

          {/* Phase text — v20: feminine Hebrew + transcript feedback */}
          <div style={{ marginTop: 28, textAlign: 'center', direction: 'rtl', maxWidth: 320, padding: '0 20px' }}>
            <div style={{
              fontSize: 34,
              fontWeight: 300,
              letterSpacing: '0.5px',
              color: TEXT,
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: 'italic',
            }}>
              {voicePhase === 'listening' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  מקשיבה...
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'rgba(20,184,166,0.80)',
                        animation: `dotPulse 1.4s ease-in-out ${i * 0.22}s infinite`,
                      }} />
                    ))}
                  </span>
                </span>
              ) : voicePhase === 'processing' ? 'חושבת...'
                : voicePhase === 'speaking' ? 'מדברת...'
                : voicePhase === 'greeting' ? 'שלום...'
                : 'מתחברת...'}
            </div>

            {/* v20: Show what was heard */}
            {lastHeardText && voicePhase !== 'listening' && (
              <div style={{
                marginTop: 14,
                fontSize: 15,
                color: 'rgba(245,240,232,0.50)',
                fontFamily: "'Heebo',sans-serif",
                lineHeight: 1.6,
                direction: 'rtl',
              }}>
                <span style={{ color: 'rgba(245,240,232,0.35)', fontSize: 12 }}>שמעתי: </span>
                &ldquo;{lastHeardText}&rdquo;
              </div>
            )}

            {/* v20.2: Show streaming response text (old mode or Realtime) */}
            {(streamingText || realtimeTranscript) && voicePhase === 'speaking' && (
              <div style={{
                marginTop: 12,
                fontSize: 16,
                color: 'rgba(20,184,166,0.85)',
                fontFamily: "'Heebo',sans-serif",
                lineHeight: 1.7,
                direction: 'rtl',
                maxHeight: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {realtimeTranscript || streamingText}
              </div>
            )}

            {/* v22.6: Context-aware tap hints */}
            {voicePhase === 'speaking' && (
              <div style={{
                marginTop: 16,
                fontSize: 16,
                color: 'rgba(245,240,232,0.35)',
                fontFamily: "'Heebo',sans-serif",
              }}>
                לחצי כדי להפסיק
              </div>
            )}
            {voicePhase === 'listening' && realtimeRef.current?.isPushToTalk && !pttActive && (
              <div style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: 600,
                color: 'rgba(251,146,60,0.80)',
                fontFamily: "'Heebo',sans-serif",
              }}>
                📺 מצב רועש — לחצי כדי לדבר
              </div>
            )}
            {voicePhase === 'listening' && realtimeRef.current?.isPushToTalk && pttActive && (
              <div style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: 600,
                color: 'rgba(20,184,166,0.85)',
                fontFamily: "'Heebo',sans-serif",
              }}>
                🎤 מדברת... לחצי כשסיימת
              </div>
            )}
            {voicePhase === 'listening' && (
              <div style={{
                marginTop: 16,
                fontSize: 16,
                color: 'rgba(245,240,232,0.35)',
                fontFamily: "'Heebo',sans-serif",
              }}>
                לחצי כדי לצאת
              </div>
            )}
          </div>

          {/* v27.1: Noise toggle hidden — state defaults to 'quiet', behavior unchanged */}

          {/* Stop button — stopPropagation prevents overlay interrupt */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); exitVoiceMode() }}
            aria-label="סיים שיחה קולית"
            style={{
              marginTop: 36,
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(20,184,166,0.10)',
              border: '1.5px solid rgba(20,184,166,0.40)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: TEXT,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif",
              WebkitTapHighlightColor: 'transparent',
              transition: 'transform 0.10s ease-out, background 0.12s ease',
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.90)' }}
            onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            סיום
          </button>
        </div>
      )}

      {/* ─────────────────────── INPUT BAR ─────────────────────── */}
      {!voiceMode && (
        <div style={{
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          padding: '10px 14px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(7,13,30,0.92)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(201,168,76,0.12)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}>
          {/* Recording indicator pill */}
          {recording && (
            <div style={{
              position: 'absolute',
              top: -44,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 16px',
              borderRadius: 18,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#ef4444',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Heebo',sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px rgba(239,68,68,0.70)',
              }} />
              מקליט... {formatTime(recordingTime)}
            </div>
          )}

          {/* Row: mic | textarea | send */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>

            {/* Mic button — 56×56 */}
            <button
              type="button"
              onClick={handleMicTap}
              disabled={micDisabled}
              aria-label={recording ? 'עצרי הקלטה' : 'הקלטה קולית'}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: recording
                  ? 'rgba(239,68,68,0.16)'
                  : 'rgba(20,184,166,0.10)',
                border: recording
                  ? '1.5px solid rgba(239,68,68,0.48)'
                  : '1.5px solid rgba(20,184,166,0.50)',
                cursor: micDisabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
                opacity: micDisabled ? 0.45 : 1,
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
            >
              {transcribing ? (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2.5px solid rgba(20,184,166,0.30)',
                  borderTop: `2.5px solid ${GOLD}`,
                  animation: 'spin 0.9s linear infinite',
                }} />
              ) : recording ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#ef4444" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
                  stroke={micDisabled ? 'rgba(245,240,232,0.22)' : GOLD}
                  strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={recording ? 'מקשיבה...' : transcribing ? 'מתמללת...' : 'כתבי לי...'}
              rows={1}
              disabled={loading || recording}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(20,184,166,0.55)' }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(20,184,166,0.30)' }}
              style={{
                flex: 1,
                resize: 'none',
                padding: '14px 18px',
                borderRadius: 14,
                border: '1px solid rgba(20,184,166,0.30)',
                background: 'rgba(255,250,240,0.05)',
                color: TEXT,
                fontSize: 16,
                fontFamily: "'Heebo',sans-serif",
                direction: 'rtl',
                lineHeight: 1.6,
                outline: 'none',
                minHeight: 52,
                maxHeight: 130,
                overflowY: 'auto',
                opacity: (loading || recording) ? 0.50 : 1,
                WebkitAppearance: 'none',
                transition: 'border-color 0.2s ease',
              }}
            />

            {/* Send button — 56×56 */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sendDisabled}
              aria-label="שלח הודעה"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: sendDisabled
                  ? 'rgba(255,255,255,0.07)'
                  : 'linear-gradient(135deg, #14B8A6 0%, #0D9488 60%, #0F766E 100%)',
                border: sendDisabled
                  ? '1px solid rgba(255,255,255,0.10)'
                  : 'none',
                cursor: sendDisabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: sendDisabled ? 'none' : '0 4px 16px rgba(20,184,166,0.35)',
                transition: 'background 0.18s ease, transform 0.10s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => { if (!sendDisabled) e.currentTarget.style.transform = 'scale(0.88)' }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
                stroke={sendDisabled ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)'}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: 'rotate(180deg)' }}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Bottom actions — mic button is the single voice entry point */}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
            {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => {
                const text = getLastTraceText()
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text).then(() => alert('הועתק!')).catch(() => prompt('העתיקי ידנית:', text))
                } else {
                  prompt('העתיקי ידנית:', text)
                }
              }}
              style={{
                marginRight: 8,
                padding: '10px 16px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >📋 trace</button>
            )}
            <button
              type="button"
              onClick={clearConversation}
              style={{
                marginRight: 8,
                padding: '10px 16px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >ניקוי שיחה</button>
            <button
              type="button"
              onClick={() => {
                const { getTTSTrace } = require('../../services/voice')
                const trace = getTTSTrace()
                if (trace.length === 0) {
                  alert('אין נתוני TTS עדיין. דברי קודם.')
                  return
                }
                const lines = trace.map((t: { ts: string; provider: string; model: string; voice: string; latencyMs: number; status: string }) =>
                  `${t.ts.split('T')[1]?.slice(0,8)} | ${t.provider} | ${t.model} | ${t.voice} | ${t.latencyMs}ms | ${t.status}`
                ).join('\n')
                alert(`TTS Trace (last ${trace.length}):\n\n${lines}`)
              }}
              style={{
                marginRight: 8,
                padding: '10px 16px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >🔊 TTS trace</button>
          </div>
        </div>
      )}
    </div>
  )
}
