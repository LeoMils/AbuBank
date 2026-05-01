import { useState, useEffect, useRef } from 'react'
import { type Appointment, detectEmoji } from './service'
import { GOLD, BRIGHT_GOLD, CREAM, getTodayStr, isDuplicate } from './constants'
import { speak, stopSpeaking } from '../../services/voice'

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function formatHebrewDateSlot(dateStr: string | null, todayStr: string): string {
  if (!dateStr) return 'חסר'
  const [yStr, mStr, dStr] = dateStr.split('-')
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 'חסר'
  if (dateStr === todayStr) return 'היום'
  const target = new Date(y, m - 1, d)
  const [tyStr, tmStr, tdStr] = todayStr.split('-')
  const today = new Date(Number(tyStr), Number(tmStr) - 1, Number(tdStr))
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 1) return 'מחר'
  if (diff === 2) return 'מחרתיים'
  return `${d} ב${HEBREW_MONTHS[m - 1] ?? ''} ${y}`
}

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'parsed' | 'error'

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'מוכנה',
  recording: 'מקליטה…',
  transcribing: 'ממירה לטקסט…',
  parsing: 'מבינה…',
  parsed: 'הבנתי',
  error: 'שגיאה',
}

const STATE_COLOR: Record<VoiceState, string> = {
  idle: 'rgba(255,250,240,0.55)',
  recording: '#fca5a5',
  transcribing: '#fcd34d',
  parsing: '#fcd34d',
  parsed: '#86efac',
  error: '#fca5a5',
}

interface VoiceCardProps {
  parsed: { title: string; date: string | null; time: string | null; emoji: string; location?: string | null; notes?: string | null; confidence?: number; source?: 'local' | 'llm' | 'fallback' | null }
  existingAppts: Appointment[]
  onConfirm: (final: { title: string; date: string; time: string; emoji: string; location?: string; notes?: string }) => void
  onCancel: () => void
  confirmationText?: string
  onCorrection?: () => void
  isCorrecting?: boolean
  rawTranscript?: string
  voiceState?: VoiceState
  voiceError?: string | null
  onReparse?: (transcript: string) => void
  onSpokenDone?: () => void
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'rgba(201,168,76,0.75)',
  fontFamily: "'Heebo',sans-serif", letterSpacing: 0.4, marginBottom: 4,
}

const FIELD_INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,250,240,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: CREAM, fontSize: 17, fontFamily: "'Heebo',sans-serif",
  outline: 'none', boxSizing: 'border-box',
}

const FIELD_INPUT_MISSING: React.CSSProperties = {
  ...FIELD_INPUT,
  border: '1px solid rgba(251,146,60,0.45)',
}

