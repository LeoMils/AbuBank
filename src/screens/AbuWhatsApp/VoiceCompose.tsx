import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  understandWhatsAppCommand,
  applyFollowUp,
  isFollowUpCorrection,
  composeWhatsAppMessageDetailed,
  STYLE_LABEL_HE,
  type WhatsAppStyle,
  type WhatsAppComposeCommand,
  type ComposeSource,
} from '../AbuAI/whatsappCompose'
import {
  resolveContactCandidates,
  isRecipientAmbiguous,
  buildWhatsAppPersonUrl,
  getDisplayablePersons,
  isPersonActionable,
  computeInitials,
  type RecipientCandidate,
} from './familyQuickFaces'
import { type FamilyQuickFace } from './familyContacts.private'
import { getLocalContacts } from './familyContactsStorage'
import { transcribeAudio } from './service'
import { recordComposeEvent, mechanismForCorrection } from '../AbuAI/whatsappComposeTelemetry'
import { startMicStream, createRecorder, assembleBlob, cleanupIndividualRefs } from '../../services/recording'
import { unlockIOSAudio, stopSpeaking } from '../../services/voice'
import type { SilenceDetector } from '../../services/voice'
import { soundTap, soundSuccess } from '../../services/sounds'
import { DictationController, type Recognizer } from '../../services/dictationController'

const TEAL = '#14b8a6'
const WA_GREEN = '#25D366'
const GROUP_URL = 'https://chat.whatsapp.com/JqqGpPKTCq3L0JnitU5y5f'

type Person = Extract<FamilyQuickFace, { type: 'person' }>
type Phase = 'listening' | 'transcribing' | 'pickContact' | 'askIntent' | 'composing' | 'review' | 'error'

interface VoiceComposeProps {
  open: boolean
  onClose: () => void
  /** Path A — a contact was tapped first, so the target is fixed up-front. */
  initialFace?: Person | null
}

/**
 * Voice + typed, Abu-AI-composed WhatsApp message to a chosen contact.
 * Voice and text funnel through the SAME handleUtterance → understand →
 * resolve → compose → verify → review path (parity). The composed text opens
 * in the contact's WhatsApp chat PRE-FILLED — WhatsApp still needs a manual
 * send tap (no auto-send).
 */
