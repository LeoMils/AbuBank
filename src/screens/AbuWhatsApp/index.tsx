import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { generateMessage, transcribeAudio } from './service'
import { startMicStream, createRecorder, assembleBlob, cleanupIndividualRefs } from '../../services/recording'
import { speak, speakVoiceMode, stopSpeaking, unlockIOSAudio, createSilenceDetector } from '../../services/voice'
import { getRandomMartitaPhoto, handleMartitaImgError } from '../../services/martitaPhotos'
import { getRandomFamilyPhoto, handleFamilyImgError } from '../../services/familyPhotos'
import { soundTap, soundSuccess, soundSend, soundCopy } from '../../services/sounds'
import type { SilenceDetector } from '../../services/voice'
import { InfoButton } from '../../components/InfoButton'
import { GRADIENT_TEAL } from '../../design/gradients'
import { BackButton } from '../../components/BackButton'
import { StyleSelector, STYLES, type Style } from './StyleSelector'
import { Toast } from '../../components/Toast'
import { PageShell } from '../../components/PageShell'
import { LoadingState } from '../../components/LoadingState'
import { FamilyQuickFaces } from './familyQuickFaces'
import { FamilyContactsSetup } from './FamilyContactsSetup'

function isOperatorQueryParam(): boolean {
  try {
    if (typeof window === 'undefined' || !window.location) return false
    const params = new URLSearchParams(window.location.search || '')
    return params.get('operator') === '1'
  } catch { return false }
}

type WhatsAppTab = 'family' | 'actions'

const TEAL = '#14b8a6'
const GOLD = '#C9A84C'
const WA_GREEN = '#25D366'

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

type Phase = 'idle' | 'recording' | 'transcribing' | 'generating' | 'ready' | 'result'

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


