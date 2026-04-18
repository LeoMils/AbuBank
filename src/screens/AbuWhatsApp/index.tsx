import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { generateMessage, transcribeAudio, getSupportedMimeType } from './service'
import { speak, speakVoiceMode, stopSpeaking, unlockIOSAudio, createSilenceDetector } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { getRandomFamilyPhoto, handleFamilyImgError } from '../../services/familyPhotos'
import { soundTap, soundSuccess, soundSend, soundCopy } from '../../services/sounds'
import type { SilenceDetector } from '../../services/voice'
import { InfoButton } from '../../components/InfoButton'
import { GRADIENT_TEAL } from '../../design/gradients'
import { BackButton } from '../../components/BackButton'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const WA_GREEN = '#25D366'

const STYLES = ['מקורי', 'בדיחה', 'חידה', 'טריק'] as const
type Style = typeof STYLES[number]

const STYLE_CARD_BORDER: Record<Style, string> = {
  'מקורי': 'rgba(20,184,166,0.40)',
  'בדיחה': 'rgba(201,168,76,0.40)',
  'חידה': 'rgba(167,139,250,0.40)',
  'טריק': 'rgba(37,211,102,0.40)',
}
const STYLE_CARD_TOP: Record<Style, string> = {
  'מקורי': '#14b8a6',
  'בדיחה': '#C9A84C',
  'חידה': '#A78BFA',
  'טריק': '#25D366',
}

type Phase = 'idle' | 'recording' | 'transcribing' | 'generating' | 'result'

