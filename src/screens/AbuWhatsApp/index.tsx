import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { generateMessage, transcribeAudio, getSupportedMimeType } from './service'
import { speak, stopSpeaking, createSilenceDetector } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import type { SilenceDetector } from '../../services/voice'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const WA_GREEN = '#25D366'

const STYLES = ['רגיל', 'חם', 'רגשי', 'מצחיק'] as const
type Style = typeof STYLES[number]

type Phase = 'idle' | 'recording' | 'transcribing' | 'generating' | 'result'

// Style detection from voice commands
const STYLE_KEYWORDS: Record<string, Style> = {
  'רגיל': 'רגיל',
  'חם': 'חם',
  'חמה': 'חם',
  'רגשי': 'רגשי',
  'רגשית': 'רגשי',
  'מצחיק': 'מצחיק',
  'מצחיקה': 'מצחיק',
  'מצחיקי': 'מצחיק',
}

// Send commands
const SEND_KEYWORDS = ['שלח', 'שלחי', 'תשלחי', 'תשלח', 'שלחו']

// Retry commands
const RETRY_KEYWORDS = ['עוד פעם', 'נסי שוב', 'שוב', 'תנסי', 'שנה', 'שני', 'תשני', 'אחרת']

// Exit commands
const EXIT_KEYWORDS = ['ביי', 'להתראות', 'תודה', 'עצרי', 'סטופ', 'stop', 'bye']

function detectVoiceCommand(text: string): { type: 'send' } | { type: 'retry' } | { type: 'style'; style: Style } | { type: 'exit' } | { type: 'newIntent'; intent: string } {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase ? trimmed.toLowerCase() : trimmed

  // Check exit first
  if (EXIT_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' '))) return { type: 'exit' }

  // Check send
  if (SEND_KEYWORDS.some(k => lower === k || lower.startsWith(k + ' ') || lower.endsWith(' ' + k))) return { type: 'send' }

  // Check style
  for (const [keyword, style] of Object.entries(STYLE_KEYWORDS)) {
    if (lower === keyword || lower === `יותר ${keyword}` || lower === `תעשי ${keyword}` || lower === `בסגנון ${keyword}`) {
      return { type: 'style', style }
    }
  }

  // Check retry
  if (RETRY_KEYWORDS.some(k => lower === k || lower.startsWith(k))) return { type: 'retry' }

  // Default: new intent
  return { type: 'newIntent', intent: trimmed }
}