export function VoiceCompose({ open, onClose, initialFace }: VoiceComposeProps) {
  const [phase, setPhase] = useState<Phase>('listening')
  const [face, setFace] = useState<Person | null>(initialFace ?? null)
  const [command, setCommand] = useState<WhatsAppComposeCommand | null>(null)
  const [candidates, setCandidates] = useState<RecipientCandidate[]>([])
  const [style, setStyle] = useState<WhatsAppStyle>('normal')
  const [message, setMessage] = useState('')
  const [composePath, setComposePath] = useState<string>('')
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')

  const [liveTranscript, setLiveTranscript] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceRef = useRef<SilenceDetector | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const dictationRef = useRef<DictationController | null>(null)

  const phaseRef = useRef<Phase>('listening')
  const faceRef = useRef<Person | null>(initialFace ?? null)
  const commandRef = useRef<WhatsAppComposeCommand | null>(null)
  const messageRef = useRef('')
  const correctingRef = useRef(false)   // next utterance edits the current draft
  const editedRef = useRef(false)       // draft was hand-edited

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { faceRef.current = face }, [face])
  useEffect(() => { commandRef.current = command }, [command])
  useEffect(() => { messageRef.current = message }, [message])

  const persons = useMemo(() => getDisplayablePersons(getLocalContacts()), [open])
  const pickList = candidates.length > 0 ? candidates.map(c => c.face) : persons

  const cleanupCapture = useCallback(() => {
    if (dictationRef.current) { try { dictationRef.current.cancel() } catch { /* ignore */ } dictationRef.current = null }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      } catch { /* ignore */ }
      recognitionRef.current = null
    }
    cleanupIndividualRefs({ recorderRef, streamRef, silenceRef, levelRef })
  }, [])

  // ─── MessageComposer call (LLM → verified → local fallback) ───────────────
  const doCompose = useCallback(async (cmd: WhatsAppComposeCommand, target: Person) => {
    setPhase('composing')
    setError('')
    editedRef.current = false
    const enriched: WhatsAppComposeCommand = { ...cmd, targetHebrew: target.displayName }
    const result = await composeWhatsAppMessageDetailed(enriched, { recipientLabel: target.displayName })
    setMessage(result.message); messageRef.current = result.message
    setComposePath(result.path)
    recordComposeEvent({
      type: 'composed', source: cmd.source, composePath: result.path, style: cmd.style,
      recipient: target.displayName, draftLen: result.message.length, ok: result.verdict.ok,
      intentPurpose: cmd.plan.purpose, language: cmd.plan.language,
    })
    setPhase('review')
  }, [])

  // ─── RecipientEntityResolver + routing ────────────────────────────────────
  const proceedWithCommand = useCallback((cmd: WhatsAppComposeCommand) => {
    setCommand(cmd); commandRef.current = cmd
    setStyle(cmd.style)
    const nameQuery = cmd.targetHebrew ?? cmd.targetName
    if (nameQuery) {
      const cands = resolveContactCandidates(nameQuery)
      if (cands.length === 0) { setCandidates([]); setPhase('pickContact'); return }
      if (isRecipientAmbiguous(cands)) {
        recordComposeEvent({ type: 'recipient_ambiguous', source: cmd.source, candidateCount: cands.length, requestPreview: nameQuery })
        setCandidates(cands); setPhase('pickContact'); return
      }
      const top = cands[0]!
      setFace(top.face); faceRef.current = top.face
      recordComposeEvent({ type: 'recipient_resolved', source: cmd.source, recipient: top.face.displayName, recipientConfidence: top.confidence, recipientEvidence: top.evidence })
      if (cmd.intent) void doCompose(cmd, top.face)
      else setPhase('askIntent')
      return
    }
    if (faceRef.current) {
      if (cmd.intent) void doCompose(cmd, faceRef.current)
      else setPhase('askIntent')
      return
    }
    // No recipient understood — let Martita tap one from the full list.
    setCandidates([]); setPhase('pickContact')
  }, [doCompose])

  // ─── Unified entry for BOTH voice and typed input (parity) ────────────────
  const handleUtterance = useCallback((text: string, source: ComposeSource) => {
    const t = (text ?? '').trim()
    if (!t) { setPhase('listening'); return }

    // Follow-up correction to the current draft (spoken or typed from review).
    if (correctingRef.current && commandRef.current && isFollowUpCorrection(t)) {
      correctingRef.current = false
      const prev = commandRef.current
      const updated = applyFollowUp(prev, t)
      const field = prev.style !== updated.style ? 'style'
        : prev.targetHebrew !== updated.targetHebrew ? 'recipient'
        : prev.intent !== updated.intent ? 'fact' : 'other'
      recordComposeEvent({
        type: 'followup_correction', source, correctedField: field,
        mechanismClass: mechanismForCorrection(field === 'fact' ? 'time' : field),
        requestPreview: t, style: updated.style,
      })
      proceedWithCommand(updated)
      return
    }
    correctingRef.current = false

    const cmd = understandWhatsAppCommand(t, { source })
    recordComposeEvent({
      type: 'request', source, requestPreview: t,
      intentPurpose: cmd.plan.purpose, language: cmd.plan.language, style: cmd.style,
    })

    // Path A: a contact was pre-selected and the utterance names no one new →
    // keep the fixed recipient, treat the utterance as the message.
    if (faceRef.current && !cmd.targetHebrew && !cmd.targetName) {
      const merged: WhatsAppComposeCommand = { ...cmd, targetHebrew: faceRef.current.displayName }
      setCommand(merged); commandRef.current = merged; setStyle(merged.style)
      if (merged.intent) void doCompose(merged, faceRef.current)
      else setPhase('askIntent')
      return
    }
    proceedWithCommand(cmd)
  }, [doCompose, proceedWithCommand])

  // Browser adapter over webkitSpeechRecognition (continuous + interim) for the
  // shared DictationController. A fresh instance per session (restart-safe).
  const makeBrowserRecognizer = useCallback((): Recognizer => {
    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new WSR()
    rec.lang = 'he-IL'
    rec.continuous = true       // long dictation — don't stop on the first pause
    rec.interimResults = true
    rec.maxAlternatives = 1
    const adapter: Recognizer = { start: () => rec.start(), abort: () => { try { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.abort() } catch { /* ignore */ } }, onresult: null, onend: null, onerror: null }
    rec.onresult = (e: any) => {
      const segs = Array.from(e.results as ArrayLike<any>).map((r: any) => ({ transcript: r[0]?.transcript ?? '', isFinal: !!r.isFinal }))
      adapter.onresult?.(segs)
    }
    rec.onend = () => adapter.onend?.()
    rec.onerror = (e: any) => adapter.onerror?.(e?.error || 'error')
    return adapter
  }, [])

  // ─── Long-dictation capture (state machine) → Whisper fallback ────────────
  const beginListen = useCallback((source: ComposeSource = 'voice') => {
    setError('')
    setLiveTranscript('')
    setPhase('listening')

    const WSR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (WSR) {
      const ctrl = new DictationController({
        mode: 'long',
        createRecognizer: makeBrowserRecognizer,
        onTranscript: (t) => setLiveTranscript(t),
        onFinal: (t) => {
          dictationRef.current = null
          setLiveTranscript('')
          setPhase('transcribing')
          handleUtterance(t.trim(), source)
        },
        onError: (m) => { dictationRef.current = null; setError(m); setPhase('error') },
      })
      dictationRef.current = ctrl
      ctrl.start()
      return
    }

    // Fallback (no Web Speech): record CONTINUOUSLY until the user taps "סיימתי"
    // (no silence auto-stop → long messages are never cut off), then Whisper.
    ;(async () => {
      try {
        const stream = await startMicStream()
        streamRef.current = stream
        const recorder = createRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data) }
        recorder.onstop = async () => {
          if (streamRef.current === stream) { try { stream.getTracks().forEach(t => t.stop()) } catch {}; streamRef.current = null }
          const blob = assembleBlob(chunksRef.current, recorder)
          if (blob.size < 500) { setPhase('listening'); return }
          setPhase('transcribing')
          try { handleUtterance((await transcribeAudio(blob)).trim(), source) }
          catch { setError('לא הצלחתי להבין. נסי שוב.'); setPhase('error') }
        }
        recorder.start(100)
      } catch {
        setError('מיקרופון לא זמין. בדקי בהגדרות.'); setPhase('error')
      }
    })()
  }, [handleUtterance, makeBrowserRecognizer])

  // "סיימתי" — explicit completion (finalizes the accumulated transcript now).
  const finishDictation = useCallback(() => {
    if (dictationRef.current) { dictationRef.current.finishByUser(); return }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  // ─── Lifecycle: start on open, clean on close ────────────────────────────
  useEffect(() => {
    if (!open) return
    unlockIOSAudio()
    setFace(initialFace ?? null); faceRef.current = initialFace ?? null
    setCommand(null); commandRef.current = null
    setCandidates([])
    setStyle('normal')
    setMessage(''); messageRef.current = ''
    setComposePath(''); setError(''); setTyped('')
    correctingRef.current = false; editedRef.current = false
    beginListen('voice')
    return () => { cleanupCapture(); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pickFace = (p: Person) => {
    soundTap()
    const wasCorrection = !!faceRef.current && faceRef.current.id !== p.id && phaseRef.current !== 'listening'
    setFace(p); faceRef.current = p
    if (wasCorrection) {
      recordComposeEvent({ type: 'recipient_corrected', recipient: p.displayName, correctedField: 'recipient', mechanismClass: 'recipient_entity_resolution' })
    } else {
      recordComposeEvent({ type: 'recipient_resolved', recipient: p.displayName, recipientConfidence: 1, recipientEvidence: 'exact' })
    }
    setCandidates([])
    const cmd = commandRef.current
    if (cmd?.intent) void doCompose(cmd, p)
    else setPhase('askIntent')
  }

  const changeStyle = (s: WhatsAppStyle) => {
    if (s === style) return
    soundTap()
    setStyle(s)
    const cmd = commandRef.current
    const target = faceRef.current
    if (!cmd || !target) return
    const updated: WhatsAppComposeCommand = { ...cmd, style: s, plan: { ...cmd.plan, requestedTone: s } }
    setCommand(updated); commandRef.current = updated
    recordComposeEvent({ type: 'style_changed', source: cmd.source, style: s, recipient: target.displayName })
    void doCompose(updated, target)
  }

  const submitTyped = () => {
    const t = typed.trim()
    if (!t) return
    setTyped('')
    setPhase('transcribing')
    handleUtterance(t, 'text')
  }

  const submitCorrection = () => {
    const t = typed.trim()
    if (!t) return
    setTyped('')
    correctingRef.current = true
    handleUtterance(t, 'text')
  }

  const onEditDraft = (v: string) => {
    setMessage(v); messageRef.current = v
    if (!editedRef.current) {
      editedRef.current = true
      recordComposeEvent({ type: 'draft_edited', recipient: faceRef.current?.displayName ?? null, draftLen: v.length })
    }
  }

  const openInWhatsApp = () => {
    const target = faceRef.current
    const finalText = messageRef.current
    if (!target) return
    soundSuccess()
    // clipboard.writeText returns a Promise that REJECTS when permission is
    // denied — a bare call leaks an unhandled rejection (which trips the app's
    // global error screen). Swallow both the sync throw and the async rejection.
    try { navigator.clipboard?.writeText(finalText)?.catch(() => {}) } catch { /* clipboard unavailable */ }
    if (isPersonActionable(target)) {
      recordComposeEvent({ type: 'url_opened', recipient: target.displayName, draftLen: finalText.length, ok: true })
      try { navigator.vibrate?.(15) } catch { /* no haptics */ }
      window.location.href = buildWhatsAppPersonUrl(target, finalText)
    } else {
      recordComposeEvent({ type: 'no_phone_fallback', recipient: target.displayName, ok: false })
      setError(`אין מספר שמור ל${target.displayName}. העתקתי את ההודעה — אפשר לפתוח את קבוצת המשפחה ולהדביק.`)
    }
  }

  const closeOverlay = () => {
    if (phaseRef.current !== 'review' || !messageRef.current) {
      recordComposeEvent({ type: 'abandoned', recipient: faceRef.current?.displayName ?? null })
    }
    cleanupCapture()
    onClose()
  }

  if (!open) return null

  const recipientName = face?.displayName ?? ''
  const ambiguous = candidates.length > 0

  return (
    <div
      data-testid="voice-compose-overlay"
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(5,10,24,0.96)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px 18px calc(24px + env(safe-area-inset-bottom, 0px))', direction: 'rtl', overflowY: 'auto',
      }}
    >
      <button
        type="button" onClick={closeOverlay}
        aria-label="סגירה" data-testid="vc-close"
        style={{
          position: 'absolute', top: 14, left: 14, width: 44, height: 44, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer',
        }}
      >✕</button>

      <h2 style={{
        margin: '4px 0 18px', fontFamily: "'Heebo',sans-serif", fontSize: 22, fontWeight: 700,
        color: 'rgba(255,255,255,0.92)', textAlign: 'center',
      }}>
        {recipientName ? `הודעה ל${recipientName}` : ambiguous ? 'למי מהם?' : 'למי לשלוח הודעה?'}
      </h2>

      {(phase === 'listening' || phase === 'askIntent') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 17, color: 'rgba(20,184,166,0.9)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
            {phase === 'askIntent' ? 'מה לכתוב?' : recipientName ? 'אמרי מה לכתוב' : 'אמרי למי ומה לכתוב — למשל: "תכתבי לאדר מזל טוב, מצחיק"'}
          </div>
          <button
            type="button" onClick={finishDictation}
            aria-label="סיימתי לדבר" data-testid="vc-mic"
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(20,184,166,0.22) 0%, rgba(20,184,166,0.05) 70%)',
              border: `3px solid ${TEAL}`, cursor: 'pointer', color: TEAL, fontSize: 15, fontWeight: 700,
              animation: 'vcPulse 1.6s ease-in-out infinite',
            }}
          >מקשיבה…</button>
          {/* Live transcript so far — proves speech is being captured, tolerates pauses. */}
          {liveTranscript && (
            <div data-testid="vc-live-transcript" style={{
              width: '100%', minHeight: 44, padding: '10px 14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(20,184,166,0.25)',
              color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 1.6,
              fontFamily: "'Heebo',sans-serif", direction: 'rtl', whiteSpace: 'pre-wrap',
            }}>{liveTranscript}</div>
          )}
          {/* Explicit completion — never rely on silence alone for a long message. */}
          <button
            type="button" onClick={finishDictation} data-testid="vc-finish"
            style={{
              width: '100%', maxWidth: 380, height: 52, borderRadius: 16, border: 'none',
              background: `linear-gradient(145deg,#2ee67a,${WA_GREEN},#128C7E)`, color: 'white',
              fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            }}
          >✓ סיימתי</button>
          <div style={{ width: '100%', display: 'flex', gap: 8 }}>
            <input
              value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitTyped() }}
              data-testid="vc-typed-input"
              placeholder={recipientName ? 'או כתבי כאן…' : 'או כתבי: תכתבי לאדר מזל טוב'}
              style={{
                flex: 1, height: 48, borderRadius: 14, padding: '0 14px',
                border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)',
                color: 'white', fontSize: 16, fontFamily: "'Heebo',sans-serif", direction: 'rtl',
              }}
            />
            <button type="button" onClick={submitTyped} data-testid="vc-typed-send" style={{
              height: 48, padding: '0 18px', borderRadius: 14, border: 'none',
              background: TEAL, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>שלחי</button>
          </div>
        </div>
      )}

      {(phase === 'transcribing' || phase === 'composing') && (
        <div data-testid="vc-busy" style={{ marginTop: 40, fontSize: 18, color: 'rgba(20,184,166,0.9)', fontFamily: "'Heebo',sans-serif" }}>
          {phase === 'transcribing' ? 'רגע, מבינה…' : 'מכינה את ההודעה…'}
        </div>
      )}

      {phase === 'pickContact' && (
        <div data-testid="vc-pick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 380 }}>
          {pickList.map(p => (
            <button
              key={p.id} type="button" onClick={() => pickFace(p)}
              data-testid={`vc-pick-${p.id}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '12px 4px', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                cursor: 'pointer', minHeight: 92,
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
                border: `2px solid ${isPersonActionable(p) ? WA_GREEN : 'rgba(255,255,255,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(145deg,#0b2220,#050A18)', color: TEAL, fontSize: 22, fontWeight: 700,
              }}>
                {p.photoFile
                  ? <img src={p.photoFile} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                  : computeInitials(p.displayName)}
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: "'Heebo',sans-serif" }}>{p.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'review' && (
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Editable draft */}
          <textarea
            data-testid="vc-draft"
            value={message}
            onChange={e => onEditDraft(e.target.value)}
            dir="rtl"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 110,
              padding: '16px 18px', borderRadius: 18, background: 'rgba(10,18,36,0.72)',
              border: '1.5px solid rgba(37,211,102,0.28)', borderTop: `3px solid ${WA_GREEN}`,
              color: 'rgba(255,255,255,0.94)', fontSize: 18, lineHeight: 1.8,
              fontFamily: "'Heebo',sans-serif", outline: 'none', whiteSpace: 'pre-wrap',
            }}
          />
          <div data-testid="vc-compose-path" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            {composePath === 'local-fallback' ? 'נוסח מקומי (בלי שרת)' : 'נכתב על ידי Abu AI'}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {(['normal', 'funny', 'abu'] as WhatsAppStyle[]).map(s => (
              <button
                key={s} type="button" onClick={() => changeStyle(s)}
                data-testid={`vc-style-${s}`}
                style={{
                  height: 46, padding: '0 20px', borderRadius: 23, cursor: 'pointer',
                  border: style === s ? `1.5px solid ${TEAL}` : '1px solid rgba(255,255,255,0.13)',
                  background: style === s ? `linear-gradient(135deg,#14b8a6,#0d9488)` : 'rgba(255,255,255,0.04)',
                  color: style === s ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize: 16, fontWeight: style === s ? 700 : 500, fontFamily: "'Heebo',sans-serif",
                }}
              >{STYLE_LABEL_HE[s]}</button>
            ))}
          </div>

          {error && (
            <div data-testid="vc-error" style={{
              padding: '12px 16px', borderRadius: 14, background: 'rgba(20,4,4,0.6)',
              border: '1px solid rgba(239,68,68,0.35)', color: 'rgba(255,220,220,0.9)',
              fontSize: 15, fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.5,
            }}>{error}</div>
          )}

          <button
            type="button" onClick={openInWhatsApp} data-testid="vc-open-whatsapp"
            style={{
              width: '100%', height: 58, borderRadius: 18, border: 'none',
              background: `linear-gradient(145deg,#2ee67a,${WA_GREEN},#128C7E)`, color: 'white',
              fontSize: 18, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
            }}
          >📱 פתחי בוואטסאפ</button>

          {/* Correction row: spoken follow-up OR typed correction */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={typed} onChange={e => setTyped(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCorrection() }}
              data-testid="vc-correction-input"
              placeholder='תיקון: "לא, בשמונה, ותעשי מצחיק"'
              style={{
                flex: 1, height: 46, borderRadius: 14, padding: '0 12px',
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
                color: 'white', fontSize: 14, fontFamily: "'Heebo',sans-serif", direction: 'rtl',
              }}
            />
            <button type="button" data-testid="vc-correction-mic"
              onClick={() => { correctingRef.current = true; beginListen('voice') }} style={miniBtn}>🎤</button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" data-testid="vc-change-recipient"
              onClick={() => { setCandidates([]); setPhase('pickContact') }} style={secondaryBtn}>👤 נמען אחר</button>
            {error && (
              <button type="button" data-testid="vc-open-group"
                onClick={() => { window.location.href = GROUP_URL }} style={secondaryBtn}>👨‍👩‍👧 קבוצה</button>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', maxWidth: 360 }}>
          <div data-testid="vc-error" style={{
            padding: '14px 18px', borderRadius: 14, background: 'rgba(20,4,4,0.6)',
            border: '1px solid rgba(239,68,68,0.35)', color: 'rgba(255,220,220,0.9)',
            fontSize: 16, fontFamily: "'Heebo',sans-serif", textAlign: 'center', lineHeight: 1.5,
          }}>⚠️ {error}</div>
          <button type="button" onClick={() => beginListen('voice')} style={secondaryBtn}>🎤 נסי שוב</button>
        </div>
      )}

      <style>{`@keyframes vcPulse{0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0.35);}50%{box-shadow:0 0 0 16px rgba(20,184,166,0);}}`}</style>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = {
  flex: 1, height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)',
  fontSize: 15, fontWeight: 600, fontFamily: "'Heebo',sans-serif", cursor: 'pointer',
}
const miniBtn: React.CSSProperties = {
  width: 46, height: 46, borderRadius: 14, border: '1px solid rgba(20,184,166,0.4)',
  background: 'rgba(20,184,166,0.12)', color: '#14b8a6', fontSize: 18, cursor: 'pointer',
}