export function AbuWhatsApp() {
  const setScreen = useAppStore(s => s.setScreen)
  const [tab, setTab] = useState<WhatsAppTab>('family')
  const [phase, setPhase] = useState<Phase>('idle')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [slowLoading, setSlowLoading] = useState(false)
  const [activeStyle, setActiveStyle] = useState<Style>('מקורי')
  const [recordingTime, setRecordingTime] = useState(0)
  const [lastIntent, setLastIntent] = useState('')

  // Operator-only setup for local family contacts. Hidden from normal use:
  // toggled by `?operator=1` query param or a long-press on the family title.
  const [operatorMode, setOperatorMode] = useState<boolean>(isOperatorQueryParam)

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
      cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
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

        const blob = assembleBlob(chunksRef.current, recorder)
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
          setPhase('ready')
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
      setPhase('ready')
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
      setPhase('ready')
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
      setPhase('ready')
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
    cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
  }, [])

  const voiceGenerate = useCallback(async (intent: string, style: Style): Promise<string | null> => {
    try {
      const msg = await generateMessage(intent, style)
      setResult(msg)
      setLastIntent(intent)
      soundSuccess()
      setPhase('ready')
      return msg
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
      if (voiceModeRef.current) {
        setVoicePhase('speaking')
        await speakVoiceMode(errText)
      } else {
        setError(errText)
      }
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
            const errText = err instanceof Error ? err.message : 'שגיאה. נסי שוב.'
            if (voiceModeRef.current) {
              setVoicePhase('speaking')
              await speakVoiceMode(errText)
              await new Promise(r => setTimeout(r, 600))
              if (voiceModeRef.current) startVoiceListening()
            } else {
              setError(errText)
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

  useEffect(() => {
    if (!isLoading) { setSlowLoading(false); return }
    const timer = setTimeout(() => setSlowLoading(true), 8000)
    return () => clearTimeout(timer)
  }, [isLoading])

  useEffect(() => {
    if (phase !== 'ready') return
    const timer = setTimeout(() => setPhase('result'), 300)
    return () => clearTimeout(timer)
  }, [phase])

  const ringGlow = voicePhase === 'listening' ? Math.min(40, 15 + audioLevel * 0.5) : 20
  const ringBorderOpacity = voicePhase === 'listening' ? Math.min(0.7, 0.2 + audioLevel * 0.008) : 0.3

  return (
    <PageShell>

      {/* ══════════════════════════════════════════════════
          HEADER — "Abu הודעות", Martita photo, back button
         ══════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(5,12,18,1) 0%, rgba(4,14,10,1) 60%, rgba(5,10,24,1) 100%)',
        borderBottom: '1px solid rgba(37,211,102,0.18)',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.02)',
        zIndex: 20,
      }}>
        <div style={{
          position: 'relative',
          height: 86,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 16px',
        }}>

          {/* Family portrait — left */}
          <div style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 66, height: 66, borderRadius: '50%',
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
            } as React.CSSProperties}>Abu</span>
            <span style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 27, fontWeight: 500, letterSpacing: '0.3px',
              direction: 'rtl',
              background: 'linear-gradient(135deg, #86EFAC 0%, #4ADE80 12%, #25D366 24%, #16A34A 38%, #6EE7B7 52%, #15803D 66%, #34D399 78%, #86EFAC 90%, #4ADE80 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
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
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 18,
        WebkitOverflowScrolling: 'touch',
        background: 'radial-gradient(ellipse at 50% 8%, rgba(37,211,102,0.04) 0%, transparent 55%)',
        position: 'relative',
      }}>

        {tab === 'family' && !voiceMode && !operatorMode && (
          <FamilyQuickFaces
            onOpenWhatsApp={(url) => { window.location.href = url }}
            onOpenTel={(url) => { window.location.href = url }}
            onOperatorSetup={() => setOperatorMode(true)}
          />
        )}

        {tab === 'family' && !voiceMode && operatorMode && (
          <FamilyContactsSetup onClose={() => setOperatorMode(false)} />
        )}

        {tab === 'actions' && (
          <>
        {/* ── Error banner — hidden during voice mode (TTS handles it) ── */}
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

          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          BOTTOM TAB BAR — משפחה / פעולות segmented control
          Hidden from Martita's default view (v0.3.2). The "פעולות"
          AI-message-generation flow remains in the codebase but is only
          reachable from operator mode so the family bubble grid is the
          single, calm surface Martita sees. Re-enable by also rendering
          this bar when operatorMode = true if you want operators to flip
          back to actions.
         ══════════════════════════════════════════════════ */}
      {!voiceMode && operatorMode && (
        <div
          data-testid="abuwhatsapp-tab-bar"
          style={{
            position: 'absolute',
            left: 12, right: 12,
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            display: 'flex', gap: 8,
            padding: 6,
            borderRadius: 22,
            background: 'rgba(8,16,28,0.78)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(37,211,102,0.18)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
            zIndex: 10,
            direction: 'rtl',
          }}
        >
          <TabButton
            label="משפחה"
            testId="tab-family"
            active={tab === 'family'}
            onClick={() => { soundTap(); setTab('family') }}
          />
          <TabButton
            label="פעולות"
            testId="tab-actions"
            active={tab === 'actions'}
            onClick={() => { soundTap(); setTab('actions') }}
          />
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
      `}</style>
    </PageShell>
  )
}

function TabButton({
  label, testId, active, onClick,
}: { label: string; testId: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        height: 52,
        borderRadius: 16,
        border: active ? '1.5px solid rgba(37,211,102,0.50)' : '1px solid rgba(255,255,255,0.06)',
        background: active
          ? 'linear-gradient(145deg, rgba(37,211,102,0.20), rgba(20,184,166,0.10))'
          : 'transparent',
        color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
        fontSize: 17, fontWeight: 700,
        fontFamily: "'Heebo',sans-serif",
        cursor: 'pointer',
        letterSpacing: '0.3px',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 14px rgba(37,211,102,0.18)' : 'none',
        transition: 'background 0.16s, color 0.16s, border-color 0.16s',
      }}
    >
      {label}
    </button>
  )
}