// Style detection from voice commands
const STYLE_KEYWORDS: Record<string, Style> = {
  'מקורי': 'מקורי',
  'רגיל': 'מקורי',
  'רגילה': 'מקורי',
  'בדיחה': 'בדיחה',
  'בדיחות': 'בדיחה',
  'תבדחי': 'בדיחה',
  'חידה': 'חידה',
  'חידות': 'חידה',
  'שאלה': 'חידה',
  'טריק': 'טריק',
  'טיפ': 'טריק',
  'עצה': 'טריק',
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

// Per-style accent colors for pill buttons (unselected state)
const STYLE_ACCENT: Record<Style, string> = {
  'מקורי': 'rgba(255,255,255,0.55)',
  'בדיחה': 'rgba(251,191,36,0.70)',
  'חידה': 'rgba(167,139,250,0.75)',
  'טריק': 'rgba(52,211,153,0.75)',
}

export function AbuWhatsApp() {
  const setScreen = useAppStore(s => s.setScreen)
  const [phase, setPhase] = useState<Phase>('idle')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [activeStyle, setActiveStyle] = useState<Style>('מקורי')
  const [recordingTime, setRecordingTime] = useState(0)
  const [lastIntent, setLastIntent] = useState('')

  // Voice conversation mode
  const [voiceMode, setVoiceMode] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'listening' | 'processing' | 'speaking' | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [copyToast, setCopyToast] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const martitaPhoto = useMemo(() => getRandomMartitaPhoto(), [])
  const familyPhoto = useMemo(() => getRandomFamilyPhoto(), [])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceModeRef = useRef(false)
  const silenceRef = useRef<SilenceDetector | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastIntentRef = useRef('')
  const activeStyleRef = useRef<Style>('מקורי')
  const resultRef = useRef('')
  const hasResultRef = useRef(false)
  const recognitionRef = useRef<any>(null)
  const isReadingRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { voiceModeRef.current = voiceMode }, [voiceMode])
  useEffect(() => { lastIntentRef.current = lastIntent }, [lastIntent])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { resultRef.current = result; hasResultRef.current = !!result }, [result])

  useEffect(() => {
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
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
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

      recorder.start(100) // timeslice required on iOS for ondataavailable to fire
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
    soundTap()
    setError('')
    setLastIntent(text)
    setPhase('generating')
    try {
      const msg = await generateMessage(text, activeStyle)
      setResult(msg)
      soundSuccess()
      setPhase('result')
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'שגיאה. נסי שוב.')
    }
  }

  const handleStyleTap = async (style: Style) => {
    if (!lastIntent) return
    soundTap()
    setActiveStyle(style)
    setPhase('generating')
    setError('')
    try {
      const msg = await generateMessage(lastIntent, style)
      setResult(msg)
      soundSuccess()
      setPhase('result')
    } catch (err: unknown) {
      handleError(err instanceof Error ? err.message : 'שגיאה. נסי שוב.')
    }
  }

  // Direct generate — for בדיחה/חידה/טריק pills clicked from idle state.
  // No user intent needed — the style prompt is fully self-contained.
  // Each tap generates fresh content (random topic seed in service).
  const handleDirectGenerate = async (style: Style) => {
    soundTap()
    setActiveStyle(style)
    activeStyleRef.current = style
    setPhase('generating')
    setError('')
    // Use style name as minimal intent — the style prompt overrides everything
    const intent = style
    setLastIntent(intent)
    lastIntentRef.current = intent
    try {
      const msg = await generateMessage(intent, style)
      setResult(msg)
      resultRef.current = msg
      hasResultRef.current = true
      soundSuccess()
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
    soundSend()
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
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
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
      soundSuccess()
      setPhase('result')
      return msg
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
      setError(errText)
      return null
    }
  }, [])

  const startVoiceListening = useCallback(() => {
    if (!voiceModeRef.current) return
    setVoicePhase('listening')
    setAudioLevel(0)

    // ── Shared: process transcribed text → command logic → speak → listen ────
    const handleText = async (text: string) => {
      if (!voiceModeRef.current) return
      const cmd = detectVoiceCommand(text)

      if (cmd.type === 'exit') { exitVoiceMode(); return }

      if (cmd.type === 'send' && hasResultRef.current) {
        setVoicePhase('speaking')
        await speakVoiceMode('שולחת למשפחה')
        handleSendToFamily()
        if (voiceModeRef.current) {
          await new Promise(r => setTimeout(r, 1000))
          if (voiceModeRef.current) {
            await speakVoiceMode('ההודעה נשלחה. רוצה לכתוב עוד הודעה?')
            hasResultRef.current = false
            setResult('')
            setPhase('idle')
            await new Promise(r => setTimeout(r, 400))
            if (voiceModeRef.current) startVoiceListening()
          }
        }
        return
      }

      if (cmd.type === 'retry' && lastIntentRef.current) {
        setVoicePhase('processing')
        const msg = await voiceGenerate(lastIntentRef.current, activeStyleRef.current)
        if (msg && voiceModeRef.current) {
          setVoicePhase('speaking'); await speakVoiceMode(msg)
          if (voiceModeRef.current) { await new Promise(r => setTimeout(r, 500)); if (voiceModeRef.current) startVoiceListening() }
        } else if (voiceModeRef.current) { startVoiceListening() }
        return
      }

      if (cmd.type === 'style') {
        setActiveStyle(cmd.style); activeStyleRef.current = cmd.style
        const intent = lastIntentRef.current || 'הודעה למשפחה'
        setVoicePhase('processing')
        const msg = await voiceGenerate(intent, cmd.style)
        if (msg && voiceModeRef.current) {
          setVoicePhase('speaking'); await speakVoiceMode(msg)
          if (voiceModeRef.current) { await new Promise(r => setTimeout(r, 500)); if (voiceModeRef.current) startVoiceListening() }
        } else if (voiceModeRef.current) { startVoiceListening() }
        return
      }

      // New intent
      const intent = cmd.type === 'newIntent' ? cmd.intent : text
      setVoicePhase('processing')
      const msg = await voiceGenerate(intent, activeStyleRef.current)
      if (msg && voiceModeRef.current) {
        setVoicePhase('speaking'); await speakVoiceMode(msg)
        if (voiceModeRef.current) { await new Promise(r => setTimeout(r, 500)); if (voiceModeRef.current) startVoiceListening() }
      } else if (voiceModeRef.current) {
        setVoicePhase('speaking')
        await speakVoiceMode('סליחה, לא הצלחתי. נסי שוב.')
        await new Promise(r => setTimeout(r, 600))
        if (voiceModeRef.current) startVoiceListening()
      }
    }

    // ── Primary: Web Speech Recognition (iOS Safari → Apple Hebrew model) ─────
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
          setError('צריכה הרשאה למיקרופון. בדקי בהגדרות הדפדפן.')
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
        return  // ← Web Speech started — skip MediaRecorder fallback
      } catch {
        recognitionRef.current = null
      }
    }

    // ── Fallback: MediaRecorder + Whisper (non-WebKit / desktop Chrome) ───────
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
            const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
            setError(errText)
            if (voiceModeRef.current) {
              setVoicePhase('speaking')
              await speakVoiceMode(errText)
              await new Promise(r => setTimeout(r, 600))
              if (voiceModeRef.current) startVoiceListening()
            }
          }
        }

        recorder.start(100)

        const detector = createSilenceDetector(stream, () => {
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
        })
        silenceRef.current = detector

        levelRef.current = setInterval(() => {
          setAudioLevel(detector.getLevel())
        }, 80)
      } catch (err) {
        console.error('[AbuWhatsApp] getUserMedia error:', err)
        setError('מיקרופון לא זמין. בדקי בהגדרות הדפדפן.')
        exitVoiceMode()
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enterVoiceMode = useCallback(() => {
    soundTap()
    unlockIOSAudio() // unlock iOS audio synchronously from this tap context
    setVoiceMode(true)
    voiceModeRef.current = true
    setError('')
    // Brief welcome then start listening
    setTimeout(async () => {
      if (!voiceModeRef.current) return
      setVoicePhase('speaking')
      await speakVoiceMode('מה תרצי לכתוב למשפחה?')
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

      {/* ══════════════════════════════════════════════════
          HEADER — "Abu הודעות", Martita photo, back button
         ══════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(5,12,18,1) 0%, rgba(4,14,10,1) 60%, rgba(5,10,24,1) 100%)',
        borderBottom: '1px solid rgba(37,211,102,0.14)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.02)',
        zIndex: 20,
        animation: 'headerSlide 0.38s ease both',
      }}>
        {/* Soft WA-green ambient glow */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '70%', height: '280%',
          background: 'radial-gradient(ellipse at center, rgba(37,211,102,0.09) 0%, transparent 65%)',
          pointerEvents: 'none', filter: 'blur(12px)',
        }} />

        <div style={{
          position: 'relative',
          height: 82,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>

          {/* Family portrait — left */}
          <div style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 62, height: 62, borderRadius: '50%',
            border: '2px solid rgba(37,211,102,0.55)',
            boxShadow: '0 0 0 3px rgba(37,211,102,0.07), 0 0 20px rgba(37,211,102,0.18), 0 4px 12px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            background: 'linear-gradient(145deg, #0b2220, #050A18)',
          }}>
            <img
              src={familyPhoto}
              alt="Family"
              loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', display: 'block' }}
              onError={handleFamilyImgError}
            />
          </div>

          {/* Wordmark: Abu + הודעות (WA-green gradient) */}
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 5,
            direction: 'ltr', position: 'relative',
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontSize: 31, fontWeight: 600, letterSpacing: '2px',
              background: GRADIENT_TEAL,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(94,234,212,0.32)) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            } as React.CSSProperties}>Abu</span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 27, fontWeight: 500, letterSpacing: '0.3px',
              direction: 'rtl',
              background: 'linear-gradient(135deg, #86EFAC 0%, #4ADE80 12%, #25D366 24%, #16A34A 38%, #6EE7B7 52%, #15803D 66%, #34D399 78%, #86EFAC 90%, #4ADE80 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 10px rgba(37,211,102,0.32)) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
            } as React.CSSProperties}>הודעות</span>
          </div>

          {/* Back button — right */}
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <BackButton onPress={() => { if (voiceMode) exitVoiceMode(); setScreen(Screen.Home) }} />
          </div>

        </div>
      </header>

      <InfoButton
        title="Abu הודעות"
        lines={['כתיבת הודעות WhatsApp בסגנון של מרטיטה — כולל שגיאות אמיתיות.', 'בחרי בדיחה, חידה, או טריק לתוכן מיידי.']}
        howTo={['לחצי על בדיחה / חידה / טריק לתוכן מיידי', 'כתבי נושא בשדה ולחצי "כתבי לי" להודעה מותאמת אישית', 'לחצי "שלחי למשפחה" לשליחה קבוצת הווצאפ', 'לחצי על "תקשיבי" לשמיעת ההודעה']}
        position="top-left"
      />

      {/* ══════════════════════════════════════════════════
          SCROLLABLE CONTENT
         ══════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '20px 16px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 18,
        WebkitOverflowScrolling: 'touch',
        background: 'radial-gradient(ellipse at 50% 8%, rgba(37,211,102,0.04) 0%, transparent 55%)',
        position: 'relative',
      }}>

        {/* ── Error banner ── */}
        {error && !voiceMode && (
          <div style={{
            padding: '16px 22px', borderRadius: 18, width: '100%', maxWidth: 370,
            background: 'rgba(20,4,4,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(239,68,68,0.38)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.30), 0 0 0 1px rgba(239,68,68,0.08)',
            color: 'rgba(255,220,220,0.90)',
            fontSize: 16, fontFamily: "'Heebo',sans-serif",
            direction: 'rtl', textAlign: 'center',
            lineHeight: 1.6,
            animation: 'slideUpIn 0.25s ease both',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* ════════════════════════════════════
            IDLE + RECORDING STATE
           ════════════════════════════════════ */}
        {(phase === 'idle' || phase === 'recording') && !voiceMode && (
          <>
            {/* Voice conversation CTA */}
            <button
              type="button"
              onClick={enterVoiceMode}
              style={{
                width: 108, height: 108, borderRadius: '50%',
                background: 'linear-gradient(145deg, rgba(37,211,102,0.16), rgba(18,140,126,0.07))',
                border: '2.5px solid rgba(37,211,102,0.32)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                boxShadow: [
                  '0 6px 32px rgba(37,211,102,0.18)',
                  '0 0 55px rgba(37,211,102,0.07)',
                  'inset 0 1px 0 rgba(255,255,255,0.07)',
                ].join(', '),
                transition: 'transform 0.12s ease-out',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none"
                stroke={WA_GREEN} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(37,211,102,0.28))' }}>
                <path d="M2 12h2" /><path d="M6 8v8" /><path d="M10 5v14" />
                <path d="M14 8v8" /><path d="M18 10v4" /><path d="M22 12h-2" />
              </svg>
              <span style={{
                fontSize: 13, fontWeight: 600,
                fontFamily: "'Heebo',sans-serif",
                color: 'rgba(37,211,102,0.78)',
              }}>שיחה קולית</span>
            </button>

            {/* Divider label */}
            <div style={{
              fontFamily: "'Heebo',sans-serif", fontSize: 17, fontWeight: 400,
              color: 'rgba(255,255,255,0.40)',
              textAlign: 'center',
            }}>
              ─ או הקלידי ─
            </div>

            {/* ── Style selector — horizontal pill row ── */}
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%', maxWidth: 370,
            }}>
              {STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => {
                    if (style === 'מקורי') { soundTap(); setActiveStyle(style) }
                    else handleDirectGenerate(style)
                  }}
                  style={{
                    height: 46,
                    padding: '0 22px',
                    borderRadius: 23,
                    border: activeStyle === style
                      ? '1.5px solid rgba(20,184,166,0.70)'
                      : '1px solid rgba(255,255,255,0.13)',
                    background: activeStyle === style
                      ? `linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%)`
                      : 'rgba(255,255,255,0.04)',
                    color: activeStyle === style ? 'white' : STYLE_ACCENT[style],
                    fontSize: 16, fontWeight: activeStyle === style ? 700 : 500,
                    fontFamily: "'Heebo',sans-serif",
                    cursor: 'pointer',
                    boxShadow: activeStyle === style
                      ? '0 3px 16px rgba(20,184,166,0.30), 0 0 0 1px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.14)'
                      : '0 1px 4px rgba(0,0,0,0.15)',
                    transition: 'all 0.20s ease',
                    whiteSpace: 'nowrap',
                  }}
                >{style}</button>
              ))}
            </div>

            {/* ── Intent textarea ── */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 370 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextGenerate() } }}
                placeholder="מה את רוצה לכתוב למשפחה?"
                rows={4}
                style={{
                  width: '100%', resize: 'none',
                  padding: '18px 20px 18px 60px',
                  borderRadius: 20,
                  border: '1.5px solid rgba(37,211,102,0.18)',
                  background: 'linear-gradient(135deg, rgba(12,22,40,1), rgba(8,16,28,1))',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: 20, fontFamily: "'DM Sans','Heebo',sans-serif",
                  direction: 'rtl', lineHeight: 1.65,
                  outline: 'none',
                  minHeight: 110,
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.02)',
                  transition: 'border-color 0.18s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.42)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(37,211,102,0.18)' }}
              />

              {/* Mic button — 52px circle, teal border, inside textarea right-bottom */}
              <button
                type="button"
                onClick={handleMicTap}
                aria-label="הקלטה קולית"
                style={{
                  position: 'absolute',
                  left: 12, bottom: 14,
                  width: 52, height: 52, borderRadius: '50%',
                  background: (phase as Phase) === 'recording'
                    ? 'linear-gradient(145deg, #f87171, #ef4444, #b91c1c)'
                    : 'rgba(20,184,166,0.12)',
                  border: (phase as Phase) === 'recording'
                    ? '2px solid rgba(239,68,68,0.55)'
                    : `2px solid ${TEAL}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: (phase as Phase) === 'recording'
                    ? '0 4px 18px rgba(239,68,68,0.35)'
                    : `0 3px 16px rgba(20,184,166,0.22)`,
                  transition: 'all 0.14s ease-out',
                  animation: (phase as Phase) === 'recording' ? 'recPulse 1.5s ease-in-out infinite' : 'none',
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {(phase as Phase) === 'recording' ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="white" aria-hidden="true">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
                    stroke={TEAL} strokeWidth="2" strokeLinecap="round" aria-hidden="true"
                    style={{ filter: `drop-shadow(0 1px 4px rgba(20,184,166,0.30))` }}>
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            </div>

            {/* Recording timer hint */}
            {(phase as Phase) === 'recording' && (
              <div style={{
                fontFamily: "'Heebo',sans-serif",
                fontSize: 20, fontWeight: 600,
                color: '#ef4444',
                textShadow: '0 0 12px rgba(239,68,68,0.22)',
              }}>
                {formatTime(recordingTime)} — הקשי שוב לעצור
              </div>
            )}

            {/* ── Generate button — large pill ── */}
            <button
              type="button"
              onClick={handleTextGenerate}
              disabled={!input.trim() && (phase as Phase) !== 'recording'}
              style={{
                width: '100%', maxWidth: 370,
                height: 58,
                borderRadius: 29,
                border: !input.trim()
                  ? '1px solid rgba(20,184,166,0.09)'
                  : '1.5px solid rgba(20,184,166,0.45)',
                background: !input.trim()
                  ? 'rgba(20,184,166,0.07)'
                  : `linear-gradient(135deg, #14b8a6 0%, #0d9488 35%, #C9A84C 75%, #B8912A 100%)`,
                color: !input.trim() ? 'rgba(255,255,255,0.25)' : 'white',
                fontSize: 18, fontWeight: 700,
                fontFamily: "'Heebo',sans-serif",
                cursor: !input.trim() ? 'default' : 'pointer',
                boxShadow: !input.trim()
                  ? 'none'
                  : '0 6px 28px rgba(20,184,166,0.22), 0 2px 8px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.16)',
                letterSpacing: '0.3px',
                transition: 'all 0.20s ease',
                flexShrink: 0,
              }}
              onPointerDown={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(0.97)' }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              ✨ כתבי הודעה
            </button>
          </>
        )}

        {/* ════════════════════════════════════
            LOADING STATE
           ════════════════════════════════════ */}
        {isLoading && !voiceMode && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            marginTop: 50,
            animation: 'slideUpIn 0.3s ease both',
          }}>
            <div style={{
              padding: '24px 36px', borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(37,211,102,0.08), rgba(18,140,126,0.03))',
              border: '1px solid rgba(37,211,102,0.16)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: WA_GREEN, opacity: 0.55,
                    animation: `waPulse 1.2s ease-in-out ${i * 0.22}s infinite`,
                  }} />
                ))}
              </div>
            </div>
            <span style={{
              fontFamily: "'Heebo',sans-serif",
              fontSize: 18, color: 'rgba(255,255,255,0.48)',
            }}>
              {phase === 'transcribing' ? 'מתמללת...' : 'מכינה את ההודעה...'}
            </span>
          </div>
        )}

        {/* ════════════════════════════════════
            RESULT STATE
           ════════════════════════════════════ */}
        {phase === 'result' && !voiceMode && (
          <>
            {/* ── Result card — glass morphism with gold-tinted border ── */}
            <div style={{
              width: '100%', maxWidth: 370,
              padding: '22px 24px 18px',
              borderRadius: 20,
              background: 'rgba(10,18,36,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1.5px solid ${STYLE_CARD_BORDER[activeStyle]}`,
              borderTop: `3px solid ${STYLE_CARD_TOP[activeStyle]}`,
              boxShadow: [
                '0 10px 40px rgba(0,0,0,0.38)',
                'inset 0 1px 0 rgba(255,255,255,0.06)',
                `0 0 0 1px rgba(201,168,76,0.08)`,
              ].join(', '),
              animation: 'slideUpIn 0.35s ease both',
            }}>
              {/* Top border glow */}
              <div aria-hidden="true" style={{
                height: 1,
                background: `linear-gradient(90deg, transparent, ${STYLE_CARD_BORDER[activeStyle]}, transparent)`,
                marginBottom: 18,
                borderRadius: 1,
              }} />

              <div style={{
                fontSize: 17, lineHeight: 1.85,
                color: 'rgba(255,255,255,0.92)',
                direction: 'rtl', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: "'Heebo',sans-serif",
              }}>
                {result}
              </div>

              {/* Listen button inside card */}
              <button
                type="button"
                onClick={async () => {
                  if (isReadingRef.current) {
                    stopSpeaking()
                    isReadingRef.current = false
                    setIsReading(false)
                    return
                  }
                  isReadingRef.current = true
                  setIsReading(true)
                  try {
                    await speak(result)
                  } finally {
                    isReadingRef.current = false
                    setIsReading(false)
                  }
                }}
                aria-label="הקשיבי להודעה"
                style={{
                  marginTop: 16, height: 52, padding: '0 20px', borderRadius: 18,
                  border: isReading ? '1.5px solid rgba(201,168,76,0.60)' : '1px solid rgba(37,211,102,0.22)',
                  background: isReading ? 'rgba(201,168,76,0.20)' : 'rgba(37,211,102,0.07)',
                  color: isReading ? '#D4A853' : WA_GREEN,
                  fontSize: 16, fontWeight: 600,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.2s ease',
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                  stroke={isReading ? '#D4A853' : WA_GREEN} strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={isReading ? 'rgba(201,168,76,0.25)' : 'rgba(37,211,102,0.15)'} />
                  <path d="M15.54 8.46a5 5 0 010 7.08" />
                </svg>
                {isReading ? 'עוצרת...' : 'תקשיבי'}
              </button>
            </div>

            {/* ── Action buttons row: copy | retry | send ── */}
            <div style={{
              display: 'flex', gap: 10,
              width: '100%', maxWidth: 370,
              justifyContent: 'stretch',
            }}>
              {/* Copy */}
              <button
                type="button"
                onClick={async () => {
                  soundCopy()
                  try { await navigator.clipboard.writeText(result) } catch {}
                  setCopyToast(true)
                  setTimeout(() => setCopyToast(false), 5000)
                }}
                style={{
                  flex: 1, height: 52, borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 16, fontWeight: 600,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.12s',
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                onPointerUp={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onPointerLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                📋 העתקי
              </button>

              {/* Retry */}
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  flex: 1, height: 52, borderRadius: 18,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 16, fontWeight: 600,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.12s',
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                onPointerUp={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onPointerLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                🔄 שנה
              </button>

              {/* Send to family */}
              <button
                type="button"
                onClick={handleSendToFamily}
                style={{
                  flex: 1.4, height: 52, borderRadius: 18,
                  border: '1.5px solid rgba(37,211,102,0.28)',
                  background: `linear-gradient(145deg, #2ee67a, ${WA_GREEN}, #128C7E)`,
                  color: 'white',
                  fontSize: 16, fontWeight: 700,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 4px 16px rgba(37,211,102,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
                  transition: 'transform 0.12s',
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)' }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                📱 שלחי למשפחה
              </button>
            </div>

            {/* Copy toast */}
            {copyToast && (
              <div style={{
                width: '100%', maxWidth: 370,
                padding: '14px 20px', borderRadius: 18,
                background: 'rgba(37,211,102,0.11)',
                border: '1.5px solid rgba(37,211,102,0.38)',
                display: 'flex', alignItems: 'center', gap: 12,
                direction: 'rtl',
                animation: 'slideUpIn 0.25s ease both',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>📋</span>
                <div style={{ fontFamily: "'Heebo',sans-serif" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}>
                    ההודעה הועתקה!
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.60)', marginTop: 2, lineHeight: 1.45 }}>
                    הדבקי בקבוצה (לחצי לחיצה ארוכה ← הדבק) ושלחי
                  </div>
                </div>
              </div>
            )}

            {/* ── Style selector in result state ── */}
            <div style={{
              display: 'flex', gap: 8, flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%', maxWidth: 370,
            }}>
              {STYLES.map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => handleStyleTap(style)}
                  style={{
                    height: 46, padding: '0 22px', borderRadius: 23,
                    border: activeStyle === style
                      ? '1.5px solid rgba(20,184,166,0.70)'
                      : '1px solid rgba(255,255,255,0.13)',
                    background: activeStyle === style
                      ? `linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%)`
                      : 'rgba(255,255,255,0.04)',
                    color: activeStyle === style ? 'white' : STYLE_ACCENT[style],
                    fontSize: 16, fontWeight: activeStyle === style ? 700 : 500,
                    fontFamily: "'Heebo',sans-serif",
                    cursor: 'pointer',
                    boxShadow: activeStyle === style
                      ? '0 3px 16px rgba(20,184,166,0.30), 0 0 0 1px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.14)'
                      : 'none',
                    transition: 'all 0.20s ease',
                    whiteSpace: 'nowrap',
                  }}
                >{style}</button>
              ))}
            </div>

            {/* Voice mode + new message */}
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                type="button"
                onClick={enterVoiceMode}
                style={{
                  padding: '11px 22px', borderRadius: 22,
                  border: '1px solid rgba(37,211,102,0.18)',
                  background: 'rgba(37,211,102,0.06)',
                  color: WA_GREEN, fontSize: 16, fontWeight: 500,
                  fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                  stroke={WA_GREEN} strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12h2" /><path d="M6 8v8" /><path d="M10 5v14" />
                  <path d="M14 8v8" /><path d="M18 10v4" /><path d="M22 12h-2" />
                </svg>
                שיחה קולית
              </button>

              <button
                type="button"
                onClick={handleNewMessage}
                style={{
                  padding: '11px 26px', borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.09)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.42)',
                  fontSize: 16, fontWeight: 500, fontFamily: "'Heebo',sans-serif",
                  cursor: 'pointer',
                }}
              >
                הודעה חדשה
              </button>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          VOICE MODE OVERLAY — full screen teal ripple orb
         ══════════════════════════════════════════════════ */}
      {voiceMode && (
        <div style={{
          position: 'absolute',
          top: 82, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,10,24,0.94)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          zIndex: 15,
        }}>

          {/* Current message preview */}
          {result && (
            <div style={{
              position: 'absolute', top: 16, left: 16, right: 16,
              padding: '18px 22px',
              borderRadius: 18,
              background: 'rgba(8,16,28,0.72)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(201,168,76,0.25)',
              maxHeight: 140, overflowY: 'auto',
            }}>
              <div style={{
                fontSize: 17, lineHeight: 1.75,
                color: 'rgba(255,255,255,0.82)',
                direction: 'rtl', whiteSpace: 'pre-wrap',
                fontFamily: "'Heebo',sans-serif",
              }}>
                {result}
              </div>
            </div>
          )}

          {/* Teal ripple orb — outer ripple ring */}
          <div style={{
            position: 'relative',
            width: 200, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Ripple aura — only when listening */}
            {voicePhase === 'listening' && (
              <div aria-hidden="true" style={{
                position: 'absolute',
                width: 200, height: 200,
                borderRadius: '50%',
                border: `2px solid rgba(20,184,166,${(0.15 + Math.min(0.45, audioLevel * 0.007)).toFixed(2)})`,
                animation: 'tealRipple 1.8s ease-out infinite',
                pointerEvents: 'none',
              }} />
            )}
            {voicePhase === 'listening' && (
              <div aria-hidden="true" style={{
                position: 'absolute',
                width: 200, height: 200,
                borderRadius: '50%',
                border: `2px solid rgba(20,184,166,${(0.10 + Math.min(0.30, audioLevel * 0.005)).toFixed(2)})`,
                animation: 'tealRipple 1.8s ease-out 0.6s infinite',
                pointerEvents: 'none',
              }} />
            )}

            {/* Main orb */}
            <div style={{
              width: 160, height: 160, borderRadius: '50%',
              background: voicePhase === 'speaking'
                ? 'radial-gradient(circle, rgba(37,211,102,0.14) 0%, rgba(37,211,102,0.04) 65%, transparent 100%)'
                : voicePhase === 'processing'
                  ? 'radial-gradient(circle, rgba(20,184,166,0.10) 0%, transparent 70%)'
                  : `radial-gradient(circle, rgba(20,184,166,${(0.10 + Math.min(0.18, audioLevel * 0.004)).toFixed(2)}) 0%, rgba(20,184,166,0.04) 65%, transparent 100%)`,
              border: `3px solid ${
                voicePhase === 'speaking' ? 'rgba(37,211,102,0.50)'
                : voicePhase === 'processing' ? 'rgba(20,184,166,0.18)'
                : `rgba(20,184,166,${(0.22 + Math.min(0.45, audioLevel * 0.008)).toFixed(2)})`
              }`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: voicePhase === 'speaking'
                ? '0 0 40px rgba(37,211,102,0.22), inset 0 0 24px rgba(37,211,102,0.06)'
                : `0 0 ${ringGlow}px rgba(20,184,166,${voicePhase === 'listening' ? 0.18 + audioLevel * 0.005 : 0.10}), inset 0 0 18px rgba(20,184,166,0.04)`,
              transition: 'border-color 0.14s, box-shadow 0.14s, background 0.32s',
              animation: voicePhase === 'processing' ? 'voicePulse 2s ease-in-out infinite' : 'none',
            }}>
              {voicePhase === 'listening' && (
                <svg viewBox="0 0 24 24" width="60" height="60" fill="none"
                  stroke={TEAL} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: `drop-shadow(0 2px 10px rgba(20,184,166,0.35))` }}>
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
              {voicePhase === 'processing' && (
                <div style={{ display: 'flex', gap: 13 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 15, height: 15, borderRadius: '50%',
                      background: TEAL, opacity: 0.55,
                      animation: `waPulse 1.2s ease-in-out ${i * 0.22}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              {voicePhase === 'speaking' && (
                <svg viewBox="0 0 24 24" width="60" height="60" fill="none"
                  stroke={WA_GREEN} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(37,211,102,0.32))' }}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(37,211,102,0.14)" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                  <path d="M15.54 8.46a5 5 0 010 7.08" />
                </svg>
              )}
              {!voicePhase && (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2.5px solid rgba(20,184,166,0.38)`,
                  borderTopColor: TEAL,
                  animation: 'spin 0.8s linear infinite',
                }} />
              )}
            </div>
          </div>

          {/* Audio level bars */}
          {voicePhase === 'listening' && (
            <div style={{
              display: 'flex', gap: 5, alignItems: 'flex-end',
              height: 36, marginTop: 18,
            }}>
              {[0.3, 0.6, 1, 0.8, 0.5, 0.9, 0.4, 0.7, 0.3].map((scale, i) => (
                <div key={i} style={{
                  width: 4, borderRadius: 2,
                  background: TEAL,
                  opacity: 0.28 + Math.min(0.55, audioLevel * 0.009),
                  height: Math.max(5, audioLevel * scale * 0.42),
                  transition: 'height 0.08s ease-out, opacity 0.10s',
                }} />
              ))}
            </div>
          )}

          {/* Phase label — large text */}
          <div style={{
            marginTop: voicePhase === 'listening' ? 14 : 30,
            fontSize: 26, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif",
            color: voicePhase === 'speaking' ? 'rgba(37,211,102,0.88)' : 'rgba(20,184,166,0.88)',
            textShadow: voicePhase === 'speaking'
              ? '0 0 18px rgba(37,211,102,0.18)'
              : '0 0 18px rgba(20,184,166,0.18)',
            textAlign: 'center',
          }}>
            {voicePhase === 'listening'
              ? 'מקשיבה...'
              : voicePhase === 'processing' ? 'מכינה הודעה...'
              : voicePhase === 'speaking' ? 'מקריאה...'
              : 'מתחברת...'}
          </div>

          <div style={{
            marginTop: 10, fontSize: 16,
            color: 'rgba(255,255,255,0.30)',
            fontFamily: "'Heebo',sans-serif",
            textAlign: 'center', lineHeight: 1.55,
            paddingLeft: 24, paddingRight: 24,
          }}>
            {result ? 'אגידי "שלח" או בקשי שינוי' : 'ספרי מה לכתוב למשפחה'}
          </div>

          {/* Exit voice mode button */}
          <button
            type="button"
            onClick={exitVoiceMode}
            aria-label="סיים שיחה קולית"
            style={{
              marginTop: 48, width: 68, height: 68, borderRadius: '50%',
              background: 'linear-gradient(145deg, rgba(239,68,68,0.13), rgba(239,68,68,0.05))',
              border: '2px solid rgba(239,68,68,0.32)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(0,0,0,0.22), 0 0 22px rgba(239,68,68,0.09)',
              transition: 'transform 0.12s ease-out',
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.89)' }}
            onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
              stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Shared keyframe animations */}
      <style>{`
        @keyframes waPulse    { 0%,100%{opacity:0.3;transform:scale(0.80);} 50%{opacity:0.85;transform:scale(1.15);} }
        @keyframes recPulse   { 0%,100%{box-shadow:0 4px 18px rgba(239,68,68,0.38),0 0 0  0   rgba(239,68,68,0.26);}
                                50%    {box-shadow:0 4px 18px rgba(239,68,68,0.38),0 0 0 18px rgba(239,68,68,0);  } }
        @keyframes spin       { to{transform:rotate(360deg);} }
        @keyframes voicePulse { 0%,100%{transform:scale(1);   opacity:1;   } 50%{transform:scale(1.05);opacity:0.80;} }
        @keyframes tealRipple { 0%    {transform:scale(0.86);opacity:0.38;}
                                70%   {transform:scale(1.18);opacity:0.10;}
                                100%  {transform:scale(1.30);opacity:0;   } }
        @keyframes slideUpIn  { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }
        @keyframes headerSlide{ from{opacity:0;transform:translateY(-10px);} to{opacity:1;transform:translateY(0);} }
      `}</style>
      <div style={{ position: 'fixed', bottom: 8, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(201,168,76,0.30)', fontFamily: "'DM Sans',monospace", pointerEvents: 'none', zIndex: 1 }}>v15.0</div>
    </div>
  )
}
