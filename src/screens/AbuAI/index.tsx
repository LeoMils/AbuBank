import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { sendMessage, streamMessage, transcribeAudio, getSupportedMimeType, SYSTEM_PROMPT, VOICE_SUFFIX } from './service'
import { speakVoiceMode, streamSpeakVoiceMode, stopSpeaking, unlockIOSAudio, createSilenceDetector } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import type { ChatMessage } from './types'
import type { SilenceDetector } from '../../services/voice'
import { InfoButton } from '../../components/InfoButton'
import { injectSharedKeyframes } from '../../design/animations'
import { soundProcessing } from '../../services/sounds'
import { RealtimeVoiceSession } from '../../services/realtimeVoice'
import type { RealtimeState } from '../../services/realtimeVoice'

// ─── Color tokens (green/teal — matches AbuWhatsApp) ────────────────────────
const GOLD            = '#14b8a6'   // teal (was gold)
const GOLD_BRIGHT     = '#2DD4BF'   // bright teal (was bright gold)
const BG              = '#050A18'   // navy (matches AbuWhatsApp)
const SURFACE         = 'rgba(20,184,166,0.06)'
const BORDER          = 'rgba(20,184,166,0.14)'
const TEXT            = '#F0FDF4'
const TEXT_MUTED      = 'rgba(240,253,244,0.48)'