export function VoiceCard({
  parsed, existingAppts, onConfirm, onCancel, confirmationText,
  onCorrection, isCorrecting, rawTranscript,
  voiceState = 'parsed', voiceError = null, onReparse,
  onSpokenDone,
}: VoiceCardProps) {
  const today = getTodayStr()
  const [transcriptDraft, setTranscriptDraft] = useState(rawTranscript ?? '')
  const [title, setTitle] = useState(parsed.title ?? '')
  const [date, setDate] = useState(parsed.date ?? '')
  const [time, setTime] = useState(parsed.time ?? '')
  const [location, setLocation] = useState(parsed.location ?? '')
  const [notes, setNotes] = useState(parsed.notes ?? '')
  const [ttsError, setTtsError] = useState<string | null>(null)
  const lastSpokenRef = useRef<string>('')

  useEffect(() => { setTranscriptDraft(rawTranscript ?? '') }, [rawTranscript])
  useEffect(() => { setTitle(parsed.title ?? '') }, [parsed.title])
  useEffect(() => { setDate(parsed.date ?? '') }, [parsed.date])
  useEffect(() => { setTime(parsed.time ?? '') }, [parsed.time])
  useEffect(() => { setLocation(parsed.location ?? '') }, [parsed.location])
  useEffect(() => { setNotes(parsed.notes ?? '') }, [parsed.notes])

  useEffect(() => {
    if (!confirmationText) return
    if (confirmationText === lastSpokenRef.current) return
    lastSpokenRef.current = confirmationText
    setTtsError(null)
    let cancelled = false
    speak(confirmationText)
      .then(() => { if (!cancelled) onSpokenDone?.() })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setTtsError(`קול לא זמין: ${msg}`)
        // TTS failed — do NOT auto-listen; the user uses the visible button.
      })
    return () => { cancelled = true; stopSpeaking() }
  }, [confirmationText, onSpokenDone])

  const emoji = parsed.emoji && parsed.emoji !== '📅'
    ? parsed.emoji
    : detectEmoji(`${title} ${notes}`)

  const trimmedTitle = title.trim()
  const canSave = Boolean(trimmedTitle && date && time)
  const isPastDate = !!date && date < today
  const hasDuplicate = canSave && isDuplicate(trimmedTitle, date, time, existingAppts)
  const dateLabel = formatHebrewDateSlot(date || null, today)

  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.84)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      overflowY: 'auto',
    } as React.CSSProperties}>
      <div onClick={e => e.stopPropagation()} dir="rtl" style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(160deg, rgba(14,12,10,0.99) 0%, rgba(10,8,6,0.99) 100%)',
        border: '1px solid rgba(201,168,76,0.32)', borderBottom: 'none',
        borderRadius: '24px 24px 0 0',
        padding: 'calc(20px + env(safe-area-inset-bottom, 0px)) 18px 18px',
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 -8px 40px rgba(201,168,76,0.12)',
        animation: 'sheetUp 0.32s cubic-bezier(0.34,1.3,0.64,1) both',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: CREAM, fontFamily: "'Heebo',sans-serif" }}>
            שמעתי נכון?
          </div>
          <div data-testid="voice-state-badge" style={{
            fontSize: 13, fontWeight: 700, color: STATE_COLOR[voiceState],
            fontFamily: "'Heebo',sans-serif", padding: '4px 10px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {STATE_LABEL[voiceState]}
          </div>
        </div>

        {voiceError && (
          <div data-testid="voice-error" style={{
            fontSize: 14, color: '#fca5a5', fontFamily: "'Heebo',sans-serif",
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
          }}>{voiceError}</div>
        )}

        {ttsError && (
          <div data-testid="tts-error" style={{
            fontSize: 13, color: 'rgba(252,211,77,0.95)', fontFamily: "'Heebo',sans-serif",
            padding: '6px 10px', borderRadius: 10,
            background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.25)',
          }}>{ttsError}</div>
        )}

        {confirmationText && (
          <div data-testid="voice-confirmation-text" style={{
            fontSize: 16, lineHeight: 1.55, color: CREAM,
            fontFamily: "'Heebo',sans-serif", textAlign: 'center',
            whiteSpace: 'pre-line', padding: '4px 6px',
          }}>
            {confirmationText}
          </div>
        )}

        <div data-testid="transcript-box">
          <div style={FIELD_LABEL}>מה שמעתי</div>
          <textarea
            value={transcriptDraft}
            onChange={e => setTranscriptDraft(e.target.value)}
            data-testid="transcript-textarea"
            rows={3}
            style={{ ...FIELD_INPUT, minHeight: 64, resize: 'vertical', lineHeight: 1.45 }}
          />
          {onReparse && (
            <button
              type="button"
              data-testid="reparse-button"
              onClick={() => onReparse(transcriptDraft)}
              style={{
                marginTop: 8, padding: '10px 14px', borderRadius: 10,
                border: '1px solid rgba(201,168,76,0.32)',
                background: 'rgba(201,168,76,0.10)', color: CREAM,
                fontSize: 15, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
                cursor: 'pointer', minHeight: 44,
              }}
            >נתחי שוב</button>
          )}
        </div>

        <div data-testid="voice-fields" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div data-testid="field-what">
            <div style={FIELD_LABEL}>מה</div>
            <input
              type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="חסר"
              style={trimmedTitle ? FIELD_INPUT : FIELD_INPUT_MISSING}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div data-testid="field-date" style={{ flex: 1 }}>
              <div style={FIELD_LABEL}>תאריך</div>
              <input
                type="text" value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="חסר"
                style={date ? FIELD_INPUT : FIELD_INPUT_MISSING}
              />
              {date && (
                <div style={{ fontSize: 13, color: 'rgba(255,250,240,0.55)', fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>
                  {dateLabel}
                </div>
              )}
              {isPastDate && (
                <div style={{ fontSize: 13, color: 'rgba(251,146,60,0.85)', fontFamily: "'Heebo',sans-serif", marginTop: 4 }}>
                  ⚠️ התאריך עבר
                </div>
              )}
            </div>
            <div data-testid="field-time" style={{ flex: 1 }}>
              <div style={FIELD_LABEL}>שעה</div>
              <input
                type="text" value={time}
                onChange={e => setTime(e.target.value)}
                placeholder="חסר"
                style={time ? FIELD_INPUT : FIELD_INPUT_MISSING}
                dir="ltr"
              />
            </div>
          </div>

          <div data-testid="field-where">
            <div style={FIELD_LABEL}>איפה</div>
            <input
              type="text" value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="חסר"
              style={location ? FIELD_INPUT : FIELD_INPUT_MISSING}
            />
          </div>

          <div data-testid="field-note">
            <div style={FIELD_LABEL}>הערה</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="חסר"
              rows={2}
              style={{ ...(notes ? FIELD_INPUT : FIELD_INPUT_MISSING), minHeight: 56, resize: 'vertical', lineHeight: 1.45 }}
            />
          </div>
        </div>

        {hasDuplicate && (
          <div style={{ fontSize: 14, color: 'rgba(201,168,76,0.60)', fontFamily: "'Heebo',sans-serif", textAlign: 'center' }}>
            אירוע דומה כבר קיים
          </div>
        )}

        {isDev && (
          <div data-testid="voice-debug" style={{
            fontSize: 12, lineHeight: 1.5, color: 'rgba(255,250,240,0.55)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            padding: '8px 10px', borderRadius: 10,
            background: 'rgba(0,0,0,0.40)', border: '1px dashed rgba(255,255,255,0.18)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <div style={{ fontWeight: 700, color: 'rgba(201,168,76,0.80)', marginBottom: 4 }}>DEBUG</div>
            <div>state: {voiceState}</div>
            <div>source: {parsed.source ?? '—'}</div>
            <div>raw: {rawTranscript || '—'}</div>
            <div>parsed: {JSON.stringify({
              title: parsed.title, date: parsed.date, time: parsed.time,
              location: parsed.location, notes: parsed.notes,
            })}</div>
            <div>confidence: {parsed.confidence != null ? parsed.confidence.toFixed(2) : '—'}</div>
            <div>tts: {ttsError ?? 'ok'}</div>
            <div>error: {voiceError ?? 'none'}</div>
          </div>
        )}

        {onCorrection && (
          <button type="button" onClick={onCorrection} data-testid="voice-correction-mic" style={{
            padding: '12px 14px', borderRadius: 14,
            border: '1px solid rgba(201,168,76,0.32)',
            background: isCorrecting ? 'rgba(239,68,68,0.18)' : 'rgba(201,168,76,0.10)',
            color: isCorrecting ? '#fca5a5' : CREAM, fontSize: 16, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 20 }} aria-hidden>🎙️</span>
            {isCorrecting ? 'מקשיבה לתיקון…' : 'תקני בדיבור'}
          </button>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: '14px', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.55)', fontSize: 17, fontWeight: 600,
            fontFamily: "'Heebo',sans-serif", cursor: 'pointer', minHeight: 52,
          }}>ביטול</button>
          <button type="button" disabled={!canSave}
            onClick={() => canSave && onConfirm({
              title: trimmedTitle, date, time, emoji,
              ...(location.trim() ? { location: location.trim() } : {}),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            })}
            style={{
              flex: 2, padding: '14px', borderRadius: 14, border: 'none',
              background: canSave ? `linear-gradient(135deg, ${BRIGHT_GOLD} 0%, #e8c76a 50%, ${GOLD} 100%)` : 'rgba(255,255,255,0.06)',
              color: canSave ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.20)',
              fontSize: 17, fontWeight: 700, fontFamily: "'Heebo',sans-serif",
              cursor: canSave ? 'pointer' : 'not-allowed', minHeight: 52,
            }}
          >כן, שמרי!</button>
        </div>
      </div>
    </div>
  )
}
