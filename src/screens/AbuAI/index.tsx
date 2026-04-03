import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { sendMessage, transcribeAudio, getSupportedMimeType } from './service'
import { speak, stopSpeaking } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import type { ChatMessage } from './types'
import type { SilenceDetector } from '../../services/voice'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'

let msgCounter = 0
function nextId(): string {
  return `m${++msgCounter}-${Date.now()}`
}

// ─── CSS keyframes injected once ────────────────────────────────────────────
const KEYFRAMES_ID = 'abuai-anim'

const KEYFRAMES = `
  .abuai-chat-scroll { scrollbar-width: none; }
  .abuai-chat-scroll::-webkit-scrollbar { display: none; }

  @keyframes abuPulse {
    0%,100% { opacity:0.3; transform:scale(0.8); }
    50%      { opacity:0.9; transform:scale(1.15); }
  }
  @keyframes micPulse {
    0%,100% { box-shadow: 0 4px 16px rgba(239,68,68,0.35), 0 0 0 0 rgba(239,68,68,0.3); }
    50%     { box-shadow: 0 4px 16px rgba(239,68,68,0.35), 0 0 0 12px rgba(239,68,68,0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes orbFloat {
    0%,100% { transform: translateY(0px) scale(1); }
    50%     { transform: translateY(-8px) scale(1.03); }
  }
  @keyframes orbGlowTeal {
    0%,100% { box-shadow: 0 0 40px rgba(20,184,166,0.30), 0 0 80px rgba(20,184,166,0.15), inset 0 0 30px rgba(20,184,166,0.08); }
    50%     { box-shadow: 0 0 65px rgba(20,184,166,0.50), 0 0 120px rgba(20,184,166,0.25), inset 0 0 40px rgba(20,184,166,0.12); }
  }
  @keyframes orbGlowGold {
    0%,100% { box-shadow: 0 0 40px rgba(201,168,76,0.30), 0 0 80px rgba(201,168,76,0.15), inset 0 0 30px rgba(201,168,76,0.08); }
    50%     { box-shadow: 0 0 65px rgba(201,168,76,0.50), 0 0 120px rgba(201,168,76,0.25), inset 0 0 40px rgba(201,168,76,0.12); }
  }
  @keyframes ripple1 {
    0%   { transform: scale(1);   opacity: 0.55; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes ripple2 {
    0%   { transform: scale(1);   opacity: 0.40; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes ripple3 {
    0%   { transform: scale(1);   opacity: 0.25; }
    100% { transform: scale(2.9); opacity: 0; }
  }

  @keyframes voiceGlow {
    0%,100% { box-shadow: 0 0 28px rgba(20,184,166,0.25); }
    50%      { box-shadow: 0 0 52px rgba(20,184,166,0.45); }
  }
  @keyframes voiceGlowGold {
    0%,100% { box-shadow: 0 0 28px rgba(201,168,76,0.22); }
    50%      { box-shadow: 0 0 52px rgba(201,168,76,0.40); }
  }

  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes msgIn {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes speakWave {
    0%,100% { transform: scaleY(0.4); }
    50%     { transform: scaleY(1); }
  }
  @keyframes avatarGlow {
    0%,100% { box-shadow: 0 0 0 2px rgba(201,168,76,0.35), 0 0 18px rgba(201,168,76,0.18); }
    50%     { box-shadow: 0 0 0 3px rgba(201,168,76,0.55), 0 0 28px rgba(201,168,76,0.32); }
  }
  @keyframes avatarGlowAlways {
    0%,100% { box-shadow: 0 0 0 2px rgba(20,184,166,0.25), 0 0 10px rgba(20,184,166,0.10); }
    50%     { box-shadow: 0 0 0 2px rgba(20,184,166,0.45), 0 0 18px rgba(20,184,166,0.20); }
  }
  @keyframes dotPulse {
    0%,80%,100% { opacity: 0.25; transform: scale(0.75); }
    40%          { opacity: 1;    transform: scale(1.0); }
  }
  @keyframes waveBar {
    0%,100% { transform: scaleY(0.3); }
    50%     { transform: scaleY(1.0); }
  }
`