// suppress unused lint
void BORDER
void GOLD_BRIGHT

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
`

// ─── Dynamic voice greeting ───────────────────────────────────────────────────
function getVoiceGreeting(): string {
  const h = new Date().getHours()
  const timeGreet = h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'

  const openers = [
    `${timeGreet}, Martita! ספרי לי — מה עובר עלייך היום?`,
    `${timeGreet}! מה שלום טוצי? ומה שלומך את?`,
    `${timeGreet}, Martita. יש משהו שרצית לדעת? אני כאן.`,
    `${timeGreet}! שמחתי שהתקשרת. מה בסדר?`,
    `${timeGreet}, Martita. שאלי אותי כל דבר — אפילו הדברים שמביך לשאול אחרים.`,
    `${timeGreet}! מה חדש אצלך? ספרי לי.`,
    `${timeGreet}, Martita. אני כאן — שאלי, ספרי, שוחח. מה בא לך?`,
    `${timeGreet}! מה אכלת היום? ומה שלום המשפחה?`,
    `${timeGreet}, Martita. מה עלה בדעתך עכשיו?`,
    `${timeGreet}! חיכיתי שתתקשרי. מה קורה?`,
    `${timeGreet}, Martita. יש משהו מעניין שקרה היום?`,
    `${timeGreet}! רוצה לדעת משהו מעניין? או פשוט לשוחח?`,
    `${timeGreet}, Martita. בואי נדבר — על מה שרוצה, בעברית או בספרדית.`,
    `${timeGreet}! מה שלומך היום באמת?`,
    `${timeGreet}, Martita. אני פה. מה על הלב?`,
    `${timeGreet}! ספרי לי משהו — כל דבר שתרצי.`,
  ]
  return openers[Math.floor(Math.random() * openers.length)] ?? openers[0]!
}

export function AbuAI() {
  const setScreen = useAppStore(s => s.setScreen)
  const appVersion = useAppStore(s => s.appVersion)
  const [messages, setMessages] = useState<ChatMessage[]>([])
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

  // v20.2: OpenAI Realtime API (WebRTC) — true real-time conversation
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('idle')
  const [realtimeTranscript, setRealtimeTranscript] = useState('')
  const realtimeRef = useRef<RealtimeVoiceSession | null>(null)
  const useRealtime = !!import.meta.env.VITE_OPENAI_API_KEY // use Realtime if OpenAI key exists

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

  // v24.2: Meeting/listen mode — free Web Speech API
  const meetingTranscriptRef = useRef<string>('')
  const meetingRecRef = useRef<any>(null) // SpeechRecognition (not in TS default lib)

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
      if (levelRef.current) clearInterval(levelRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      silenceRef.current?.stop()
      stopSpeaking()
    }
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
    const msgText = (text ?? input).trim()
    if (!msgText || loading) return

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: msgText, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const aiMsgId = nextId()
    streamingMsgIdRef.current = aiMsgId
    let accumulated = ''

    try {
      // Create placeholder AI message for streaming
      const placeholderMsg: ChatMessage = { id: aiMsgId, role: 'assistant', content: '▍', timestamp: Date.now() }
      setMessages(prev => [...prev, placeholderMsg])
      setLoading(false)
      setIsStreaming(true)

      for await (const token of streamMessage(newMessages, false)) {
        accumulated += token
        // Update the AI message with accumulated text + cursor
        setMessages(prev => {
          const updated = [...prev]
          const idx = updated.findIndex(m => m.id === aiMsgId)
          if (idx !== -1) {
            updated[idx] = { ...updated[idx]!, content: accumulated + '▍' }
          }
          return updated
        })
      }

      // Remove cursor, set final content
      setMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === aiMsgId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx]!, content: accumulated.trim() || 'שגיאה בחיבור. נסי שוב.' }
        }
        return updated
      })
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'שגיאה לא צפויה. נסי שוב.'
      setMessages(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(m => m.id === aiMsgId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx]!, content: accumulated ? accumulated + '\n\n' + errorText : errorText }
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setRecording(false)

        const actualType = recorder.mimeType || mimeType || 'audio/mp4'
        const blob = new Blob(chunksRef.current, { type: actualType })
        if (blob.size < 1000) return

        setTranscribing(true)
        try {
          const text = await transcribeAudio(blob)
          if (text.trim()) setInput(prev => prev ? `${prev} ${text}` : text)
        } catch {
          // silent
        } finally {
          setTranscribing(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }

      recorder.start(100)
      setRecordingTime(0)
      setRecording(true)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      // mic denied
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop()
  }, [])

  const handleMicTap = () => {
    if (recording) stopRecording()
    else if (!loading && !transcribing) startRecording()
  }

  // ─── Voice Conversation Mode ──────────────────────────────────────────────

  const cleanupVoiceResources = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    silenceRef.current?.stop()
    silenceRef.current = null
    setListenCountdown(null)
    if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
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

      setLastHeardText(text) // v20: Show what was heard

      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text, timestamp: Date.now() }
      const currentMsgs = [...messagesRef.current, userMsg]
      setMessages(currentMsgs)

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

        // Get full LLM response (non-streaming — more reliable, Groq is fast enough)
        const response = await sendMessage(currentMsgs, true)
        clearTimeout(watchdog)

        if (ac.signal.aborted) return // interrupted during LLM call

        const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }
        setMessages(prev => [...prev, aiMsg])
        if (!voiceModeRef.current) return

        // Speak the full response (Gemini→OpenAI→Web Speech — proven chain)
        transitionVoice('RESPONDING', 'speak-start')
        setVoicePhase('speaking')
        setIsSpeaking(true)
        setStreamingText(response)

        await speakVoiceMode(response)

        setIsSpeaking(false)
        setStreamingText('')
        abortControllerRef.current = null

        if (!voiceModeRef.current) return
        // Minimal gap before resuming listen
        await new Promise(r => setTimeout(r, 120))
        if (voiceModeRef.current) startVoiceListening()
      } catch (err) {
        abortControllerRef.current = null
        setIsSpeaking(false)
        setStreamingText('')
        if ((err as DOMException)?.name === 'AbortError') return // interrupted
        transitionVoice('ERROR', err instanceof Error ? err.message : 'unknown')
        const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
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
        if (e.error === 'not-allowed') {
          exitVoiceMode()
        } else {
          // Web Speech failed — fall through to Whisper below
          if (voiceModeRef.current) startWhisperFallback()
        }
      }

      rec.onend = () => {
        recognitionRef.current = null
        if (!gotResult && voiceModeRef.current) {
          // No result from Web Speech — restart immediately
          setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, 50)
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        })
        streamRef.current = stream
        const mimeType = getSupportedMimeType()
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop())
          streamRef.current = null
          if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
          silenceRef.current?.stop()
          silenceRef.current = null
          if (!voiceModeRef.current) return

          const actualType = recorder.mimeType || mimeType || 'audio/mp4'
          const blob = new Blob(chunksRef.current, { type: actualType })
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
            const errText = err instanceof Error ? err.message : 'שגיאה בתמלול.'
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: errText, timestamp: Date.now() }])
            if (voiceModeRef.current) startVoiceListening()
          }
        }

        recorder.start(100)

        // v17.3: Silence detection — 2s balance between patience and responsiveness
        const detector = createSilenceDetector(stream, () => {
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        }, noiseMode === 'noisy'
          ? { threshold: 40, silenceMs: 3000, maxMs: 15000, minActiveMs: 2500 }  // TV/noise: very strict
          : { threshold: 25, silenceMs: 2500, maxMs: 15000, minActiveMs: 2000 }  // quiet room
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

  // v21: Full personality prompt for Realtime — same quality as text mode
  const realtimeInstructions = useMemo(() => {
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

═══ סגנון דיבור — קריטי ═══
את אישה ישראלית אמיתית. לא רובוט. לא מחשב. אישה.
דברי בקול חם, שקט, נעים — כמו חברה טובה בשיחת טלפון אינטימית.
לא מהר. קצב רגוע ונוח. בלי לחץ.
עשי הפסקות קצרות וטבעיות בין משפטים — כמו שאנשים אמיתיים מדברים.
שני את הטון: חום ועדינות כשמנחמת, צחוק קל כשמצחיק, רצינות כשמסבירה.
תגובות קוליות טבעיות: "אהה", "נו", "וואלה" — כמו בשיחה אמיתית.
בעברית: מבטא ישראלי שוטף וטבעי. לא אמריקאי. לא רשמי. שפה יומיומית.
בספרדית: מבטא ארגנטינאי ריאופלטנסה. "Vos" לא "tú". "Dale" לא "OK". חם ונעים כמו סבתא ארגנטינאית.

═══ דוגמאות לשיחה ═══
${fewShotText}`
  }, [])

  // v21: Pipeline voice mode extracted so Realtime can fall back to it
  const startPipelineVoiceMode = useCallback(() => {
    const todayKey = new Date().toISOString().split('T')[0]!
    const isFirstToday = localStorage.getItem('abuai-voice-date') !== todayKey
    if (isFirstToday) localStorage.setItem('abuai-voice-date', todayKey)

    let greeting = getVoiceGreeting()
    if (Math.random() < 0.20) {
      const reminders = [
        ' — ואם רוצה, אפשר גם בספרדית.',
        ' Acordate que podés hablarme en español.',
        ' — y también hablo español, si preferís.',
      ]
      greeting += reminders[Math.floor(Math.random() * reminders.length)]!
    }

    const greetMsg: ChatMessage = { id: nextId(), role: 'assistant', content: greeting, timestamp: Date.now() }
    setMessages(prev => [...prev, greetMsg])

    if (isFirstToday) {
      const dateStr = new Date().toLocaleDateString('he-IL', { month: 'long', day: 'numeric' })
      sendMessage(
        [{ id: 'date-q', role: 'user', content: `מה מיוחד בתאריך ${dateStr}? אירוע היסטורי, יום הולדת מפורסם, חג — 2-3 משפטים, עברית.`, timestamp: Date.now() }],
        false
      )
        .then(dateFactResponse => {
          const factMsg: ChatMessage = { id: nextId(), role: 'assistant', content: dateFactResponse, timestamp: Date.now() }
          setMessages(prev => [...prev, factMsg])
        })
        .catch(() => {})
    }
    transitionVoice('RESPONDING', 'greeting')
    setVoicePhase('greeting')
    setIsSpeaking(true)
    speakVoiceMode(greeting)
      .then(() => {
        setIsSpeaking(false)
        if (voiceModeRef.current) {
          setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, 150)
        }
      })
      .catch(() => {
        setIsSpeaking(false)
        if (voiceModeRef.current) startVoiceListening()
      })
  }, [startVoiceListening, transitionVoice])

  // v22.3: Auto-detect ambient noise level before entering voice mode
  const detectAmbientNoise = useCallback(async (): Promise<'quiet' | 'noisy'> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const samples: number[] = []

      await new Promise<void>(resolve => {
        const start = Date.now()
        const measure = () => {
          if (Date.now() - start > 800) { resolve(); return } // v23: 800ms measurement (was 400 — too short for TV)
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128
            sum += v * v
          }
          samples.push(Math.min(100, Math.sqrt(sum / buf.length) * 300))
          requestAnimationFrame(measure)
        }
        requestAnimationFrame(measure)
      })

      stream.getTracks().forEach(t => t.stop())
      ctx.close().catch(() => {})

      samples.sort((a, b) => a - b)
      const median = samples[Math.floor(samples.length / 2)] ?? 0
      // v23: Use 90th percentile — catches even brief TV speech bursts
      const p90 = samples[Math.floor(samples.length * 0.90)] ?? 0
      // ANY audio above 5 at p90 = something is making noise (TV, radio, people)
      const detected = p90 > 5 ? 'noisy' : 'quiet'
      console.log(`[AbuAI] Ambient noise: median=${median.toFixed(1)}, p90=${p90.toFixed(1)}, mode=${detected}`)

      // Auto-update the toggle if detection disagrees
      if (detected !== noiseMode) {
        setNoiseMode(detected)
        localStorage.setItem('abu-noise-mode', detected)
      }
      return detected
    } catch {
      return (noiseMode === 'listen' ? 'quiet' : noiseMode) as 'quiet' | 'noisy' // can't measure — use current setting
    }
  }, [noiseMode])

  const enterVoiceMode = useCallback(() => {
    unlockIOSAudio()
    acquireWakeLock()
    setVoiceMode(true)
    voiceModeRef.current = true

    // v25.2: SIMPLE DECISION — can we use Realtime or not?
    const quotaFlag = localStorage.getItem('abu-openai-quota-failed')
    const openaiAvailable = useRealtime && (!quotaFlag || (Date.now() - parseInt(quotaFlag, 10)) > 3_600_000)

    // No OpenAI credits? Go straight to free pipeline. No complexity.
    if (!openaiAvailable) {
      console.log('[AbuAI] No OpenAI → free pipeline (Groq + Gemini)')
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
            if (state === 'listening' && !meetingRecRef.current) {
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
            // v25: Show Hebrew error, never raw English
            const isQuota = typeof error === 'string' && (error.includes('quota') || error.includes('exceeded') || error.includes('billing'))
            const hebrewMsg = isQuota ? 'המכסה נגמרה. עוברת למצב חינמי.' : 'שגיאה בחיבור. נסי שוב.'
            setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: hebrewMsg, timestamp: Date.now() }])
            if (isQuota) {
              try { localStorage.setItem('abu-openai-quota-failed', String(Date.now())) } catch {}
            }
          },
        },
        realtimeInstructions,
        // v25: onFatalError — Realtime died, remember + fall back to free pipeline
        () => {
          console.log('[AbuAI] Realtime failed, saving quota flag, falling back to free pipeline')
          localStorage.setItem('abu-openai-quota-failed', String(Date.now()))
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
  }, [startPipelineVoiceMode, useRealtime, realtimeInstructions])

  const exitVoiceMode = useCallback(() => {
    // v22.5: Clear safety timer
    if (voiceSafetyTimerRef.current) { clearTimeout(voiceSafetyTimerRef.current); voiceSafetyTimerRef.current = null }
    // v24.2: Stop meeting transcription if active
    if (meetingRecRef.current) {
      try { meetingRecRef.current.stop() } catch { /* already stopped */ }
      meetingRecRef.current = null
    }
    // v20.2: Disconnect Realtime session if active
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

  // v20.2: Tap anywhere during speaking to interrupt (works for both old + Realtime)
  const handleOrbTap = () => {
    // v24.2: Listen/meeting mode — tap to ask about what was discussed (free LLM, not Realtime)
    if (noiseMode === 'listen' && meetingTranscriptRef.current && voicePhase === 'listening') {
      // Stop transcription temporarily
      if (meetingRecRef.current) { try { meetingRecRef.current.stop() } catch {} }

      const transcript = meetingTranscriptRef.current.trim()
      if (transcript.length < 5) {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'עוד לא שמעתי מספיק. המשיכי את הפגישה.', timestamp: Date.now() }])
        if (meetingRecRef.current && voiceModeRef.current) { try { meetingRecRef.current.start() } catch {} }
        return
      }

      setVoicePhase('processing')
      // Use cheap text LLM (not Realtime API) to summarize
      const question = `שמעתי את הפגישה הזו. סכמי בקצרה מה נאמר:\n\n${transcript}`
      sendMessage(
        [{ id: nextId(), role: 'user', content: question, timestamp: Date.now() }],
        false,
      ).then(summary => {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: summary, timestamp: Date.now() }])
        setVoicePhase('listening')
        // Resume transcription
        if (meetingRecRef.current && voiceModeRef.current) { try { meetingRecRef.current.start() } catch {} }
      }).catch(() => {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'לא הצלחתי לסכם. נסי שוב.', timestamp: Date.now() }])
        setVoicePhase('listening')
        if (meetingRecRef.current && voiceModeRef.current) { try { meetingRecRef.current.start() } catch {} }
      })
      return
    }

    // v22.6: Push-to-talk mode — tap to start/stop speaking
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
  void audioLevel
  void listenCountdown
  void voiceState

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
      {/* ── Ambient background — 3 layers with live color shift ── */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background: [
          'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(20,184,166,0.10) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 50% at 15% 95%, rgba(20,184,166,0.08) 0%, transparent 55%)',
          'radial-gradient(ellipse 45% 35% at 88% 80%, rgba(139,92,246,0.05) 0%, transparent 50%)',
        ].join(', '),
        animation: 'ambientColorShift 35s ease-in-out infinite',
      }} />

      {/* ─────────────────────── HEADER ─────────────────────── */}
      <header style={{
        flexShrink: 0,
        position: 'relative',
        background: 'rgba(5,10,24,0.96)',
        borderBottom: '1px solid rgba(20,184,166,0.28)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 1px 0 rgba(20,184,166,0.12)',
        zIndex: 20,
      }}>
        {/* Bottom glow line */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.45) 30%, rgba(20,184,166,0.70) 50%, rgba(20,184,166,0.45) 70%, transparent)',
        }} />

        {/* Header content row — 72px */}
        <div style={{
          position: 'relative',
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
        }}>

          {/* LEFT (RTL): Martita portrait — T2.2 Voice States */}
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: `translateY(-50%)${isSpeaking ? ` scale(${1 + audioLevel * 0.12})` : ''}`,
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: voicePhase === 'listening'
              ? `${2 + audioLevel * 4}px solid #7EB4B8`  // Teal, thickness pulses with audio
              : voicePhase === 'processing'
              ? '2.5px solid rgba(212,184,122,0.70)'      // Gold processing
              : isSpeaking
              ? '2.5px solid rgba(20,184,166,0.80)'       // Teal speaking
              : voiceMode
              ? '2px solid #D4B87A'                        // Gold idle pulse
              : '2px solid rgba(20,184,166,0.42)',         // Default
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

          {/* CENTER: Single wordmark */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, direction: 'ltr' }}>
              <span style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: '1px',
                fontStyle: 'italic',
                ...goldGradText,
              }}>Martit</span>
              <span style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: '2px',
                ...goldGradText,
              }}>AI</span>
            </div>
            {/* Sub-label */}
            <div style={{
              position: 'absolute',
              bottom: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              letterSpacing: '2.5px',
              fontWeight: 600,
              color: 'rgba(20,184,166,0.50)',
              fontFamily: "'DM Sans',sans-serif",
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>ABU AI</div>
          </div>

          {/* RIGHT (RTL): Back button */}
          <button
            type="button"
            onClick={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }}
            aria-label="חזרה לדף הבית"
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 56,
              height: 56,
              minHeight: 44,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
              stroke="rgba(245,240,232,0.80)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span style={{
              fontSize: 12,
              color: 'rgba(245,240,232,0.55)',
              fontFamily: "'Heebo',sans-serif",
              fontWeight: 500,
              lineHeight: 1,
            }}>חזרה</span>
          </button>

        </div>

        {/* Version badge */}
        <div style={{
          position: 'absolute',
          bottom: 5,
          left: 10,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'rgba(20,184,166,0.45)',
          fontFamily: "'DM Sans',monospace",
          userSelect: 'none',
        }}>{appVersion ? `v${appVersion}` : ''}</div>
      </header>

      <InfoButton
        title="אבו AI — MartitAI"
        lines={['אבו AI היא העוזרת האישית החכמה שלך — שואלת, מסבירה, מצחיקה.', 'יש לה גישה לאינטרנט בזמן אמת. אפשר לדבר עברית או ספרדית.']}
        howTo={['כתבי שאלה בתיבת הטקסט ולחצי שלח', 'לחצי "שיחה קולית" לדבר ישירות', 'לחצי על "חזרה" לחזור לתפריט הראשי']}
        position="top-left"
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
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.20) 0%, rgba(20,184,166,0.12) 38%, rgba(20,184,166,0.04) 62%, transparent 80%)',
                border: '1.5px solid rgba(20,184,166,0.55)',
                boxShadow: '0 0 0 1px rgba(20,184,166,0.18), 0 0 60px rgba(20,184,166,0.22), 0 0 120px rgba(20,184,166,0.10), inset 0 1px 0 rgba(255,250,240,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1,
              }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontSize: 58,
                  fontWeight: 600,
                  fontStyle: 'italic',
                  ...goldGradText,
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
                borderRight: '4px solid rgba(20,184,166,0.65)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
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

            {/* v22.2: Noise environment toggle — visible before entering voice mode */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleNoiseMode() }}
              style={{
                marginTop: 12,
                padding: '10px 20px',
                borderRadius: 14,
                background: noiseMode === 'noisy'
                  ? 'rgba(251,146,60,0.10)'
                  : 'rgba(255,255,255,0.03)',
                border: noiseMode === 'noisy'
                  ? '1px solid rgba(251,146,60,0.35)'
                  : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                minHeight: 48,
                WebkitTapHighlightColor: 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 18 }}>{noiseMode === 'listen' ? '👂' : noiseMode === 'noisy' ? '📺' : '🤫'}</span>
              <span style={{
                fontSize: 16, fontWeight: 600,
                color: noiseMode === 'listen' ? 'rgba(167,139,250,0.80)' : noiseMode === 'noisy' ? 'rgba(251,146,60,0.85)' : 'rgba(245,240,232,0.45)',
                fontFamily: "'Heebo',sans-serif",
              }}>
                {noiseMode === 'listen' ? 'מצב האזנה' : noiseMode === 'noisy' ? 'מצב רועש' : 'מצב שקט'}
              </span>
            </button>
          </div>
        )}

        {/* ──────── CHAT MESSAGES ──────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1
            const isUser = msg.role === 'user'
            const ts = new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-start' : 'flex-end',
                  marginBottom: 16,
                  animation: isLast ? 'msgIn 0.3s ease both' : 'none',
                }}
              >
                {/* Sender label */}
                <div style={{
                  fontSize: 12,
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isUser ? 'rgba(245,240,232,0.42)' : 'rgba(20,184,166,0.55)',
                  marginBottom: 5,
                  direction: 'ltr',
                  paddingInline: 4,
                }}>
                  {isUser ? 'את' : 'אבו AI'}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '82%',
                  ...(isUser ? {
                    padding: '14px 18px',
                    borderRadius: '18px 4px 18px 18px',
                    background: 'rgba(20,184,166,0.13)',
                    border: '1px solid rgba(20,184,166,0.35)',
                  } : {
                    padding: '14px 18px',
                    borderRadius: '4px 18px 18px 18px',
                    background: SURFACE,
                    border: '1px solid rgba(20,184,166,0.20)',
                    borderRight: '3px solid rgba(20,184,166,0.50)',
                  }),
                }}>
                  <div style={{
                    fontSize: 16,
                    lineHeight: isUser ? 1.85 : 1.9,
                    color: TEXT,
                    direction: 'rtl',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: "'Heebo',sans-serif",
                    animation: 'msgIn 0.3s ease',
                  }}>
                    {msg.content}
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{
                  marginTop: 5,
                  fontSize: 12,
                  color: 'rgba(245,240,232,0.30)',
                  textAlign: isUser ? 'right' : 'left',
                  fontFamily: "'DM Sans',sans-serif",
                  direction: 'ltr',
                  paddingInline: 4,
                }}>
                  {ts}
                </div>
              </div>
            )
          })}

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
            top: 72,
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
            {voicePhase === 'listening' && noiseMode === 'listen' && (
              <div style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: 600,
                color: 'rgba(167,139,250,0.85)',
                fontFamily: "'Heebo',sans-serif",
                textAlign: 'center',
              }}>
                👂 מקשיבה לפגישה...
                {lastHeardText && (
                  <div style={{ fontSize: 14, color: 'rgba(167,139,250,0.50)', marginTop: 4, direction: 'rtl' }}>
                    &ldquo;{lastHeardText.slice(0, 50)}{lastHeardText.length > 50 ? '...' : ''}&rdquo;
                  </div>
                )}
                <div style={{ fontSize: 16, color: 'rgba(167,139,250,0.55)', marginTop: 8 }}>
                  לחצי כדי לשאול מה נאמר
                </div>
              </div>
            )}
            {voicePhase === 'listening' && !realtimeRef.current?.isPushToTalk && !realtimeRef.current?.isListenMode && (
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

          {/* v22.2: Noise environment toggle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleNoiseMode() }}
            aria-label={noiseMode === 'quiet' ? 'מצב שקט — לחצי אם יש רעש ברקע' : 'מצב רועש — לחצי אם שקט'}
            style={{
              marginTop: 24,
              padding: '12px 24px',
              borderRadius: 20,
              background: noiseMode === 'noisy'
                ? 'rgba(251,146,60,0.15)'
                : 'rgba(20,184,166,0.08)',
              border: noiseMode === 'noisy'
                ? '1.5px solid rgba(251,146,60,0.45)'
                : '1.5px solid rgba(20,184,166,0.25)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              minHeight: 48,
              WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 22 }}>{noiseMode === 'listen' ? '👂' : noiseMode === 'noisy' ? '📺' : '🤫'}</span>
            <span style={{
              fontSize: 16, fontWeight: 600,
              color: noiseMode === 'listen' ? 'rgba(167,139,250,0.85)' : noiseMode === 'noisy' ? 'rgba(251,146,60,0.90)' : 'rgba(20,184,166,0.75)',
              fontFamily: "'Heebo',sans-serif",
            }}>
              {noiseMode === 'listen' ? 'מצב האזנה — מקליטה פגישה' : noiseMode === 'noisy' ? 'מצב רועש — לחצי לדבר' : 'מצב שקט — שיחה חופשית'}
            </span>
          </button>

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
          background: 'rgba(5,10,24,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(20,184,166,0.16)',
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

          {/* "שיחה קולית" pill */}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleVoiceTap}
              aria-label="מצב שיחה קולית"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 22px',
                borderRadius: 20,
                background: 'rgba(20,184,166,0.06)',
                border: '1px solid rgba(20,184,166,0.48)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s ease',
              }}
              onPointerDown={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.14)' }}
              onPointerUp={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.06)' }}
              onPointerLeave={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.06)' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke={GOLD} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'rgba(20,184,166,0.95)',
                fontFamily: "'Heebo',sans-serif",
                direction: 'rtl',
              }}>
                שיחה קולית
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