export function AbuWhatsApp() {
  const setScreen = useAppStore(s => s.setScreen)
  const [phase, setPhase] = useState<Phase>('idle')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [activeStyle, setActiveStyle] = useState<Style>('רגיל')
  const [recordingTime, setRecordingTime] = useState(0)
  const [lastIntent, setLastIntent] = useState('')

  // Voice conversation mode
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'listening' | 'processing' | 'speaking' | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [copyToast, setCopyToast] = useState(false)

  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceModeRef = useRef(false)
  const silenceRef = useRef<SilenceDetector | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastIntentRef = useRef('')
  const activeStyleRef = useRef<Style>('רגיל')
  const resultRef = useRef('')
  const hasResultRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  useEffect(() => { lastIntentRef.current = lastIntent }, [lastIntent])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { resultRef.current = result; hasResultRef.current = !!result }, [result])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (levelRef.current) clearInterval(levelRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      silenceRef.current?.stop()
      stopSpeaking()
    }
  }, [])

  const handleError = useCallback((msg: string) => {
    setError(msg)
    setPhase('idle')
  }, [])

  // ─── Manual recording (existing) ───

  const startRecording = async () => {
    setError('')
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

        // Use the recorder's actual mimeType (iOS may differ from requested mimeType)
        const actualType = recorder.mimeType || mimeType || 'audio/mp4'
        const blob = new Blob(chunksRef.current, { type: actualType })
        if (blob.size < 1000) {
          handleError('ההקלטה קצרה מדי. נסי שוב.')
          return
        }

        setPhase('transcribing')
        try {
          const text = await transcribeAudio(blob)
          if (!text.trim()) {
            handleError('לא הצלחתי להבין את ההקלטה. נסי שוב.')
            return
          }
          setLastIntent(text)
          setPhase('generating')
          const msg = await generateMessage(text, activeStyle)
          setResult(msg)
          setPhase('result')
        } catch (err: unknown) {
          handleError(err instanceof Error ? err.message : 'שגיאה בתמלול. נסי שוב.')
        }
      }

      recorder.start()
      setRecordingTime(0)
      setPhase('recording')
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      handleError('לא הצלחתי לגשת למיקרופון. בדקי את ההרשאות.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop()
  }

  const handleMicTap = () => {
    if (phase === 'recording') stopRecording()
    else if (phase === 'idle') startRecording()
  }

  const handleTextGenerate = async () => {
    const text = input.trim()
    if (!text) return
    setError('')
    setLastIntent(text)
    setPhase('generating')
    try {
      const msg = await generateMessage(text, activeStyle)
      setResult(msg)
      setPhase('result')
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'שגיאה. נסי שוב.')
    }
  }

  const handleStyleTap = async (style: Style) => {
    if (!lastIntent) return
    setActiveStyle(style)
    setPhase('generating')
    setError('')
    try {
      const msg = await generateMessage(lastIntent, style)
      setResult(msg)
      setPhase('result')
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'שגיאה. נסי שוב.')
    }
  }

  const handleRetry = () => {
    if (lastIntent) handleStyleTap(activeStyle)
  }

  const handleSendToFamily = async () => {
    // WhatsApp cannot open a specific group with pre-filled text via any URL scheme.
    // Best solution: copy message to clipboard → open family group → user pastes and sends.
    try { await navigator.clipboard.writeText(result) } catch { /* ignore — message still visible */ }
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 5000)
    // Small delay so the toast appears before WhatsApp takes focus
    setTimeout(() => {
      window.location.href = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'
    }, 500)
  }

  const handleNewMessage = () => {
    setInput('')
    setResult('')
    setError('')
    setLastIntent('')
    setPhase('idle')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ─── Voice Conversation Mode ───

  const cleanupVoiceResources = useCallback(() => {
    silenceRef.current?.stop()
    silenceRef.current = null
    if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [])

  const voiceGenerate = useCallback(async (intent: string, style: Style): Promise<string | null> => {
    try {
      const msg = await generateMessage(intent, style)
      setResult(msg)
      setLastIntent(intent)
      setPhase('result')
      return msg
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
      setError(errText)
      return null
    }
  }, [])

  const startVoiceListening = useCallback(async () => {
    if (!voiceModeRef.current) return
    setVoicePhase('listening')
    setAudioLevel(0)

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
        if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
        silenceRef.current?.stop()
        silenceRef.current = null

        if (!voiceModeRef.current) return

        // Use the recorder's actual mimeType (iOS may differ from requested mimeType)
        const actualType = recorder.mimeType || mimeType || 'audio/mp4'
        const blob = new Blob(chunksRef.current, { type: actualType })
        if (blob.size < 1000) {
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

          // Detect voice command
          const cmd = detectVoiceCommand(text)

          if (cmd.type === 'exit') {
            exitVoiceMode()
            return
          }

          if (cmd.type === 'send' && hasResultRef.current) {
            // Send the current message
            setVoicePhase('speaking')
            await speak('שולחת למשפחה')
            handleSendToFamily()
            if (voiceModeRef.current) {
              // Ask if they want another message
              await new Promise(r => setTimeout(r, 1000))
              if (voiceModeRef.current) {
                await speak('ההודעה נשלחה. רוצה לכתוב עוד הודעה?')
                hasResultRef.current = false
                setResult('')
                setPhase('idle')
                if (voiceModeRef.current) {
                  await new Promise(r => setTimeout(r, 400))
                  if (voiceModeRef.current) startVoiceListening()
                }
              }
            }
            return
          }

          if (cmd.type === 'retry' && lastIntentRef.current) {
            setVoicePhase('processing')
            const msg = await voiceGenerate(lastIntentRef.current, activeStyleRef.current)
            if (msg && voiceModeRef.current) {
              setVoicePhase('speaking')
              await speak(msg)
              if (voiceModeRef.current) {
                await new Promise(r => setTimeout(r, 500))
                if (voiceModeRef.current) startVoiceListening()
              }
            } else if (voiceModeRef.current) {
              startVoiceListening()
            }
            return
          }

          if (cmd.type === 'style') {
            setActiveStyle(cmd.style)
            activeStyleRef.current = cmd.style
            const intent = lastIntentRef.current || 'הודעה למשפחה'
            setVoicePhase('processing')
            const msg = await voiceGenerate(intent, cmd.style)
            if (msg && voiceModeRef.current) {
              setVoicePhase('speaking')
              await speak(msg)
              if (voiceModeRef.current) {
                await new Promise(r => setTimeout(r, 500))
                if (voiceModeRef.current) startVoiceListening()
              }
            } else if (voiceModeRef.current) {
              startVoiceListening()
            }
            return
          }

          // New intent
          const intent = cmd.type === 'newIntent' ? cmd.intent : text
          setVoicePhase('processing')
          const msg = await voiceGenerate(intent, activeStyleRef.current)
          if (msg && voiceModeRef.current) {
            setVoicePhase('speaking')
            await speak(msg)
            if (voiceModeRef.current) {
              await new Promise(r => setTimeout(r, 500))
              if (voiceModeRef.current) startVoiceListening()
            }
          } else if (voiceModeRef.current) {
            if (error) {
              setVoicePhase('speaking')
              await speak(error)
            }
            if (voiceModeRef.current) {
              await new Promise(r => setTimeout(r, 600))
              if (voiceModeRef.current) startVoiceListening()
            }
          }
        } catch (err) {
          const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
          setError(errText)
          if (voiceModeRef.current) {
            setVoicePhase('speaking')
            await speak(errText)
            await new Promise(r => setTimeout(r, 600))
            if (voiceModeRef.current) startVoiceListening()
          }
        }
      }

      recorder.start()

      const detector = createSilenceDetector(stream, () => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      })
      silenceRef.current = detector

      levelRef.current = setInterval(() => {
        if (silenceRef.current && voiceModeRef.current) {
          setAudioLevel(silenceRef.current.getLevel())
        }
      }, 80)
    } catch {
      exitVoiceMode()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enterVoiceMode = useCallback(() => {
    setVoiceMode(true)
    voiceModeRef.current = true
    setError('')
    // Brief welcome then start listening
    setTimeout(async () => {
      if (!voiceModeRef.current) return
      setVoicePhase('speaking')
      await speak('מה תרצי לכתוב למשפחה?')
      if (voiceModeRef.current) {
        await new Promise(r => setTimeout(r, 300))
        if (voiceModeRef.current) startVoiceListening()
      }
    }, 200)
  }, [startVoiceListening])

  const exitVoiceMode = useCallback(() => {
    voiceModeRef.current = false
    setVoiceMode(false)
    setVoicePhase(null)
    setAudioLevel(0)
    stopSpeaking()
    cleanupVoiceResources()
  }, [cleanupVoiceResources])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const isLoading = phase === 'transcribing' || phase === 'generating'
  const ringGlow = voicePhase === 'listening' ? Math.min(40, 15 + audioLevel * 0.5) : 20
  const ringBorderOpacity = voicePhase === 'listening' ? Math.min(0.7, 0.2 + audioLevel * 0.008) : 0.3

  return (
    <div
      dir="rtl"
      style={{
        height: '100%', width: '100%', maxWidth: 412, margin: '0 auto',
        overflow: 'hidden',
        background: '#050A18',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans','Heebo',sans-serif",
        position: 'relative',
      }}
    >
      {/* ─── PREMIUM HEADER ─── */}
      <header style={{
        flexShrink: 0,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(14,22,44,1) 0%, rgba(8,14,32,1) 50%, rgba(5,10,24,1) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.03)',
        zIndex: 20,
      }}>
        {/* Inner: fixed-height content zone — always 78 px below the notch */}
        <div style={{
          position: 'relative',
          height: 78,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }}
          aria-label="חזרה לדף הבית"
          style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Abu WhatsApp — luxury metallic wordmark */}
        <div style={{
          display: 'inline-flex', alignItems: 'baseline', gap: 4, direction: 'ltr',
          position: 'relative',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '130%', height: '260%',
            background: 'radial-gradient(ellipse at center, rgba(94,234,212,0.12) 0%, rgba(37,211,102,0.06) 40%, transparent 68%)',
            pointerEvents: 'none', filter: 'blur(8px)',
          }} />
          <span style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 30, fontWeight: 600,
            letterSpacing: '2px',
            background: 'linear-gradient(135deg, #5EEAD4 0%, #2DD4BF 14%, #0D9488 28%, #5EEAD4 42%, #14B8A6 58%, #0F766E 74%, #5EEAD4 88%, #2DD4BF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 10px rgba(94,234,212,0.35)) drop-shadow(0 0 25px rgba(20,184,166,0.15)) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            position: 'relative',
          } as React.CSSProperties}>Abu</span>
          <span style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 28, fontWeight: 500,
            letterSpacing: '0.5px',
            background: 'linear-gradient(135deg, #86EFAC 0%, #4ADE80 12%, #25D366 24%, #16A34A 38%, #6EE7B7 52%, #15803D 66%, #34D399 78%, #86EFAC 90%, #4ADE80 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 10px rgba(37,211,102,0.35)) drop-shadow(0 0 22px rgba(37,211,102,0.15)) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            position: 'relative',
          } as React.CSSProperties}>WhatsApp</span>
        </div>

        {/* Martita portrait */}
        <div style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          width: 52, height: 52, borderRadius: '50%',
          border: '2px solid rgba(37,211,102,0.50)',
          boxShadow: '0 0 0 2px rgba(37,211,102,0.06), 0 0 18px rgba(37,211,102,0.15), 0 3px 10px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #0c2228, #050A18)',
        }}>
          <img
            src={martitaPhoto} alt="Martita" loading="eager"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
            onError={handleMartitaImgError}
          />
        </div>
        </div>{/* end inner content wrapper */}
      </header>

      {/* ─── CONTENT ─── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '24px 16px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        WebkitOverflowScrolling: 'touch',
        background: 'radial-gradient(ellipse at 50% 10%, rgba(37,211,102,0.045) 0%, transparent 55%)',
        position: 'relative',
      }}>
        {/* ERROR */}
        {error && !voiceMode && (
          <div style={{
            padding: '13px 18px', borderRadius: 16, marginBottom: 16, width: '100%', maxWidth: 360,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.03))',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            color: 'rgba(255,255,255,0.8)', fontSize: 15,
            direction: 'rtl', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* ─── IDLE STATE ─── */}
        {phase === 'idle' && !voiceMode && (
          <>
            {/* Voice conversation button — primary CTA */}
            <button
              type="button"
              onClick={enterVoiceMode}
              style={{
                width: 100, height: 100, borderRadius: '50%',
                background: `linear-gradient(145deg, rgba(37,211,102,0.18), rgba(18,140,126,0.08))`,
                border: '2.5px solid rgba(37,211,102,0.35)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                boxShadow: [
                  `0 6px 30px rgba(37,211,102,0.20)`,
                  `0 0 50px rgba(37,211,102,0.08)`,
                  'inset 0 1px 0 rgba(255,255,255,0.08)',
                ].join(', '),
                marginTop: 4, marginBottom: 6,
                transition: 'transform 0.1s ease-out',
              }}
              onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)' }}
              onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none"
                stroke={WA_GREEN} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"
                style={{ filter: `drop-shadow(0 2px 6px rgba(37,211,102,0.3))` }}>
                <path d="M2 12h2" />
                <path d="M6 8v8" />
                <path d="M10 5v14" />
                <path d="M14 8v8" />
                <path d="M18 10v4" />
                <path d="M22 12h-2" />
              </svg>
              <span style={{
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                color: 'rgba(37,211,102,0.8)',
              }}>שיחה קולית</span>
            </button>

            <div style={{
              fontFamily: "'Heebo',sans-serif", fontSize: 18, fontWeight: 400,
              color: 'rgba(255,255,255,0.55)', marginBottom: 20,
              textAlign: 'center',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}>
              דברי או כתבי
            </div>

            {/* Single mic button */}
            <button
              type="button"
              onClick={handleMicTap}
              aria-label="הקלטה קולית"
              style={{
                width: 68, height: 68, borderRadius: '50%',
                background: `linear-gradient(145deg, #2ee67a, ${WA_GREEN}, #128C7E)`,
                border: '2.5px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 6px 28px rgba(37,211,102,0.4), 0 0 50px rgba(37,211,102,0.12), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -3px 6px rgba(0,0,0,0.2)`,
                marginBottom: 20,
                transition: 'transform 0.1s ease-out',
              }}
              onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.93)' }}
              onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextGenerate() } }}
              placeholder="מה את רוצה לכתוב למשפחה?"
              rows={3}
              style={{
                width: '100%', maxWidth: 360, resize: 'none',
                padding: '14px 18px',
                borderRadius: 18,
                border: '1px solid rgba(37,211,102,0.2)',
                background: 'linear-gradient(135deg, #0c1628, #0a1220)',
                color: 'rgba(255,255,255,0.9)',
                fontSize: 17, fontFamily: "'DM Sans','Heebo',sans-serif",
                direction: 'rtl', lineHeight: 1.6,
                outline: 'none', minHeight: 80,
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.02)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.4)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.2)' }}
            />

            {/* Style selector */}
            <div style={{
              display: 'flex', gap: 8, justifyContent: 'center',
              marginTop: 14, marginBottom: 6,
            }}>
              {STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setActiveStyle(style)}
                  style={{
                    padding: '8px 16px', borderRadius: 18,
                    border: activeStyle === style
                      ? '1.5px solid rgba(37,211,102,0.5)'
                      : '1px solid rgba(255,255,255,0.10)',
                    background: activeStyle === style
                      ? 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(37,211,102,0.04))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                    color: activeStyle === style ? WA_GREEN : 'rgba(255,255,255,0.55)',
                    fontSize: 14, fontWeight: 500, fontFamily: "'Heebo',sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                  }}
                >{style}</button>
              ))}
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleTextGenerate}
              disabled={!input.trim()}
              style={{
                marginTop: 10,
                padding: '14px 40px',
                borderRadius: 26,
                border: !input.trim() ? '1px solid rgba(37,211,102,0.06)' : '1.5px solid rgba(37,211,102,0.3)',
                background: !input.trim()
                  ? 'rgba(37,211,102,0.10)'
                  : `linear-gradient(145deg, #2ee67a, ${WA_GREEN}, #128C7E)`,
                color: !input.trim() ? 'rgba(255,255,255,0.25)' : 'white',
                fontSize: 18, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                cursor: !input.trim() ? 'default' : 'pointer',
                boxShadow: !input.trim() ? 'none' : '0 4px 18px rgba(37,211,102,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              כתבי לי
            </button>
          </>
        )}

        {/* ─── RECORDING STATE ─── */}
        {phase === 'recording' && !voiceMode && (
          <>
            <button
              type="button"
              onClick={handleMicTap}
              aria-label="עצרי הקלטה"
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(145deg, #f87171, #ef4444, #b91c1c)',
                border: '2.5px solid rgba(255,255,255,0.15)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 28px rgba(239,68,68,0.4), inset 0 2px 0 rgba(255,255,255,0.12)',
                marginTop: 12, marginBottom: 14,
                animation: 'recPulse 1.5s ease-in-out infinite',
              }}
            >
              <svg viewBox="0 0 24 24" width="32" height="32" fill="white" aria-hidden="true"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>

            <div style={{
              fontFamily: "'Heebo',sans-serif", fontSize: 26, fontWeight: 600,
              color: '#ef4444', marginBottom: 8,
              textShadow: '0 0 12px rgba(239,68,68,0.25), 0 2px 4px rgba(0,0,0,0.5)',
            }}>
              {formatTime(recordingTime)}
            </div>
            <div style={{
              fontFamily: "'Heebo',sans-serif", fontSize: 16,
              color: 'rgba(255,255,255,0.5)',
            }}>
              מקליטה... הקשי שוב לעצור
            </div>
          </>
        )}

        {/* ─── LOADING STATE ─── */}
        {isLoading && !voiceMode && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            marginTop: 40,
          }}>
            <div style={{
              padding: '22px 30px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(37,211,102,0.08), rgba(18,140,126,0.03))',
              border: '1px solid rgba(37,211,102,0.18)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: WA_GREEN, opacity: 0.6,
                    animation: `waPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
            <span style={{
              fontFamily: "'Heebo',sans-serif",
              fontSize: 16, color: 'rgba(255,255,255,0.5)',
            }}>
              {phase === 'transcribing' ? 'מתמללת...' : 'מכינה את ההודעה...'}
            </span>
          </div>
        )}

        {/* ─── RESULT STATE ─── */}
        {phase === 'result' && !voiceMode && (
          <>
            {/* Generated message card */}
            <div style={{
              width: '100%', maxWidth: 360,
              padding: '24px 26px',
              borderRadius: 22,
              background: 'linear-gradient(145deg, rgba(37,211,102,0.10), rgba(18,140,126,0.04), rgba(5,10,24,0.9))',
              border: '1.5px solid rgba(37,211,102,0.25)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
              marginTop: 8, marginBottom: 18,
            }}>
              <div style={{
                fontSize: 19, lineHeight: 1.8,
                color: 'rgba(255,255,255,0.92)',
                direction: 'rtl', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: "'Heebo',sans-serif",
              }}>
                {result}
              </div>

              {/* Listen button */}
              <button
                type="button"
                onClick={() => speak(result)}
                aria-label="הקשיבי להודעה"
                style={{
                  marginTop: 12, padding: '8px 16px', borderRadius: 16,
                  border: '1px solid rgba(37,211,102,0.2)',
                  background: 'rgba(37,211,102,0.08)',
                  color: WA_GREEN, fontSize: 13, fontWeight: 500,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke={WA_GREEN} strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(37,211,102,0.2)" />
                  <path d="M15.54 8.46a5 5 0 010 7.08" />
                </svg>
                הקשיבי
              </button>
            </div>

            {/* Style buttons */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
              justifyContent: 'center', marginBottom: 16,
              width: '100%', maxWidth: 360,
            }}>
              <button type="button" onClick={handleRetry} style={{
                padding: '10px 18px', borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                color: 'rgba(255,255,255,0.72)',
                fontSize: 14, fontWeight: 500, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>נסי שוב</button>

              {STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => handleStyleTap(style)}
                  style={{
                    padding: '10px 18px', borderRadius: 20,
                    border: activeStyle === style
                      ? '1.5px solid rgba(37,211,102,0.5)'
                      : '1px solid rgba(255,255,255,0.10)',
                    background: activeStyle === style
                      ? 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(37,211,102,0.04))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                    color: activeStyle === style ? WA_GREEN : 'rgba(255,255,255,0.55)',
                    fontSize: 14, fontWeight: 500, fontFamily: "'Heebo',sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                    boxShadow: activeStyle === style
                      ? '0 0 12px rgba(37,211,102,0.12), 0 2px 6px rgba(0,0,0,0.15)'
                      : '0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >{style}</button>
              ))}
            </div>

            {/* Copy toast */}
            {copyToast && (
              <div style={{
                width: '100%', maxWidth: 360,
                padding: '13px 18px', borderRadius: 16,
                background: 'rgba(37,211,102,0.13)',
                border: '1.5px solid rgba(37,211,102,0.40)',
                display: 'flex', alignItems: 'center', gap: 10,
                direction: 'rtl',
              }}>
                <span style={{ fontSize: 20 }}>📋</span>
                <div style={{ fontFamily: "'Heebo',sans-serif" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>
                    ההודעה הועתקה!
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                    הדבקי בקבוצה (לחצי לחיצה ארוכה → הדבק) ושלחי
                  </div>
                </div>
              </div>
            )}

            {/* Send to family */}
            <button
              type="button"
              onClick={handleSendToFamily}
              style={{
                width: '100%', maxWidth: 360,
                padding: '16px 24px',
                borderRadius: 26,
                border: '1.5px solid rgba(37,211,102,0.3)',
                background: `linear-gradient(145deg, #2ee67a, ${WA_GREEN}, #128C7E)`,
                color: 'white',
                fontSize: 19, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer',
                boxShadow: '0 6px 24px rgba(37,211,102,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              שלחי למשפחה 📲
            </button>

            {/* Voice conversation + new message */}
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                onClick={enterVoiceMode}
                style={{
                  padding: '10px 20px', borderRadius: 20,
                  border: '1px solid rgba(37,211,102,0.18)',
                  background: 'rgba(37,211,102,0.06)',
                  color: WA_GREEN, fontSize: 14, fontWeight: 500,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                  stroke={WA_GREEN} strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12h2" /><path d="M6 8v8" /><path d="M10 5v14" /><path d="M14 8v8" /><path d="M18 10v4" /><path d="M22 12h-2" />
                </svg>
                שיחה קולית
              </button>

              <button
                type="button"
                onClick={handleNewMessage}
                style={{
                  padding: '10px 24px', borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 14, fontWeight: 500, fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                }}
              >
                הודעה חדשה
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── VOICE MODE OVERLAY ─── */}
      {voiceMode && (
        <div style={{
          position: 'absolute',
          top: 78, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,10,24,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 15,
        }}>
          {/* Current message preview (if exists) */}
          {result && (
            <div style={{
              position: 'absolute', top: 16, left: 16, right: 16,
              padding: '14px 18px',
              borderRadius: 16,
              background: 'linear-gradient(145deg, rgba(37,211,102,0.08), rgba(5,10,24,0.85))',
              border: '1px solid rgba(37,211,102,0.15)',
              maxHeight: 120, overflowY: 'auto',
            }}>
              <div style={{
                fontSize: 15, lineHeight: 1.6,
                color: 'rgba(255,255,255,0.75)',
                direction: 'rtl', whiteSpace: 'pre-wrap',
                fontFamily: "'Heebo',sans-serif",
              }}>
                {result}
              </div>
            </div>
          )}

          {/* Animated ring */}
          <div style={{
            width: 160, height: 160, borderRadius: '50%',
            background: voicePhase === 'speaking'
              ? 'radial-gradient(circle, rgba(37,211,102,0.12) 0%, rgba(37,211,102,0.03) 70%, transparent 100%)'
              : voicePhase === 'processing'
                ? 'radial-gradient(circle, rgba(37,211,102,0.08) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(37,211,102,0.12) 0%, rgba(37,211,102,0.03) 70%, transparent 100%)',
            border: `3px solid ${
              voicePhase === 'speaking' ? 'rgba(37,211,102,0.45)'
              : voicePhase === 'processing' ? 'rgba(37,211,102,0.15)'
              : `rgba(37,211,102,${ringBorderOpacity.toFixed(2)})`
            }`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: voicePhase === 'speaking'
              ? '0 0 35px rgba(37,211,102,0.2), inset 0 0 20px rgba(37,211,102,0.05)'
              : `0 0 ${ringGlow}px rgba(37,211,102,${voicePhase === 'listening' ? 0.15 + audioLevel * 0.005 : 0.08}), inset 0 0 15px rgba(37,211,102,0.03)`,
            transition: 'border-color 0.12s, box-shadow 0.12s, background 0.3s',
            animation: voicePhase === 'processing' ? 'voicePulse 2s ease-in-out infinite' : 'none',
          }}>
            {voicePhase === 'listening' && (
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none"
                stroke={WA_GREEN} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(37,211,102,0.3))' }}>
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            {voicePhase === 'processing' && (
              <div style={{ display: 'flex', gap: 12 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: WA_GREEN, opacity: 0.6,
                    animation: `waPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            {voicePhase === 'speaking' && (
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none"
                stroke={WA_GREEN} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(37,211,102,0.3))' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(37,211,102,0.15)" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
                <path d="M15.54 8.46a5 5 0 010 7.08" />
              </svg>
            )}
            {!voicePhase && (
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2.5px solid rgba(37,211,102,0.4)',
                borderTopColor: WA_GREEN,
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
          </div>

          {/* Audio level bars */}
          {voicePhase === 'listening' && (
            <div style={{
              display: 'flex', gap: 4, alignItems: 'flex-end',
              height: 32, marginTop: 20,
            }}>
              {[0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 0.3].map((scale, i) => (
                <div key={i} style={{
                  width: 4, borderRadius: 2,
                  background: WA_GREEN,
                  opacity: 0.3 + Math.min(0.5, audioLevel * 0.008),
                  height: Math.max(4, audioLevel * scale * 0.4),
                  transition: 'height 0.08s ease-out, opacity 0.1s',
                }} />
              ))}
            </div>
          )}

          {/* Phase label */}
          <div style={{
            marginTop: voicePhase === 'listening' ? 12 : 28,
            fontSize: 24, fontWeight: 500,
            fontFamily: "'Heebo',sans-serif",
            color: 'rgba(37,211,102,0.85)',
            textShadow: '0 0 16px rgba(37,211,102,0.15)',
          }}>
            {voicePhase === 'listening' ? 'מקשיבה...'
              : voicePhase === 'processing' ? 'מכינה הודעה...'
              : voicePhase === 'speaking' ? 'מקריאה...'
              : 'מתחברת...'}
          </div>

          <div style={{
            marginTop: 8, fontSize: 15,
            color: 'rgba(255,255,255,0.30)',
            fontFamily: "'Heebo',sans-serif",
            textAlign: 'center', lineHeight: 1.5,
          }}>
            {result ? 'אגידי "שלח" או בקשי שינוי' : 'ספרי מה לכתוב למשפחה'}
          </div>

          {/* Exit button */}
          <button
            type="button"
            onClick={exitVoiceMode}
            aria-label="סיים שיחה קולית"
            style={{
              marginTop: 44, width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
              border: '2px solid rgba(239,68,68,0.30)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2), 0 0 20px rgba(239,68,68,0.08)',
              transition: 'transform 0.1s ease-out',
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.90)' }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none"
              stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Shared keyframe animations */}
      <style>{`
        @keyframes waPulse { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:0.8; transform:scale(1.1); } }
        @keyframes recPulse { 0%,100% { box-shadow: 0 6px 28px rgba(239,68,68,0.4), 0 0 0 0 rgba(239,68,68,0.3); } 50% { box-shadow: 0 6px 28px rgba(239,68,68,0.4), 0 0 0 16px rgba(239,68,68,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes voicePulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.04); opacity: 0.85; } }
      `}</style>
    </div>
  )
}
