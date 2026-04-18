import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { sendMessage, transcribeAudio, getSupportedMimeType } from './service'
import { speakVoiceMode, stopSpeaking, unlockIOSAudio, isSpeaking as isTTSSpeaking, createSilenceDetector } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import type { ChatMessage } from './types'
import type { SilenceDetector } from '../../services/voice'
import { InfoButton } from '../../components/InfoButton'
import { GRADIENT_GOLD } from '../../design/gradients'
import { BackButton } from '../../components/BackButton'

// ─── Color tokens ────────────────────────────────────────────────────────────
const GOLD            = '#C9A84C'
const BG              = '#0C0A08'
const SURFACE         = 'rgba(255,250,240,0.06)'
const TEXT            = '#F5F0E8'
const TEXT_MUTED      = 'rgba(245,240,232,0.48)'


let msgCounter = 0
function nextId(): string {
  return `m${++msgCounter}-${Date.now()}`
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
  @keyframes orbPulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.02); }
  }
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Voice conversation mode
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'greeting' | 'listening' | 'processing' | 'speaking' | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [listenCountdown, setListenCountdown] = useState<number | null>(null)

  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const voiceModeRef = useRef(false)
  const silenceRef = useRef<SilenceDetector | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, loading])

  // Inject keyframes
  useEffect(() => {
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
      voiceModeRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (levelRef.current) clearInterval(levelRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      silenceRef.current?.stop()
      silenceRef.current = null
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null
          recognitionRef.current.onerror = null
          recognitionRef.current.onend = null
          recognitionRef.current.abort()
        } catch {}
        recognitionRef.current = null
      }
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Text chat ────────────────────────────────────────────────────────────

  const handleSend = async (text?: string) => {
    const msgText = (text ?? input).trim()
    if (!msgText || loading) return

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: msgText, timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await sendMessage(newMessages)
      const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }
      setMessages(prev => [...prev, aiMsg])
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'שגיאה לא צפויה. נסי שוב.'
      const errMsg: ChatMessage = { id: nextId(), role: 'assistant', content: errorText, timestamp: Date.now() }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
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
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'לא הצלחתי לשמוע. נסי שוב.', timestamp: Date.now() }])
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
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'צריכה הרשאה למיקרופון. בדקי בהגדרות הדפדפן.', timestamp: Date.now() }])
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

  const startVoiceListening = useCallback(() => {
    if (!voiceModeRef.current) return
    setVoicePhase('listening')
    setAudioLevel(0)
    setListenCountdown(null)

    const handleText = async (text: string) => {
      if (!voiceModeRef.current) return
      const lower = text.trim()
      if (/^(ביי|להתראות|תודה|עצור|עצרי|סטופ|מספיק|יאללה ביי|stop|bye|chau|basta|parar|adiós|hasta luego)$/i.test(lower)) {
        exitVoiceMode(); return
      }
      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text, timestamp: Date.now() }
      const currentMsgs = [...messagesRef.current, userMsg]
      setMessages(currentMsgs)
      try {
        const response = await sendMessage(currentMsgs, true)
        const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', content: response, timestamp: Date.now() }
        setMessages(prev => [...prev, aiMsg])
        if (!voiceModeRef.current) return
        setVoicePhase('speaking')
        setIsSpeaking(true)
        await speakVoiceMode(response)
        setIsSpeaking(false)
        if (!voiceModeRef.current) return
        await new Promise(r => setTimeout(r, 150))
        if (voiceModeRef.current) startVoiceListening()
      } catch (err) {
        setIsSpeaking(false)
        const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: errText, timestamp: Date.now() }])
        if (voiceModeRef.current) {
          setVoicePhase('speaking'); setIsSpeaking(true)
          await speakVoiceMode(errText)
          setIsSpeaking(false)
          await new Promise(r => setTimeout(r, 150))
          if (voiceModeRef.current) startVoiceListening()
        }
      }
    }

    // Stop any ongoing TTS before listening (prevents echo feedback loop)
    if (isTTSSpeaking()) stopSpeaking()

    // Primary: Web Speech Recognition
    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (WSR) {
      const rec = new WSR() as any
      rec.lang = 'he-IL'
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1

      let gotResult = false
      let speechTimeout: ReturnType<typeof setTimeout> | null = null
      let lastTranscript = ''

      // Safety timeout — if WSR hangs with no events, restart after 15s
      const wsrSafetyTimeout = setTimeout(() => {
        if (!gotResult && voiceModeRef.current) {
          try { rec.abort() } catch {}
          recognitionRef.current = null
          startVoiceListening()
        }
      }, 15000)

      rec.onresult = (e: any) => {
        // Collect the best final or interim transcript
        let finalText = ''
        let interimText = ''
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          const t = (r[0]?.transcript ?? '').trim()
          if (r.isFinal) finalText += (finalText ? ' ' : '') + t
          else interimText += (interimText ? ' ' : '') + t
        }
        lastTranscript = finalText || interimText

        // Reset the silence-after-speech timer each time we get speech
        if (speechTimeout) clearTimeout(speechTimeout)
        if (lastTranscript) {
          speechTimeout = setTimeout(() => {
            // Speech ended — stop recognition and process
            gotResult = true
            clearTimeout(wsrSafetyTimeout)
            try { rec.stop() } catch {}
            recognitionRef.current = null
            if (lastTranscript.trim()) {
              setVoicePhase('processing')
              handleText(lastTranscript.trim())
            } else {
              if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 80)
            }
          }, 2200) // 2.2s of silence after last speech → commit (tolerates natural pauses)
        }
      }

      rec.onerror = (e: any) => {
        clearTimeout(wsrSafetyTimeout)
        if (speechTimeout) clearTimeout(speechTimeout)
        recognitionRef.current = null
        if (e.error === 'not-allowed') {
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'צריכה הרשאה למיקרופון. בדקי בהגדרות הדפדפן.', timestamp: Date.now() }])
          exitVoiceMode()
        } else if (e.error === 'no-speech') {
          // No speech detected — silently restart (don't show error to user)
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 80)
        } else if (e.error === 'aborted') {
          // Aborted (e.g., by us calling rec.abort()) — silent restart if still in voice mode
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 80)
        } else if (e.error === 'network') {
          // Network error — brief pause then retry
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 500)
        } else {
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 150)
        }
      }

      rec.onend = () => {
        clearTimeout(wsrSafetyTimeout)
        if (speechTimeout) clearTimeout(speechTimeout)
        recognitionRef.current = null
        if (!gotResult && voiceModeRef.current) setTimeout(() => startVoiceListening(), 80)
      }

      try {
        rec.start()
        recognitionRef.current = rec
        return
      } catch {
        recognitionRef.current = null
      }
    }

    // Fallback: MediaRecorder + Whisper
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
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

        // Use the professional silence detector instead of a simple countdown
        const detector = createSilenceDetector(stream, () => {
          // Silence confirmed — stop recording and process
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        })
        silenceRef.current = detector

        // Update audio level UI from the detector
        levelRef.current = setInterval(() => {
          setAudioLevel(detector.getLevel())
        }, 80)
      } catch (err) {
        console.error('[AbuAI] getUserMedia error:', err)
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'מיקרופון לא זמין. בדקי בהגדרות הדפדפן.', timestamp: Date.now() }])
        exitVoiceMode()
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enterVoiceMode = useCallback(() => {
    unlockIOSAudio()
    setVoiceMode(true)
    voiceModeRef.current = true

    const todayKey = new Date().toISOString().split('T')[0]!
    const isFirstToday = localStorage.getItem('abuai-voice-date') !== todayKey
    if (isFirstToday) localStorage.setItem('abuai-voice-date', todayKey)

    let greeting = getVoiceGreeting()
    if (Math.random() < 0.35) {
      const reminders = [
        ' — ואם רוצה, אפשר גם בספרדית.',
        ' Acordate que podés hablarme en español.',
        ' — y también hablo español, si preferís.',
        ' — en español o en hebreo, como quieras.',
        ' — podemos hablar en español también, eh.',
      ]
      greeting += reminders[Math.floor(Math.random() * reminders.length)]!
    }

    const greetMsg: ChatMessage = { id: nextId(), role: 'assistant', content: greeting, timestamp: Date.now() }
    setMessages(prev => [...prev, greetMsg])

    if (isFirstToday) {
      setTimeout(() => {
        const checkMsg: ChatMessage = { id: nextId(), role: 'assistant', content: 'רגע, בודקת מה מיוחד היום...', timestamp: Date.now() }
        setMessages(prev => [...prev, checkMsg])
        const dateStr = new Date().toLocaleDateString('he-IL', { month: 'long', day: 'numeric' })
        sendMessage(
          [{ id: 'date-q', role: 'user', content: `מה מיוחד בתאריך ${dateStr}? אירוע היסטורי, יום הולדת מפורסם, חג — 2-3 משפטים, עברית.`, timestamp: Date.now() }],
          false
        )
          .then(dateFactResponse => {
            const factMsg: ChatMessage = { id: nextId(), role: 'assistant', content: dateFactResponse, timestamp: Date.now() }
            setMessages(prev => prev.map(m => m.id === checkMsg.id ? factMsg : m))
            setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, 300)
          })
          .catch(() => {
            // Remove the stale "checking..." message on error
            setMessages(prev => prev.filter(m => m.id !== checkMsg.id))
            setTimeout(() => { if (voiceModeRef.current) startVoiceListening() }, 150)
          })
      }, 400)
    } else {
      setTimeout(() => {
        if (voiceModeRef.current) startVoiceListening()
      }, 250)
    }
  }, [startVoiceListening])

  const exitVoiceMode = useCallback(() => {
    voiceModeRef.current = false
    setVoiceMode(false)
    setVoicePhase(null)
    setAudioLevel(0)
    setIsSpeaking(false)
    stopSpeaking()
    cleanupVoiceResources()
    setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'שיחה הסתיימה.', timestamp: Date.now() }])
  }, [cleanupVoiceResources])

  const handleVoiceTap = () => {
    if (voiceMode) exitVoiceMode()
    else enterVoiceMode()
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const hasInput = input.trim().length > 0
  const sendDisabled = !hasInput || loading
  const micDisabled = loading || transcribing

  // suppress unused warnings
  void audioLevel
  void listenCountdown

  // Shared gold gradient text style
  const goldGradText: React.CSSProperties = {
    background: GRADIENT_GOLD,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.35))',
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
      {/* ── Ambient background — 3 layers combined ── */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background: [
          'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(201,168,76,0.10) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 50% at 15% 95%, rgba(201,168,76,0.08) 0%, transparent 55%)',
          'radial-gradient(ellipse 45% 35% at 88% 80%, rgba(201,168,76,0.05) 0%, transparent 50%)',
        ].join(', '),
      }} />

      {/* ─────────────────────── HEADER ─────────────────────── */}
      <header style={{
        flexShrink: 0,
        position: 'relative',
        background: 'rgba(12,10,8,0.96)',
        borderBottom: '1px solid rgba(201,168,76,0.28)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 1px 0 rgba(201,168,76,0.12)',
        zIndex: 20,
      }}>
        {/* Bottom glow line */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.45) 30%, rgba(201,168,76,0.70) 50%, rgba(201,168,76,0.45) 70%, transparent)',
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

          {/* LEFT (RTL): Martita portrait */}
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: isSpeaking ? '2.5px solid rgba(201,168,76,0.80)' : '2px solid rgba(201,168,76,0.42)',
            boxShadow: isSpeaking ? '0 0 0 2.5px rgba(201,168,76,0.75), 0 0 24px rgba(201,168,76,0.30)' : '0 0 0 2px rgba(201,168,76,0.42), 0 0 16px rgba(201,168,76,0.12)',
            transition: 'box-shadow 0.4s ease',
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
          </div>

          {/* RIGHT (RTL): Back button */}
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <BackButton onPress={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }} />
          </div>

          <InfoButton
            title="אבו AI — MartitAI"
            lines={['אבו AI היא העוזרת האישית החכמה שלך — שואלת, מסבירה, מצחיקה.', 'יש לה גישה לאינטרנט בזמן אמת. אפשר לדבר עברית או ספרדית.']}
            howTo={['כתבי שאלה בתיבת הטקסט ולחצי שלח', 'לחצי "שיחה קולית" לדבר ישירות', 'לחצי על "חזרה" לחזור לתפריט הראשי']}
            positionStyle={{ left: 86, top: 6 }}
          />
        </div>

        {/* Version badge */}
        <div style={{ position: 'fixed', bottom: 8, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(201,168,76,0.30)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', zIndex: 1 }}>v15.0</div>
      </header>

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
                border: '1px solid rgba(201,168,76,0.28)',
              }} />
              {/* Static halo ring 2 */}
              <div aria-hidden="true" style={{
                position: 'absolute',
                borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.15)',
                width: '210%', height: '210%',
              }} />
              {/* Orb body */}
              <div style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.20) 0%, rgba(201,168,76,0.12) 38%, rgba(201,168,76,0.04) 62%, transparent 80%)',
                border: '1.5px solid rgba(201,168,76,0.55)',
                boxShadow: '0 0 0 1px rgba(201,168,76,0.18), 0 0 60px rgba(201,168,76,0.22), 0 0 120px rgba(201,168,76,0.10), inset 0 1px 0 rgba(255,250,240,0.10)',
                animation: 'orbPulse 4s ease-in-out infinite',
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
                color: '#D4A853',
                WebkitTextFillColor: '#D4A853',
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
                border: '1px solid rgba(201,168,76,0.22)',
                borderRight: '4px solid rgba(201,168,76,0.65)',
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
                background: 'rgba(201,168,76,0.12)',
                border: '1.5px solid rgba(201,168,76,0.40)',
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
                  fontSize: 14,
                  fontFamily: "'DM Sans',sans-serif",
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isUser ? 'rgba(245,240,232,0.75)' : 'rgba(201,168,76,0.75)',
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
                    background: 'rgba(201,168,76,0.13)',
                    border: '1px solid rgba(201,168,76,0.35)',
                  } : {
                    padding: '14px 18px',
                    borderRadius: '4px 18px 18px 18px',
                    background: SURFACE,
                    border: '1px solid rgba(201,168,76,0.20)',
                    borderRight: '3px solid rgba(201,168,76,0.50)',
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
                  fontSize: 14,
                  color: 'rgba(245,240,232,0.55)',
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
                color: 'rgba(201,168,76,0.55)',
                marginBottom: 5,
                paddingInline: 4,
                direction: 'ltr',
              }}>אבו AI</div>
              <div style={{
                padding: '14px 18px',
                borderRadius: '4px 18px 18px 18px',
                background: SURFACE,
                border: '1px solid rgba(201,168,76,0.12)',
                borderRight: '3px solid rgba(201,168,76,0.32)',
              }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: 'rgba(201,168,76,0.80)',
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
        <div style={{
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
        }}>

          {/* Large gold ring — 192px */}
          <div style={{
            position: 'relative',
            width: 192,
            height: 192,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              ...(voicePhase === 'speaking' || voicePhase === 'greeting' ? {
                border: '2px solid rgba(201,168,76,1.0)',
                boxShadow: '0 0 0 1px rgba(201,168,76,0.50), 0 0 80px rgba(201,168,76,0.35), 0 0 150px rgba(201,168,76,0.15), inset 0 1px 0 rgba(255,250,240,0.15)',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.28) 0%, rgba(201,168,76,0.16) 38%, rgba(201,168,76,0.06) 65%, transparent 82%)',
              } : {
                border: '1.5px solid rgba(201,168,76,0.55)',
                boxShadow: '0 0 0 1px rgba(201,168,76,0.18), 0 0 40px rgba(201,168,76,0.16), 0 0 80px rgba(201,168,76,0.07), inset 0 1px 0 rgba(255,250,240,0.08)',
                background: 'radial-gradient(circle at 30% 28%, rgba(255,240,180,0.18) 0%, rgba(201,168,76,0.10) 40%, rgba(201,168,76,0.04) 62%, transparent 80%)',
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
                  style={{ filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.60))' }}>
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
                  border: '2.5px solid rgba(201,168,76,0.20)',
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
                  border: '2.5px solid rgba(201,168,76,0.20)',
                  borderTop: `2.5px solid ${GOLD}`,
                  animation: 'spin 1.1s linear infinite',
                }} />
              )}
            </div>
          </div>

          {/* Phase text */}
          <div style={{ marginTop: 32, textAlign: 'center', direction: 'rtl' }}>
            <div style={{
              fontSize: 38,
              fontWeight: 300,
              letterSpacing: '0.5px',
              color: TEXT,
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: 'italic',
            }}>
              {voicePhase === 'listening' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  מקשיב...
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: 'rgba(201,168,76,0.80)',
                        animation: `dotPulse 1.4s ease-in-out ${i * 0.22}s infinite`,
                      }} />
                    ))}
                  </span>
                </span>
              ) : voicePhase === 'processing' ? 'חושב...'
                : voicePhase === 'speaking' ? 'מדבר...'
                : voicePhase === 'greeting' ? 'שלום...'
                : 'מתחבר...'}
            </div>
          </div>

          {/* Stop button */}
          <button
            type="button"
            onClick={exitVoiceMode}
            aria-label="סיים שיחה קולית"
            style={{
              marginTop: 48,
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(201,168,76,0.10)',
              border: '1.5px solid rgba(201,168,76,0.40)',
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
          background: 'rgba(12,10,8,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(201,168,76,0.16)',
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
                  : 'rgba(201,168,76,0.10)',
                border: recording
                  ? '1.5px solid rgba(239,68,68,0.48)'
                  : '1.5px solid rgba(201,168,76,0.50)',
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
                  border: '2.5px solid rgba(201,168,76,0.30)',
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
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(201,168,76,0.55)' }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(201,168,76,0.30)' }}
              style={{
                flex: 1,
                resize: 'none',
                padding: '14px 18px',
                borderRadius: 14,
                border: '1px solid rgba(201,168,76,0.30)',
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
                  : 'linear-gradient(135deg, #C9A84C 0%, #B8912A 60%, #A07828 100%)',
                border: sendDisabled
                  ? '1px solid rgba(255,255,255,0.10)'
                  : 'none',
                cursor: sendDisabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: sendDisabled ? 'none' : '0 4px 16px rgba(201,168,76,0.35)',
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
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.48)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s ease',
              }}
              onPointerDown={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.14)' }}
              onPointerUp={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.06)' }}
              onPointerLeave={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.06)' }}
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
                color: 'rgba(201,168,76,0.95)',
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
