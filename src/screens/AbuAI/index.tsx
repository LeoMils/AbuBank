import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { sendMessage, transcribeAudio, getSupportedMimeType } from './service'
import { speak, speakVoiceMode, stopSpeaking, unlockIOSAudio } from '../../services/voice'
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
  @keyframes ripple4 {
    0%   { transform: scale(1);   opacity: 0.15; }
    100% { transform: scale(3.4); opacity: 0; }
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
  @keyframes particleFloat1 {
    0%,100% { transform: translate(0px, 0px); opacity: 0.10; }
    33%     { transform: translate(6px, -18px); opacity: 0.14; }
    66%     { transform: translate(-4px, -8px); opacity: 0.08; }
  }
  @keyframes particleFloat2 {
    0%,100% { transform: translate(0px, 0px); opacity: 0.08; }
    40%     { transform: translate(-8px, -22px); opacity: 0.13; }
    70%     { transform: translate(5px, -12px); opacity: 0.06; }
  }
  @keyframes particleFloat3 {
    0%,100% { transform: translate(0px, 0px); opacity: 0.12; }
    50%     { transform: translate(10px, -16px); opacity: 0.15; }
  }
  @keyframes particleFloat4 {
    0%,100% { transform: translate(0px, 0px); opacity: 0.07; }
    45%     { transform: translate(-6px, -20px); opacity: 0.12; }
    80%     { transform: translate(4px, -9px); opacity: 0.09; }
  }
  @keyframes breathe {
    0%,100% { opacity: 0.10; }
    50%     { opacity: 0.15; }
  }
`

// ─── Dynamic voice greeting ──────────────────────────────────────────────────
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
        // speakVoiceMode uses speechSynthesis — always works on iOS from async context
        await speakVoiceMode(response)
        setIsSpeaking(false)
        if (!voiceModeRef.current) return
        await new Promise(r => setTimeout(r, 400))
        if (voiceModeRef.current) startVoiceListening()
      } catch (err) {
        setIsSpeaking(false)
        const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: errText, timestamp: Date.now() }])
        if (voiceModeRef.current) {
          setVoicePhase('speaking'); setIsSpeaking(true)
          await speakVoiceMode(errText)
          setIsSpeaking(false)
          await new Promise(r => setTimeout(r, 400))
          if (voiceModeRef.current) startVoiceListening()
        }
      }
    }

    // ── Primary: Web Speech Recognition (iOS Safari → Apple Hebrew model) ─────
    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (WSR) {
      const rec = new WSR() as any
      rec.lang = 'he-IL'
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
        return
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
    unlockIOSAudio()
    setVoiceMode(true)
    voiceModeRef.current = true

    const greeting = getVoiceGreeting()
    const greetMsg: ChatMessage = { id: nextId(), role: 'assistant', content: greeting, timestamp: Date.now() }
    setMessages(prev => [...prev, greetMsg])

    setTimeout(() => {
      if (voiceModeRef.current) startVoiceListening()
    }, 500)
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
  // suppress unused warning — speak is imported for potential future use
  void speak
  // suppress unused warning — listenCountdown rendered implicitly
  void listenCountdown

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
      {/* ── Ambient background layers ── */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: [
          'radial-gradient(ellipse 100% 55% at 50% -8%, rgba(20,184,166,0.18) 0%, transparent 65%)',
          'radial-gradient(ellipse 65% 45% at 8% 88%, rgba(201,168,76,0.11) 0%, transparent 58%)',
          'radial-gradient(ellipse 55% 38% at 92% 72%, rgba(20,184,166,0.09) 0%, transparent 52%)',
          'radial-gradient(ellipse 70% 40% at 50% 105%, rgba(20,184,166,0.08) 0%, transparent 55%)',
        ].join(', '),
      }} />

      {/* ── Breathing ambient glow (bottom-center depth layer) ── */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 320,
        height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(20,184,166,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'breathe 6s ease-in-out infinite',
      }} />

      {/* ── Ambient floating particles ── */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {/* Particle 1 */}
        <div style={{
          position: 'absolute', top: '22%', left: '18%',
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(94,234,212,0.55)',
          animation: 'particleFloat1 11s ease-in-out infinite',
          boxShadow: '0 0 6px rgba(94,234,212,0.35)',
        }} />
        {/* Particle 2 */}
        <div style={{
          position: 'absolute', top: '55%', left: '78%',
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(201,168,76,0.50)',
          animation: 'particleFloat2 14s ease-in-out 2s infinite',
          boxShadow: '0 0 5px rgba(201,168,76,0.30)',
        }} />
        {/* Particle 3 */}
        <div style={{
          position: 'absolute', top: '38%', left: '88%',
          width: 3, height: 3, borderRadius: '50%',
          background: 'rgba(94,234,212,0.45)',
          animation: 'particleFloat3 9s ease-in-out 1s infinite',
          boxShadow: '0 0 5px rgba(94,234,212,0.25)',
        }} />
        {/* Particle 4 */}
        <div style={{
          position: 'absolute', top: '72%', left: '12%',
          width: 4, height: 4, borderRadius: '50%',
          background: 'rgba(201,168,76,0.42)',
          animation: 'particleFloat4 16s ease-in-out 3.5s infinite',
          boxShadow: '0 0 6px rgba(201,168,76,0.22)',
        }} />
      </div>

      {/* ─────────────────────── HEADER ─────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(8,14,32,0.98) 0%, rgba(5,10,24,0.95) 100%)',
          borderBottom: '1px solid rgba(20,184,166,0.22)',
          zIndex: 20,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.40)',
        }}
      >
        {/* Glow strip */}
        <div aria-hidden="true" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(20,184,166,0.30) 25%,rgba(20,184,166,0.55) 50%,rgba(20,184,166,0.30) 75%,transparent)',
        }} />

        {/* Header content row — fixed 72px tall */}
        <div style={{
          position: 'relative',
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px',
        }}>

          {/* LEFT (RTL): Martita portrait — 54×54 with gold-teal dual ring */}
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 54,
            height: 54,
            borderRadius: '50%',
            flexShrink: 0,
          }}>
            {/* Outer teal ring */}
            <div style={{
              position: 'absolute',
              inset: -3,
              borderRadius: '50%',
              border: isSpeaking
                ? '2px solid rgba(20,184,166,0.70)'
                : '1.5px solid rgba(20,184,166,0.35)',
              transition: 'border-color 0.4s ease',
            }} />
            {/* Inner gold ring */}
            <div style={{
              position: 'absolute',
              inset: -1,
              borderRadius: '50%',
              border: isSpeaking
                ? '2px solid rgba(201,168,76,0.80)'
                : '1.5px solid rgba(201,168,76,0.45)',
              animation: isSpeaking ? 'avatarGlow 1.4s ease-in-out infinite' : 'avatarGlowAlways 3s ease-in-out infinite',
              transition: 'border-color 0.4s ease',
            }} />
            {/* Photo */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              overflow: 'hidden', background: '#0c1e28',
            }}>
              <img
                src={martitaPhoto}
                alt="Martita"
                loading="eager"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                onError={handleMartitaImgError}
              />
            </div>
          </div>

          {/* CENTER: MartitAI wordmark — 34px/30px */}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2, direction: 'ltr' }}>
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: '1px',
              background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 18%, #0D9488 36%, #14B8A6 52%, #5EEAD4 65%, #0F766E 82%, #5EEAD4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(94,234,212,0.32))',
            } as React.CSSProperties}>
              Martit
            </span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: '2px',
              background: 'linear-gradient(135deg, #FDE68A 0%, #F5C842 16%, #D97706 32%, #C9A84C 50%, #F59E0B 64%, #92400E 78%, #FBBF24 90%, #FDE68A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(251,191,36,0.32))',
            } as React.CSSProperties}>
              AI
            </span>
          </div>

          {/* RIGHT (RTL): Back button — 56×56 touch target */}
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
              borderRadius: 16,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.13)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s ease',
            }}
            onPointerDown={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)' }}
            onPointerUp={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
            onPointerLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
              stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.60)',
              fontFamily: "'Heebo',sans-serif", fontWeight: 500, lineHeight: 1,
            }}>חזרה</span>
          </button>
        </div>

        {/* Version badge */}
        <div style={{
          position: 'absolute', bottom: 5, left: 10,
          fontSize: 9, fontWeight: 700, letterSpacing: '1px',
          color: 'rgba(201,168,76,0.65)',
          fontFamily: "'DM Sans',monospace",
          userSelect: 'none',
        }}>v13.0</div>
      </header>

      {/* ─────────────────────── CHAT AREA ─────────────────────── */}
      <div
        ref={chatRef}
        className="abuai-chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 14px 10px',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ──────── EMPTY STATE ──────── */}
        {messages.length === 0 && !loading && !voiceMode && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeSlideUp 0.65s ease-out both',
            minHeight: 0,
            gap: 0,
            paddingBottom: 32,
          }}>
            {/* ── Large hero orb — 160px with 4 ripple rings ── */}
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              {/* Ripple ring 1 */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.32)',
                animation: 'ripple1 4.2s ease-out 0s infinite',
              }} />
              {/* Ripple ring 2 */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.20)',
                animation: 'ripple2 4.2s ease-out 1.05s infinite',
              }} />
              {/* Ripple ring 3 */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '0.5px solid rgba(201,168,76,0.12)',
                animation: 'ripple3 4.2s ease-out 2.1s infinite',
              }} />
              {/* Ripple ring 4 */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '0.5px solid rgba(201,168,76,0.06)',
                animation: 'ripple4 4.2s ease-out 3.15s infinite',
              }} />
              {/* Orb body */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'radial-gradient(circle at 38% 32%, rgba(255,235,148,0.22) 0%, rgba(201,168,76,0.14) 40%, rgba(12,22,40,0.97) 78%)',
                border: '1.5px solid rgba(201,168,76,0.48)',
                animation: 'orbGlowGold 3.8s ease-in-out infinite, orbFloat 5s ease-in-out infinite',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
                <svg viewBox="0 0 24 24" width="52" height="52" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 14px rgba(201,168,76,0.65))' }}>
                  <defs>
                    <linearGradient id="emptyStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="45%" stopColor="#C9A84C" />
                      <stop offset="100%" stopColor="#92400E" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="url(#emptyStarGrad)" />
                </svg>
              </div>
            </div>

            {/* Headline row: "שלום," + italic gold "Martita" */}
            <div style={{
              marginTop: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              direction: 'rtl',
            }}>
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 28,
                fontWeight: 800,
                color: '#F2F6FA',
                textAlign: 'center',
                lineHeight: 1.3,
                letterSpacing: '-0.3px',
              }}>
                שאלי אותי כל דבר
              </div>
              <div style={{
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontSize: 32,
                fontStyle: 'italic',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #FDE68A 0%, #C9A84C 50%, #A88A35 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.28))',
                letterSpacing: '0.5px',
              } as React.CSSProperties}>
                Martita
              </div>
            </div>

            {/* Subtitle — 16px, 0.65 opacity */}
            <div style={{
              marginTop: 12,
              fontSize: 16,
              color: 'rgba(255,255,255,0.65)',
              textAlign: 'center',
              direction: 'rtl',
              fontFamily: "'Heebo',sans-serif",
              fontWeight: 500,
              lineHeight: 1.8,
              maxWidth: 300,
            }}>
              כאן בשבילך תמיד{'\n'}שאלי אותי על כל דבר
            </div>

            {/* ── Voice invitation card — premium with gold left border ── */}
            <button
              type="button"
              onClick={enterVoiceMode}
              style={{
                marginTop: 32,
                padding: '24px 32px',
                borderRadius: 28,
                background: 'linear-gradient(145deg, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.07) 100%)',
                border: '1.5px solid rgba(201,168,76,0.45)',
                borderRight: '4px solid rgba(201,168,76,0.70)',
                boxShadow: '0 8px 36px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                minWidth: 270,
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(201,168,76,0.10)' }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' }}
            >
              {/* Mic orb — larger, gold glow */}
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'linear-gradient(145deg, rgba(201,168,76,0.24), rgba(201,168,76,0.12))',
                border: '1.5px solid rgba(201,168,76,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 28px rgba(201,168,76,0.32)',
              }}>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
                  stroke="#C9A84C" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.50))' }}>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>

              {/* Primary CTA text */}
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 24,
                fontWeight: 800,
                color: '#F2F6FA',
                direction: 'rtl',
                letterSpacing: '-0.2px',
              }}>
                בואי נשוחח, Martita
              </div>

              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 18,
                fontWeight: 600,
                color: 'rgba(201,168,76,0.90)',
                direction: 'rtl',
              }}>
                על כל דבר שבא לך 💛
              </div>

              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 15,
                color: 'rgba(255,255,255,0.55)',
                direction: 'rtl',
                lineHeight: 1.5,
              }}>
                דברי ואני אענה לך קולית
              </div>
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
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 10,
                  marginBottom: 16,
                  animation: isLast ? 'msgIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
                }}
              >
                {/* AI avatar disc */}
                {!isUser && (
                  <div style={{
                    width: 40, height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(145deg, rgba(20,184,166,0.18), rgba(20,184,166,0.08))',
                    border: '1.5px solid rgba(20,184,166,0.52)',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 10px rgba(20,184,166,0.22)',
                    marginBottom: 22,
                  }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <defs>
                        <linearGradient id="aiStarInline" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FDE68A"/>
                          <stop offset="55%" stopColor="#C9A84C"/>
                          <stop offset="100%" stopColor="#A07830"/>
                        </linearGradient>
                      </defs>
                      <path d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z" fill="url(#aiStarInline)"/>
                    </svg>
                  </div>
                )}

                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '78%' : '82%',
                }}>
                  {/* Sender label */}
                  <div style={{
                    fontSize: 10,
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 600,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: isUser
                      ? 'rgba(20,184,166,0.65)'
                      : 'rgba(201,168,76,0.65)',
                    marginBottom: 5,
                    direction: 'ltr',
                    paddingInline: 4,
                  }}>
                    {isUser ? 'את' : 'אבו AI'}
                  </div>

                  {/* Bubble */}
                  <div style={isUser ? {
                    padding: '18px 22px',
                    borderRadius: '20px 20px 6px 20px',
                    background: 'linear-gradient(140deg, rgba(20,184,166,0.32) 0%, rgba(14,157,140,0.20) 100%)',
                    border: '1px solid rgba(20,184,166,0.55)',
                    boxShadow: '0 4px 20px rgba(20,184,166,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
                  } : {
                    padding: '18px 22px',
                    borderRadius: '8px 24px 24px 24px',
                    background: 'rgba(255,255,255,0.09)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRight: '3px solid rgba(201,168,76,0.35)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}>
                    <div style={{
                      fontSize: isUser ? 21 : 16,
                      lineHeight: isUser ? 1.75 : 1.9,
                      color: '#F2F6FA',
                      direction: 'rtl',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: "'Heebo',sans-serif",
                      fontWeight: isUser ? 500 : 400,
                    }}>
                      {msg.content}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.42)',
                    textAlign: isUser ? 'right' : 'left',
                    fontFamily: "'DM Sans',sans-serif",
                    direction: 'ltr',
                    letterSpacing: '0.2px',
                  }}>
                    {ts}
                  </div>
                </div>
              </div>
            )
          })}

          {/* ── Loading dots ── */}
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 10,
              marginBottom: 18,
              animation: 'msgIn 0.22s ease-out both',
            }}>
              {/* AI avatar for loading */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '1.5px solid rgba(20,184,166,0.45)',
                overflow: 'hidden', flexShrink: 0,
                background: '#0c1e28',
                boxShadow: '0 2px 10px rgba(20,184,166,0.18)',
              }}>
                <img
                  src={martitaPhoto}
                  alt="Abu AI"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                  onError={handleMartitaImgError}
                />
              </div>

              {/* Dots bubble */}
              <div style={{
                padding: '18px 24px',
                borderRadius: '8px 24px 24px 24px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRight: '3px solid rgba(201,168,76,0.28)',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 13, height: 13, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #5EEAD4, #14b8a6)',
                      boxShadow: '0 0 8px rgba(20,184,166,0.45)',
                      animation: `dotPulse 1.8s ease-in-out ${i * 0.22}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────── VOICE MODE FULL-SCREEN OVERLAY ─────────────────────── */}
      {voiceMode && (
        <div style={{
          position: 'absolute',
          top: 72,
          left: 0, right: 0, bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: [
            'radial-gradient(ellipse 85% 65% at 50% 38%, rgba(20,184,166,0.10) 0%, transparent 65%)',
            'radial-gradient(ellipse 70% 50% at 50% 80%, rgba(201,168,76,0.07) 0%, transparent 60%)',
            'linear-gradient(180deg, rgba(5,10,24,0.92) 0%, rgba(5,10,24,0.98) 100%)',
          ].join(', '),
          zIndex: 15,
          paddingBottom: 28,
          gap: 0,
        }}>

          {/* ── LARGE ORB — 200px with ripples ── */}
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            {/* Ripple rings — visible when active */}
            {(voicePhase === 'listening' || voicePhase === 'speaking' || voicePhase === 'greeting') && (<>
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.42)',
                animation: 'ripple1 3.2s ease-out 0s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.24)',
                animation: 'ripple2 3.2s ease-out 1.1s infinite',
              }} />
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '0.5px solid rgba(201,168,76,0.13)',
                animation: 'ripple3 3.2s ease-out 2.2s infinite',
              }} />
            </>)}

            {/* Orb body — with SVG noise texture overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: voicePhase === 'listening'
                ? 'radial-gradient(circle at 38% 32%, rgba(255,235,148,0.26) 0%, rgba(201,168,76,0.16) 40%, rgba(12,22,40,0.97) 78%)'
                : voicePhase === 'speaking' || voicePhase === 'greeting'
                ? 'radial-gradient(circle at 38% 32%, rgba(94,234,212,0.22) 0%, rgba(20,184,166,0.14) 40%, rgba(12,22,40,0.97) 78%)'
                : 'radial-gradient(circle at 38% 32%, rgba(201,168,76,0.14) 0%, rgba(20,32,48,0.97) 78%)',
              border: voicePhase === 'speaking' || voicePhase === 'greeting'
                ? '2px solid rgba(20,184,166,0.60)'
                : voicePhase === 'listening'
                ? '2px solid rgba(201,168,76,0.58)'
                : '2px solid rgba(201,168,76,0.38)',
              animation: voicePhase === 'speaking' || voicePhase === 'greeting'
                ? 'orbGlowTeal 2.8s ease-in-out infinite, orbFloat 4.5s ease-in-out infinite'
                : 'orbGlowGold 3.2s ease-in-out infinite, orbFloat 5s ease-in-out infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              transition: 'border-color 0.6s ease, background 0.6s ease',
              overflow: 'hidden',
            }}>
              {/* Subtle noise texture overlay via SVG filter */}
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                opacity: 0.06,
                backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                backgroundSize: 'cover',
                pointerEvents: 'none',
              }} />

              {/* LISTENING: large mic */}
              {voicePhase === 'listening' && (
                <svg viewBox="0 0 24 24" width="68" height="68" fill="none"
                  stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 0 18px rgba(201,168,76,0.75))', position: 'relative', zIndex: 1 }}>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}

              {/* PROCESSING: smooth gold spinner */}
              {voicePhase === 'processing' && (
                <div style={{
                  width: 54, height: 54, borderRadius: '50%',
                  border: '3.5px solid rgba(201,168,76,0.20)',
                  borderTopColor: GOLD,
                  animation: 'spin 1.1s linear infinite',
                  position: 'relative', zIndex: 1,
                }} />
              )}

              {/* SPEAKING / GREETING: animated wave bars */}
              {(voicePhase === 'speaking' || voicePhase === 'greeting') && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', height: 60, position: 'relative', zIndex: 1 }}>
                  {[20, 32, 44, 56, 44, 32, 20].map((h, i) => (
                    <div key={i} style={{
                      width: 6, borderRadius: 4,
                      background: 'linear-gradient(180deg, #5EEAD4, #14B8A6)',
                      height: `${h}px`,
                      animation: `waveBar ${0.95 + i * 0.08}s ease-in-out ${i * 0.11}s infinite`,
                      boxShadow: '0 0 8px rgba(20,184,166,0.50)',
                    }} />
                  ))}
                </div>
              )}

              {/* CONNECTING (null phase): soft spinner */}
              {!voicePhase && (
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  border: '3px solid rgba(201,168,76,0.20)',
                  borderTopColor: GOLD,
                  animation: 'spin 1.2s linear infinite',
                  position: 'relative', zIndex: 1,
                }} />
              )}
            </div>
          </div>

          {/* ── Phase label block ── */}
          <div style={{
            marginTop: 36,
            textAlign: 'center',
            direction: 'rtl',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            minHeight: 88,
          }}>
            {voicePhase === 'greeting' ? (
              <>
                <div style={{
                  fontFamily: "'Cormorant Garamond',Georgia,serif",
                  fontSize: 36,
                  fontStyle: 'italic',
                  background: 'linear-gradient(135deg, #FDE68A, #C9A84C, #A88A35)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 10px rgba(201,168,76,0.38))',
                  letterSpacing: '0.5px',
                } as React.CSSProperties}>
                  Martita ✨
                </div>
                <div style={{
                  fontFamily: "'Heebo',sans-serif",
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.90)',
                  letterSpacing: '-0.2px',
                  lineHeight: 1.5,
                }}>
                  {new Date().getHours() >= 5 && new Date().getHours() < 12
                    ? 'בוקר טוב'
                    : new Date().getHours() < 17
                    ? 'צהריים טובים'
                    : new Date().getHours() < 21
                    ? 'ערב טוב'
                    : 'לילה טוב'} 🌟
                </div>
              </>
            ) : (
              <>
                {/* Primary phase label — 38px with 0.5px letter-spacing */}
                <div style={{
                  fontSize: 38,
                  fontWeight: 800,
                  fontFamily: "'Heebo',sans-serif",
                  color: voicePhase === 'listening' ? '#FDE68A'
                    : voicePhase === 'speaking' ? '#5EEAD4'
                    : '#F2F6FA',
                  letterSpacing: '0.5px',
                  lineHeight: 1.2,
                  transition: 'color 0.4s ease',
                }}>
                  {voicePhase === 'listening'  ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      מקשיב...
                      {/* Animated dot pulse for listening */}
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        {[0,1,2].map(i => (
                          <span key={i} style={{
                            display: 'inline-block',
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#FDE68A',
                            animation: `dotPulse 1.4s ease-in-out ${i * 0.22}s infinite`,
                          }} />
                        ))}
                      </span>
                    </span>
                  )
                    : voicePhase === 'processing' ? 'חושבת...'
                    : voicePhase === 'speaking'   ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        מדברת...
                        {/* Mini waveform for speaking */}
                        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', height: 28 }}>
                          {[12,20,28,20,12].map((h, i) => (
                            <span key={i} style={{
                              display: 'inline-block',
                              width: 4, borderRadius: 2,
                              background: '#5EEAD4',
                              height: `${h}px`,
                              animation: `waveBar ${0.8 + i * 0.1}s ease-in-out ${i * 0.12}s infinite`,
                            }} />
                          ))}
                        </span>
                      </span>
                    )
                    : 'מתחברת...'}
                </div>

                {/* Secondary hint */}
                <div style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.62)',
                  fontFamily: "'Heebo',sans-serif",
                  lineHeight: 1.5,
                }}>
                  {voicePhase === 'listening'   ? 'דברי בנחת — שומעת אותך'
                    : voicePhase === 'processing' ? 'רגע קטן...'
                    : voicePhase === 'speaking'   ? 'הקשי לי'
                    : ''}
                </div>
              </>
            )}

            {/* Tertiary hint */}
            <div style={{
              fontSize: 19,
              color: 'rgba(255,255,255,0.48)',
              fontFamily: "'Heebo',sans-serif",
              fontWeight: 500,
              direction: 'rtl',
              lineHeight: 1.5,
            }}>
              {voicePhase === 'speaking' ? 'לחצי כדי לעצור' : voicePhase === null ? '' : '"ביי" — לסיום השיחה'}
            </div>
          </div>

          {/* ── Stop / end call button ── */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={exitVoiceMode}
              aria-label="סיים שיחה קולית"
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(80,100,120,0.22)',
                border: '1.5px solid rgba(100,116,139,0.38)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.10s ease-out, background 0.12s ease, border-color 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 20px rgba(0,0,0,0.30)',
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'scale(0.88)'
                e.currentTarget.style.background = 'rgba(239,68,68,0.22)'
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.52)'
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'rgba(80,100,120,0.22)'
                e.currentTarget.style.borderColor = 'rgba(100,116,139,0.38)'
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'rgba(80,100,120,0.22)'
                e.currentTarget.style.borderColor = 'rgba(100,116,139,0.38)'
              }}
            >
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2.5" fill="rgba(255,255,255,0.80)"/>
              </svg>
            </button>
            <span style={{
              fontSize: 17,
              color: 'rgba(255,255,255,0.55)',
              fontFamily: "'Heebo',sans-serif",
              fontWeight: 600,
            }}>סיום שיחה</span>
          </div>
        </div>
      )}

      {/* ─────────────────────── FLOATING INPUT BAR ─────────────────────── */}
      {!voiceMode && (
        <div style={{
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          padding: '10px 14px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, rgba(5,10,24,0.88) 0%, rgba(5,10,24,0.96) 100%)',
          backdropFilter: 'blur(22px)',
          borderTop: '1px solid rgba(20,184,166,0.18)',
          boxShadow: '0 -8px 36px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)',
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
              boxShadow: '0 2px 12px rgba(239,68,68,0.18)',
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#ef4444',
                animation: 'abuPulse 1s infinite',
              }} />
              מקליט... {formatTime(recordingTime)}
            </div>
          )}

          {/* Row: mic | textarea | send */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>

            {/* ── Mic button — 56×56, teal gradient ── */}
            <button
              type="button"
              onClick={handleMicTap}
              disabled={micDisabled}
              aria-label={recording ? 'עצרי הקלטה' : 'הקלטה קולית'}
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: recording
                  ? 'rgba(239,68,68,0.16)'
                  : micDisabled
                  ? 'rgba(20,184,166,0.07)'
                  : 'linear-gradient(145deg, rgba(20,184,166,0.22), rgba(20,184,166,0.12))',
                border: recording
                  ? '1.5px solid rgba(239,68,68,0.48)'
                  : '1.5px solid rgba(20,184,166,0.42)',
                cursor: micDisabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                animation: recording ? 'micPulse 1.5s ease-in-out infinite' : 'none',
                transition: 'background 0.15s ease-out, border-color 0.15s ease-out',
                WebkitTapHighlightColor: 'transparent',
                opacity: micDisabled ? 0.45 : 1,
                boxShadow: recording
                  ? '0 4px 16px rgba(239,68,68,0.25)'
                  : micDisabled
                  ? 'none'
                  : '0 4px 16px rgba(20,184,166,0.22)',
              }}
            >
              {transcribing ? (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2.5px solid rgba(201,168,76,0.40)',
                  borderTopColor: GOLD,
                  animation: 'spin 0.9s linear infinite',
                }} />
              ) : recording ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#ef4444" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
                  stroke={micDisabled ? 'rgba(255,255,255,0.22)' : TEAL}
                  strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {/* ── Textarea — 62px min, more glass-like ── */}
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
                padding: '18px 20px',
                borderRadius: 28,
                border: '1.5px solid rgba(20,184,166,0.28)',
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)',
                color: 'rgba(255,255,255,0.95)',
                fontSize: 20,
                fontFamily: "'Heebo',sans-serif",
                direction: 'rtl',
                lineHeight: 1.6,
                outline: 'none',
                minHeight: 62,
                maxHeight: 130,
                overflowY: 'auto',
                opacity: (loading || recording) ? 0.50 : 1,
                WebkitAppearance: 'none',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            />

            {/* ── Send button — 56×56, gold gradient ── */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sendDisabled}
              aria-label="שלח הודעה"
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: sendDisabled
                  ? 'rgba(255,255,255,0.07)'
                  : 'linear-gradient(140deg, #C9A84C 0%, #B8922A 50%, #A07828 100%)',
                border: sendDisabled
                  ? '1px solid rgba(255,255,255,0.10)'
                  : '1px solid rgba(201,168,76,0.55)',
                cursor: sendDisabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.18s ease-out, transform 0.10s ease-out',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: sendDisabled ? 'none' : '0 4px 20px rgba(201,168,76,0.35)',
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

          {/* ── Voice mode toggle pill — gold border, gold text, more padding ── */}
          <div style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              type="button"
              onClick={handleVoiceTap}
              aria-label="מצב שיחה קולית"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 26px',
                borderRadius: 22,
                background: 'rgba(201,168,76,0.10)',
                border: '1.5px solid rgba(201,168,76,0.40)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
                boxShadow: '0 2px 12px rgba(201,168,76,0.12)',
              }}
              onPointerDown={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.18)' }}
              onPointerUp={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.10)' }}
              onPointerLeave={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.10)' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'rgba(201,168,76,0.92)',
                fontFamily: "'Heebo',sans-serif",
                direction: 'rtl',
                letterSpacing: '0.2px',
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