// ─── Dynamic voice greeting ──────────────────────────────────────────────────
// Time-appropriate salutation + rotating warm invitation phrase.
function getVoiceGreeting(): string {
  const h = new Date().getHours()
  const salutation =
    h >= 5  && h < 12 ? 'בוקר טוב' :
    h >= 12 && h < 17 ? 'צהריים טובים' :
    h >= 17 && h < 21 ? 'ערב טוב' :
                         'לילה טוב'

  const continuations = [
    'מה שלומך? אפשר לדבר גם בספרדית מתי שתרצי.',
    'על מה תרצי לדבר היום?',
    'שאלי אותי כל דבר בכל נושא — איתי את יכולה לדבר ולהתייעץ על הכל.',
    'מה עובר עלייך? אני כאן לכל שאלה ושיחה.',
    'ספרי לי — מה חדש אצלך?',
    'כאן בשבילך — בעברית, בספרדית, בכל נושא שתרצי.',
    'מה בלבך היום? שאלי, ספרי, בקשי.',
    'רפואה, משפחה, בישול, טיולים — הכל פתוח לשיחה.',
    'אחרי כמה שתרצי — שאלי, ספרי, שוחחי.',
    'יש משהו שמעסיק אותך? אני כאן.',
    'מה תרצי לדעת היום?',
    'שאלי אותי הכל — אין נושא שאני לא אענה עליו.',
  ]
  const cont = continuations[Math.floor(Math.random() * continuations.length)]
  return `${salutation}, מרטיטה! ${cont}`
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
      if (timerRef.current) clearInterval(timerRef.current)
      if (levelRef.current) clearInterval(levelRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      silenceRef.current?.stop()
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Text chat ───────────────────────────────────────────────────────────

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

  // ─── Manual voice recording (fills text input) ───────────────────────────

  const startRecording = useCallback(async () => {
    try {
      // iOS Safari requires explicit audio constraints for microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      })
      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      // Empty mimeType = let the browser choose (iOS-safe fallback)
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

        // Use the recorder's actual mimeType (iOS may differ from requested mimeType)
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

      recorder.start(100) // timeslice required on iOS for ondataavailable to fire
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
    // Stop Web Speech Recognition if active
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

    // ── Shared: transcribed text → AI response → speak → listen again ────────
    const handleText = async (text: string) => {
      if (!voiceModeRef.current) return
      const lower = text.trim()
      if (/^(ביי|להתראות|תודה|עצור|עצרי|סטופ|stop|bye)$/i.test(lower)) {
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
        await speak(response)
        setIsSpeaking(false)
        if (!voiceModeRef.current) return
        await new Promise(r => setTimeout(r, 500))
        if (voiceModeRef.current) startVoiceListening()
      } catch (err) {
        setIsSpeaking(false)
        const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: errText, timestamp: Date.now() }])
        if (voiceModeRef.current) {
          setVoicePhase('speaking'); setIsSpeaking(true)
          await speak(errText)
          setIsSpeaking(false)
          await new Promise(r => setTimeout(r, 600))
          if (voiceModeRef.current) startVoiceListening()
        }
      }
    }

    // ── Primary: Web Speech Recognition (iOS Safari → Apple Hebrew model) ─────
    // webkitSpeechRecognition with lang='he-IL' outputs actual Hebrew characters.
    // This is the definitive fix for "Hebrew spoken → English letters" on iOS.
    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (WSR) {
      const rec = new WSR() as any
      rec.lang = 'he-IL'          // Apple's on-device Siri model → real Hebrew script
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 1

      let gotResult = false

      rec.onresult = (e: any) => {
        gotResult = true
        recognitionRef.current = null
        const transcript = (e.results[0]?.[0]?.transcript ?? '').trim()
        if (transcript) {
          setVoicePhase('processing')
          handleText(transcript)
        } else {
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 200)
        }
      }

      rec.onerror = (e: any) => {
        recognitionRef.current = null
        if (e.error === 'not-allowed') {
          exitVoiceMode()
        } else {
          // 'no-speech', 'audio-capture', 'network', etc. → just restart
          if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 300)
        }
      }

      rec.onend = () => {
        recognitionRef.current = null
        if (!gotResult && voiceModeRef.current) setTimeout(() => startVoiceListening(), 150)
      }

      try {
        rec.start()
        recognitionRef.current = rec
        return  // ← Web Speech started — skip MediaRecorder fallback
      } catch {
        recognitionRef.current = null
        // fall through to MediaRecorder
      }
    }

    // ── Fallback: MediaRecorder + Whisper (non-WebKit / desktop Chrome) ───────
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
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

        recorder.start(100) // timeslice required on iOS

        // 10-second countdown — visible to Martita
        const LISTEN_SEC = 10
        setListenCountdown(LISTEN_SEC)
        let cdSec = LISTEN_SEC
        const cdInterval = setInterval(() => {
          cdSec--
          if (cdSec > 0) {
            setListenCountdown(cdSec)
          } else {
            clearInterval(cdInterval)
            setListenCountdown(null)
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
          }
        }, 1000)
        silenceRef.current = {
          stop: () => { clearInterval(cdInterval); setListenCountdown(null) },
          getLevel: () => 0,
        }
      } catch (err) {
        console.error('[AbuAI] getUserMedia error:', err)
        exitVoiceMode()
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enterVoiceMode = useCallback(() => {
    setVoiceMode(true)
    voiceModeRef.current = true
    // Greet Martita before listening
    setVoicePhase('greeting')
    setIsSpeaking(true)
    speak(getVoiceGreeting())
      .then(() => {
        setIsSpeaking(false)
        if (voiceModeRef.current) setTimeout(() => startVoiceListening(), 350)
      })
      .catch(() => {
        setIsSpeaking(false)
        if (voiceModeRef.current) startVoiceListening()
      })
  }, [startVoiceListening])

  const exitVoiceMode = useCallback(() => {
    voiceModeRef.current = false
    setVoiceMode(false)
    setVoicePhase(null)
    setAudioLevel(0)
    setIsSpeaking(false)
    stopSpeaking()
    cleanupVoiceResources()
  }, [cleanupVoiceResources])

  const handleVoiceTap = () => {
    if (voiceMode) exitVoiceMode()
    else enterVoiceMode()
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const hasInput = input.trim().length > 0
  const sendDisabled = !hasInput || loading
  const micDisabled = loading || transcribing

  // suppress unused warning — audioLevel is used for voice UI future expansion
  void audioLevel

  return (
    <div
      dir="rtl"
      style={{
        height: '100%',
        width: '100%',
        maxWidth: 412,
        margin: '0 auto',
        overflow: 'hidden',
        background: '#050A18',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Heebo','DM Sans',sans-serif",
        position: 'relative',
      }}
    >
      {/* Aurora background — two overlapping soft blobs */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 90% 50% at 50% -5%, rgba(20,184,166,0.16) 0%, transparent 60%)',
          'radial-gradient(ellipse 60% 40% at 10% 85%, rgba(201,168,76,0.10) 0%, transparent 55%)',
          'radial-gradient(ellipse 50% 35% at 90% 75%, rgba(20,184,166,0.08) 0%, transparent 50%)',
        ].join(', '),
      }} />

      {/* ─── HEADER ─── */}
      <header
        style={{
          flexShrink: 0,
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(5,10,24,1.0) 0%, rgba(5,12,26,0.97) 100%)',
          borderBottom: '1px solid rgba(20,184,166,0.30)',
          zIndex: 20,
        }}
      >
        {/* Teal glow strip along bottom edge */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(20,184,166,0.35) 30%,rgba(20,184,166,0.55) 50%,rgba(20,184,166,0.35) 70%,transparent)'
        }} />
        {/* Inner: fixed-height content zone — always 68 px below the notch */}
        <div style={{
          position: 'relative',
          height: 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
        }}>
        {/* Martita portrait — left side (RTL = left) */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 46,
            height: 46,
            borderRadius: '50%',
            border: '2px solid rgba(201,168,76,0.55)',
            overflow: 'hidden',
            background: '#0c2228',
            animation: isSpeaking ? 'avatarGlow 1.4s ease-in-out infinite' : 'avatarGlowAlways 2.5s ease-in-out infinite',
            transition: 'box-shadow 0.4s ease',
            flexShrink: 0,
          }}
        >
          <img
            src={martitaPhoto}
            alt="Martita"
            loading="eager"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
            onError={handleMartitaImgError}
          />
        </div>

        {/* AbuAI wordmark — center */}
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, direction: 'ltr' }}>
          <span
            style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '1.5px',
              background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 18%, #0D9488 36%, #5EEAD4 52%, #14B8A6 68%, #0F766E 82%, #5EEAD4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 7px rgba(94,234,212,0.28))',
            } as React.CSSProperties}
          >
            Martit
          </span>
          <span
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '2.5px',
              background: 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 18%, #D97706 34%, #F59E0B 50%, #92400E 66%, #B45309 78%, #FBBF24 90%, #FDE68A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 7px rgba(251,191,36,0.28))',
            } as React.CSSProperties}
          >
            AI
          </span>
        </div>

        {/* Back chevron — right side (RTL = right) */}
        <button
          type="button"
          onClick={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }}
          aria-label="חזרה לדף הבית"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="rgba(255,255,255,0.50)"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        </div>{/* end inner content wrapper */}
        {/* Version badge */}
        <div style={{
          position: 'absolute', bottom: 4, left: 10,
          fontSize: 9, fontWeight: 700, letterSpacing: '1px',
          color: 'rgba(201,168,76,0.55)',
          fontFamily: "'DM Sans',monospace",
          userSelect: 'none',
        }}>v4</div>
      </header>

      {/* ─── CHAT AREA ─── */}
      <div
        ref={chatRef}
        className="abuai-chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 16px 8px',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── EMPTY STATE ── */}
        {messages.length === 0 && !loading && !voiceMode && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeSlideUp 0.6s ease-out both',
              minHeight: 0,
              gap: 0,
              paddingBottom: 24,
            }}
          >
            {/* Large animated AI orb */}
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              {/* Ripple rings behind orb */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(20,184,166,0.35)',
                  animation: 'ripple1 3.0s ease-out 0s infinite',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(20,184,166,0.28)',
                  animation: 'ripple2 3.0s ease-out 0.8s infinite',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1px solid rgba(20,184,166,0.18)',
                  animation: 'ripple3 3.0s ease-out 1.6s infinite',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '1px solid rgba(20,184,166,0.12)',
                  animation: 'ripple1 4.5s ease-out 2.4s infinite',
                }}
              />
              {/* Main orb */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 38% 32%, rgba(94,234,212,0.22) 0%, rgba(20,184,166,0.14) 40%, rgba(5,10,24,0.95) 75%)',
                  border: '1.5px solid rgba(20,184,166,0.50)',
                  animation: 'orbFloat 4s ease-in-out infinite, orbGlowTeal 4s ease-in-out infinite',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(2px)',
                }}
              >
                {/* Inner gold star spark */}
                <svg
                  viewBox="0 0 24 24"
                  width="44"
                  height="44"
                  aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.55))' }}
                >
                  <defs>
                    <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="45%" stopColor="#C9A84C" />
                      <stop offset="100%" stopColor="#92400E" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="url(#starGrad)" />
                </svg>
              </div>
            </div>

            {/* "Ask me anything" */}
            <div
              style={{
                marginTop: 28,
                fontFamily: "'Heebo',sans-serif",
                fontSize: 23,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.95)',
                textAlign: 'center',
                direction: 'rtl',
                lineHeight: 1.3,
                letterSpacing: '-0.2px',
              }}
            >
              שאלי אותי כל דבר
            </div>

            {/* "Martita" italic gold */}
            <div
              style={{
                marginTop: 6,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 24,
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, #FDE68A, #C9A84C, #A88A35)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.22))',
              } as React.CSSProperties}
            >
              Martita
            </div>

            {/* Subtitle */}
            <div
              style={{
                marginTop: 10,
                fontSize: 15,
                color: 'rgba(255,255,255,0.42)',
                textAlign: 'center',
                direction: 'rtl',
                fontFamily: "'Heebo',sans-serif",
              }}
            >
              כאן בשבילך — שאלי אותי הכל 💫
            </div>

            {/* Voice invitation card */}
            <button
              type="button"
              onClick={enterVoiceMode}
              style={{
                marginTop: 26,
                padding: '18px 28px',
                borderRadius: 20,
                background: 'linear-gradient(135deg, rgba(201,168,76,0.13) 0%, rgba(201,168,76,0.07) 100%)',
                border: '1px solid rgba(201,168,76,0.38)',
                boxShadow: '0 4px 24px rgba(201,168,76,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                minWidth: 220,
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)' }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {/* Mic icon with gold glow */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.40)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 16px rgba(201,168,76,0.20)',
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              {/* Invitation text */}
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 17,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                direction: 'rtl',
                letterSpacing: '-0.1px',
              }}>
                בואי נשוחח, Martita
              </div>
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 13,
                color: 'rgba(201,168,76,0.75)',
                direction: 'rtl',
              }}>
                על כל דבר שבא לך 💛
              </div>
            </button>
          </div>
        )}

        {/* ── Chat messages ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1
            const isUser = msg.role === 'user'
            const ts = new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                  marginBottom: 16,
                  animation: isLast ? 'msgIn 0.22s ease-out both' : 'none',
                }}
              >
                {/* AI avatar */}
                {!isUser && (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1.5px solid rgba(201,168,76,0.40)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: '#0c2228',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.30)',
                      marginBottom: 18, // align with timestamp below bubble
                    }}
                  >
                    <img
                      src={martitaPhoto}
                      alt="Abu AI"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                      onError={handleMartitaImgError}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '78%' : '82%' }}>
                  {/* Bubble */}
                  <div
                    style={isUser ? {
                      padding: '13px 18px',
                      borderRadius: '20px 6px 20px 20px',
                      background: 'linear-gradient(135deg, rgba(20,184,166,0.30) 0%, rgba(20,184,166,0.16) 100%)',
                      border: '1px solid rgba(20,184,166,0.45)',
                      boxShadow: '0 4px 16px rgba(20,184,166,0.14)',
                    } : {
                      padding: '13px 18px',
                      borderRadius: '6px 20px 20px 20px',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      backdropFilter: 'blur(6px)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.22)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        lineHeight: 1.7,
                        color: isUser ? 'white' : 'rgba(255,255,255,0.92)',
                        direction: 'rtl',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: "'Heebo',sans-serif",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.35)',
                      textAlign: isUser ? 'right' : 'left',
                      fontFamily: "'DM Sans',sans-serif",
                      direction: 'ltr',
                    }}
                  >
                    {ts}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Loading dots */}
          {loading && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 16,
                animation: 'msgIn 0.22s ease-out both',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(201,168,76,0.40)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: '#0c2228',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.30)',
                }}
              >
                <img
                  src={martitaPhoto}
                  alt="Abu AI"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                  onError={handleMartitaImgError}
                />
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '4px 20px 20px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #5EEAD4, #14b8a6)',
                        boxShadow: '0 0 6px rgba(20,184,166,0.40)',
                        animation: `dotPulse 1.4s ease-in-out ${i * 0.18}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── VOICE MODE OVERLAY ─── */}
      {voiceMode && (
        <div
          style={{
            position: 'absolute',
            top: 68,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: [
              'radial-gradient(circle, rgba(5,10,24,0.0) 0%, rgba(5,10,24,0.40) 100%)',
              'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(20,184,166,0.07) 0%, #050A18 65%)',
            ].join(', '),
            zIndex: 15,
            paddingBottom: 24,
          }}
        >
          {/* Large orb with ripples */}
          <div style={{ position: 'relative', width: 168, height: 168 }}>
            {/* Ripple rings — active when listening */}
            {voicePhase === 'listening' && (<>
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(20,184,166,0.45)',
                animation: 'ripple1 2.2s ease-out 0s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(20,184,166,0.32)',
                animation: 'ripple2 2.2s ease-out 0.55s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid rgba(20,184,166,0.20)',
                animation: 'ripple3 2.2s ease-out 1.1s infinite',
              }} />
            </>)}
            {/* Gold ripple rings when greeting */}
            {voicePhase === 'greeting' && (<>
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.55)',
                animation: 'ripple1 2.4s ease-out 0s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.38)',
                animation: 'ripple2 2.4s ease-out 0.6s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.22)',
                animation: 'ripple3 2.4s ease-out 1.2s infinite',
              }} />
            </>)}
            {/* Gold ripple rings when speaking */}
            {voicePhase === 'speaking' && (<>
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.50)',
                animation: 'ripple1 1.8s ease-out 0s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.35)',
                animation: 'ripple2 1.8s ease-out 0.45s infinite',
              }} />
            </>)}

            {/* Main orb */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: (voicePhase === 'speaking' || voicePhase === 'greeting')
                  ? 'radial-gradient(circle at 38% 32%, rgba(255,215,100,0.22) 0%, rgba(201,168,76,0.14) 45%, rgba(5,10,24,0.95) 80%)'
                  : voicePhase === 'processing'
                    ? 'radial-gradient(circle at 38% 32%, rgba(94,234,212,0.15) 0%, rgba(20,184,166,0.10) 45%, rgba(5,10,24,0.95) 80%)'
                    : 'radial-gradient(circle at 38% 32%, rgba(94,234,212,0.22) 0%, rgba(20,184,166,0.14) 45%, rgba(5,10,24,0.95) 80%)',
                border: (voicePhase === 'speaking' || voicePhase === 'greeting')
                  ? '1.5px solid rgba(201,168,76,0.60)'
                  : '1.5px solid rgba(20,184,166,0.55)',
                animation: (voicePhase === 'speaking' || voicePhase === 'greeting')
                  ? 'orbGlowGold 1.8s ease-in-out infinite'
                  : voicePhase === 'listening'
                    ? 'orbGlowTeal 2.2s ease-in-out infinite'
                    : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.5s ease, background 0.5s ease',
              }}
            >
              {/* Listening: mic icon */}
              {voicePhase === 'listening' && (
                <svg viewBox="0 0 24 24" width="52" height="52" fill="none"
                  stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 12px rgba(20,184,166,0.50))' }}
                >
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
              {/* Processing: 3 dots */}
              {voicePhase === 'processing' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 13, height: 13, borderRadius: '50%',
                      background: TEAL,
                      animation: `dotPulse 1.3s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              {/* Speaking/Greeting: wave bars */}
              {(voicePhase === 'speaking' || voicePhase === 'greeting') && (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 46 }}>
                  {[0.4, 0.7, 1.0, 0.75, 0.55, 0.9, 0.65, 0.45, 0.8].map((h, i) => (
                    <div key={i} style={{
                      width: 4, borderRadius: 3,
                      background: `linear-gradient(180deg, #FDE68A, #C9A84C)`,
                      height: `${Math.round(h * 36)}px`,
                      animation: `waveBar ${0.7 + i * 0.05}s ease-in-out ${i * 0.09}s infinite`,
                      filter: 'drop-shadow(0 0 3px rgba(201,168,76,0.50))',
                    }} />
                  ))}
                </div>
              )}
              {/* Connecting: spinner */}
              {!voicePhase && (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2.5px solid rgba(20,184,166,0.35)',
                  borderTopColor: TEAL,
                  animation: 'spin 0.9s linear infinite',
                }} />
              )}
            </div>
          </div>

          {/* Phase label */}
          {voicePhase === 'greeting' ? (
            /* Special warm greeting label */
            <div style={{ marginTop: 28, textAlign: 'center', direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 30,
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, #FDE68A, #C9A84C, #A88A35)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.35))',
                letterSpacing: '0.3px',
              } as React.CSSProperties}>
                Martita ✨
              </div>
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                letterSpacing: '-0.2px',
              }}>
                {new Date().getHours() >= 5 && new Date().getHours() < 12
                  ? 'בוקר טוב' : new Date().getHours() < 17
                  ? 'צהריים טובים' : new Date().getHours() < 21
                  ? 'ערב טוב' : 'לילה טוב'} 🌟
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 32,
                fontSize: 32,
                fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                color: 'rgba(255,255,255,0.95)',
                letterSpacing: '-0.3px',
                direction: 'rtl',
              }}
            >
              {voicePhase === 'listening'
                ? (listenCountdown !== null ? `מקשיבה... ${listenCountdown}` : 'מקשיבה...')
                : voicePhase === 'processing'
                  ? 'חושבת...'
                  : voicePhase === 'speaking'
                    ? 'מדברת...'
                    : 'מתחברת...'}
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              fontSize: 16,
              color: 'rgba(255,255,255,0.32)',
              fontFamily: "'Heebo',sans-serif",
              direction: 'rtl',
            }}
          >
            {voicePhase === 'greeting' ? '' : voicePhase === 'speaking' ? 'הקשי כדי לעצור' : 'אמרי "ביי" כדי לסיים'}
          </div>

          {/* Stop button */}
          <button
            type="button"
            onClick={exitVoiceMode}
            aria-label="סיים שיחה קולית"
            style={{
              marginTop: 36,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              border: '1.5px solid rgba(239,68,68,0.38)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.10s ease-out, background 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; e.currentTarget.style.background = 'rgba(239,68,68,0.22)' }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
              stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── INPUT BAR ─── */}
      {!voiceMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            padding: '10px 14px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid rgba(20,184,166,0.15)',
            background: 'rgba(5,10,24,0.95)',
            backdropFilter: 'blur(12px)',
            flexShrink: 0,
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Recording indicator */}
          {recording && (
            <div
              style={{
                position: 'absolute',
                top: -38,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '5px 14px',
                borderRadius: 14,
                background: 'rgba(239,68,68,0.14)',
                border: '1px solid rgba(239,68,68,0.32)',
                color: '#ef4444',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'abuPulse 1s infinite',
                }}
              />
              מקליט... {formatTime(recordingTime)}
            </div>
          )}

          {/* Mic button */}
          <button
            type="button"
            onClick={handleMicTap}
            disabled={micDisabled}
            aria-label={recording ? 'עצרי הקלטה' : 'הקלטה קולית'}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: recording
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(20,184,166,0.12)',
              border: recording
                ? '1px solid rgba(239,68,68,0.45)'
                : '1px solid rgba(20,184,166,0.30)',
              cursor: micDisabled ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: recording ? 'micPulse 1.5s ease-in-out infinite' : 'none',
              transition: 'background 0.15s ease-out',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {transcribing ? (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: '2px solid rgba(201,168,76,0.5)',
                  borderTopColor: GOLD,
                  animation: 'spin 0.9s linear infinite',
                }}
              />
            ) : recording ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#ef4444" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke={micDisabled ? 'rgba(255,255,255,0.25)' : TEAL}
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
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
            style={{
              flex: 1,
              resize: 'none',
              padding: '11px 18px',
              borderRadius: 24,
              border: '1px solid rgba(20,184,166,0.22)',
              background: 'rgba(20,184,166,0.07)',
              color: 'rgba(255,255,255,0.95)',
              fontSize: 17,
              fontFamily: "'Heebo',sans-serif",
              direction: 'rtl',
              lineHeight: 1.55,
              outline: 'none',
              minHeight: 44,
              maxHeight: 120,
              overflowY: 'auto',
              opacity: (loading || recording) ? 0.5 : 1,
              WebkitAppearance: 'none',
            }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={sendDisabled}
            aria-label="שלח הודעה"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: sendDisabled
                ? 'rgba(255,255,255,0.08)'
                : 'linear-gradient(135deg, #14b8a6, #0d9488)',
              border: 'none',
              cursor: sendDisabled ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s ease-out, transform 0.10s ease-out',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={(e) => { if (!sendDisabled) e.currentTarget.style.transform = 'scale(0.90)' }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke={sendDisabled ? 'rgba(255,255,255,0.25)' : 'white'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: 'rotate(180deg)' }}
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
